/* Service Worker — القرآن الكريم
 * - Precache لواجهة التطبيق وبيانات المصحف (app-*)
 * - الصوت: كاش أولًا من audio-v1 مع دعم Range requests (مهم لـ iOS Safari)
 * يُحدَّث VERSION و ASSETS تلقائيًا بواسطة scripts/stamp-sw.js
 */
const VERSION = 'bed68bdf6c';
const APP_CACHE = 'app-' + VERSION;
const AUDIO_CACHE = 'audio-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/audio/mediaSession.js',
  'src/audio/player.js',
  'src/audio/playerBar.js',
  'src/audio/sleepTimer.js',
  'src/data.js',
  'src/db.js',
  'src/features/bookmarks.js',
  'src/lib/arabic.js',
  'src/lib/dom.js',
  'src/main.js',
  'src/offline/autoDownload.js',
  'src/offline/downloader.js',
  'src/offline/storage.js',
  'src/router.js',
  'src/state.js',
  'src/styles/base.css',
  'src/styles/components.css',
  'src/styles/themes.css',
  'src/ui.js',
  'src/views/about.js',
  'src/views/bookmarks.js',
  'src/views/downloads.js',
  'src/views/home.js',
  'src/views/reader.js',
  'src/views/search.js',
  'src/views/settings.js',
  'public/data/quran-meta.json',
  'public/data/quran-simple.json',
  'public/data/quran-uthmani.json',
  'public/data/reciters.json',
  'public/data/surahs.json',
  'public/fonts/amiri-quran.woff2',
  'public/fonts/noto-kufi-arabic.woff2',
  'public/fonts/noto-kufi-latin.woff2',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon.svg',
  'public/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('app-') && k !== APP_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الصوت
  if (url.hostname === 'everyayah.com' && url.pathname.endsWith('.mp3')) {
    event.respondWith(audioResponse(req));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // التنقل: index.html من الكاش (التطبيق يعمل بدون نت)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      return (await cache.match('index.html')) || (await cache.match('./')) || fetch(req);
    })().catch(() => fetch(req)));
    return;
  }

  // باقي الملفات: كاش أولًا ثم الشبكة
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  })());
});

async function audioResponse(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req.url);
  if (!cached) {
    try { return await fetch(req); }
    catch (e) { return new Response('', { status: 504, statusText: 'Offline' }); }
  }
  const range = req.headers.get('range');
  if (!range) return cached;
  const blob = await cached.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  if (start >= size || end >= size || start > end) {
    return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
