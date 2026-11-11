/* Service Worker — القرآن الكريم
 * - Precache لواجهة التطبيق وبيانات المصحف (app-*)
 * - الصوت: كاش أولًا من audio-v1 مع دعم Range requests (مهم لـ iOS Safari)
 * يُحدَّث VERSION و ASSETS تلقائيًا بواسطة scripts/stamp-sw.js
 */
const VERSION = '1b27a41a9a';
const APP_CACHE = 'app-' + VERSION;
const AUDIO_CACHE = 'audio-v1';
const TIMING_CACHE = 'timing-v1';
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
  'src/features/extra.js',
  'src/features/group.js',
  'src/features/immersive.js',
  'src/features/khatma.js',
  'src/features/notes.js',
  'src/features/prayer.js',
  'src/features/shareCard.js',
  'src/features/srs.js',
  'src/lib/arabic.js',
  'src/lib/dom.js',
  'src/main.js',
  'src/offline/autoDownload.js',
  'src/offline/downloader.js',
  'src/offline/storage.js',
  'src/router.js',
  'src/state.js',
  'src/styles/base.css',
  'src/styles/classic.css',
  'src/styles/components.css',
  'src/styles/features.css',
  'src/styles/themes.css',
  'src/ui.js',
  'src/views/about.js',
  'src/views/bookmarks.js',
  'src/views/car.js',
  'src/views/downloads.js',
  'src/views/group.js',
  'src/views/home.js',
  'src/views/khatma.js',
  'src/views/memorize.js',
  'src/views/mushaf.js',
  'src/views/prayer.js',
  'src/views/reader.js',
  'src/views/search.js',
  'src/views/settings.js',
  'src/views/welcome.js',
  'public/data/adhkar.json',
  'public/data/extra-notice.json',
  'public/data/mushaf/1.json',
  'public/data/mushaf/10.json',
  'public/data/mushaf/11.json',
  'public/data/mushaf/12.json',
  'public/data/mushaf/13.json',
  'public/data/mushaf/14.json',
  'public/data/mushaf/15.json',
  'public/data/mushaf/16.json',
  'public/data/mushaf/17.json',
  'public/data/mushaf/18.json',
  'public/data/mushaf/19.json',
  'public/data/mushaf/2.json',
  'public/data/mushaf/20.json',
  'public/data/mushaf/21.json',
  'public/data/mushaf/22.json',
  'public/data/mushaf/23.json',
  'public/data/mushaf/24.json',
  'public/data/mushaf/25.json',
  'public/data/mushaf/26.json',
  'public/data/mushaf/27.json',
  'public/data/mushaf/28.json',
  'public/data/mushaf/29.json',
  'public/data/mushaf/3.json',
  'public/data/mushaf/30.json',
  'public/data/mushaf/4.json',
  'public/data/mushaf/5.json',
  'public/data/mushaf/6.json',
  'public/data/mushaf/7.json',
  'public/data/mushaf/8.json',
  'public/data/mushaf/9.json',
  'public/data/mushaf/index.json',
  'public/data/quran-meta.json',
  'public/data/quran-simple.json',
  'public/data/quran-uthmani.json',
  'public/data/reciters.json',
  'public/data/roots.json',
  'public/data/surahs.json',
  'public/data/tafsir/1.json',
  'public/data/tafsir/10.json',
  'public/data/tafsir/100.json',
  'public/data/tafsir/101.json',
  'public/data/tafsir/102.json',
  'public/data/tafsir/103.json',
  'public/data/tafsir/104.json',
  'public/data/tafsir/105.json',
  'public/data/tafsir/106.json',
  'public/data/tafsir/107.json',
  'public/data/tafsir/108.json',
  'public/data/tafsir/109.json',
  'public/data/tafsir/11.json',
  'public/data/tafsir/110.json',
  'public/data/tafsir/111.json',
  'public/data/tafsir/112.json',
  'public/data/tafsir/113.json',
  'public/data/tafsir/114.json',
  'public/data/tafsir/12.json',
  'public/data/tafsir/13.json',
  'public/data/tafsir/14.json',
  'public/data/tafsir/15.json',
  'public/data/tafsir/16.json',
  'public/data/tafsir/17.json',
  'public/data/tafsir/18.json',
  'public/data/tafsir/19.json',
  'public/data/tafsir/2.json',
  'public/data/tafsir/20.json',
  'public/data/tafsir/21.json',
  'public/data/tafsir/22.json',
  'public/data/tafsir/23.json',
  'public/data/tafsir/24.json',
  'public/data/tafsir/25.json',
  'public/data/tafsir/26.json',
  'public/data/tafsir/27.json',
  'public/data/tafsir/28.json',
  'public/data/tafsir/29.json',
  'public/data/tafsir/3.json',
  'public/data/tafsir/30.json',
  'public/data/tafsir/31.json',
  'public/data/tafsir/32.json',
  'public/data/tafsir/33.json',
  'public/data/tafsir/34.json',
  'public/data/tafsir/35.json',
  'public/data/tafsir/36.json',
  'public/data/tafsir/37.json',
  'public/data/tafsir/38.json',
  'public/data/tafsir/39.json',
  'public/data/tafsir/4.json',
  'public/data/tafsir/40.json',
  'public/data/tafsir/41.json',
  'public/data/tafsir/42.json',
  'public/data/tafsir/43.json',
  'public/data/tafsir/44.json',
  'public/data/tafsir/45.json',
  'public/data/tafsir/46.json',
  'public/data/tafsir/47.json',
  'public/data/tafsir/48.json',
  'public/data/tafsir/49.json',
  'public/data/tafsir/5.json',
  'public/data/tafsir/50.json',
  'public/data/tafsir/51.json',
  'public/data/tafsir/52.json',
  'public/data/tafsir/53.json',
  'public/data/tafsir/54.json',
  'public/data/tafsir/55.json',
  'public/data/tafsir/56.json',
  'public/data/tafsir/57.json',
  'public/data/tafsir/58.json',
  'public/data/tafsir/59.json',
  'public/data/tafsir/6.json',
  'public/data/tafsir/60.json',
  'public/data/tafsir/61.json',
  'public/data/tafsir/62.json',
  'public/data/tafsir/63.json',
  'public/data/tafsir/64.json',
  'public/data/tafsir/65.json',
  'public/data/tafsir/66.json',
  'public/data/tafsir/67.json',
  'public/data/tafsir/68.json',
  'public/data/tafsir/69.json',
  'public/data/tafsir/7.json',
  'public/data/tafsir/70.json',
  'public/data/tafsir/71.json',
  'public/data/tafsir/72.json',
  'public/data/tafsir/73.json',
  'public/data/tafsir/74.json',
  'public/data/tafsir/75.json',
  'public/data/tafsir/76.json',
  'public/data/tafsir/77.json',
  'public/data/tafsir/78.json',
  'public/data/tafsir/79.json',
  'public/data/tafsir/8.json',
  'public/data/tafsir/80.json',
  'public/data/tafsir/81.json',
  'public/data/tafsir/82.json',
  'public/data/tafsir/83.json',
  'public/data/tafsir/84.json',
  'public/data/tafsir/85.json',
  'public/data/tafsir/86.json',
  'public/data/tafsir/87.json',
  'public/data/tafsir/88.json',
  'public/data/tafsir/89.json',
  'public/data/tafsir/9.json',
  'public/data/tafsir/90.json',
  'public/data/tafsir/91.json',
  'public/data/tafsir/92.json',
  'public/data/tafsir/93.json',
  'public/data/tafsir/94.json',
  'public/data/tafsir/95.json',
  'public/data/tafsir/96.json',
  'public/data/tafsir/97.json',
  'public/data/tafsir/98.json',
  'public/data/tafsir/99.json',
  'public/data/tajweed.json',
  'public/data/words/1.json',
  'public/data/words/10.json',
  'public/data/words/100.json',
  'public/data/words/101.json',
  'public/data/words/102.json',
  'public/data/words/103.json',
  'public/data/words/104.json',
  'public/data/words/105.json',
  'public/data/words/106.json',
  'public/data/words/107.json',
  'public/data/words/108.json',
  'public/data/words/109.json',
  'public/data/words/11.json',
  'public/data/words/110.json',
  'public/data/words/111.json',
  'public/data/words/112.json',
  'public/data/words/113.json',
  'public/data/words/114.json',
  'public/data/words/12.json',
  'public/data/words/13.json',
  'public/data/words/14.json',
  'public/data/words/15.json',
  'public/data/words/16.json',
  'public/data/words/17.json',
  'public/data/words/18.json',
  'public/data/words/19.json',
  'public/data/words/2.json',
  'public/data/words/20.json',
  'public/data/words/21.json',
  'public/data/words/22.json',
  'public/data/words/23.json',
  'public/data/words/24.json',
  'public/data/words/25.json',
  'public/data/words/26.json',
  'public/data/words/27.json',
  'public/data/words/28.json',
  'public/data/words/29.json',
  'public/data/words/3.json',
  'public/data/words/30.json',
  'public/data/words/31.json',
  'public/data/words/32.json',
  'public/data/words/33.json',
  'public/data/words/34.json',
  'public/data/words/35.json',
  'public/data/words/36.json',
  'public/data/words/37.json',
  'public/data/words/38.json',
  'public/data/words/39.json',
  'public/data/words/4.json',
  'public/data/words/40.json',
  'public/data/words/41.json',
  'public/data/words/42.json',
  'public/data/words/43.json',
  'public/data/words/44.json',
  'public/data/words/45.json',
  'public/data/words/46.json',
  'public/data/words/47.json',
  'public/data/words/48.json',
  'public/data/words/49.json',
  'public/data/words/5.json',
  'public/data/words/50.json',
  'public/data/words/51.json',
  'public/data/words/52.json',
  'public/data/words/53.json',
  'public/data/words/54.json',
  'public/data/words/55.json',
  'public/data/words/56.json',
  'public/data/words/57.json',
  'public/data/words/58.json',
  'public/data/words/59.json',
  'public/data/words/6.json',
  'public/data/words/60.json',
  'public/data/words/61.json',
  'public/data/words/62.json',
  'public/data/words/63.json',
  'public/data/words/64.json',
  'public/data/words/65.json',
  'public/data/words/66.json',
  'public/data/words/67.json',
  'public/data/words/68.json',
  'public/data/words/69.json',
  'public/data/words/7.json',
  'public/data/words/70.json',
  'public/data/words/71.json',
  'public/data/words/72.json',
  'public/data/words/73.json',
  'public/data/words/74.json',
  'public/data/words/75.json',
  'public/data/words/76.json',
  'public/data/words/77.json',
  'public/data/words/78.json',
  'public/data/words/79.json',
  'public/data/words/8.json',
  'public/data/words/80.json',
  'public/data/words/81.json',
  'public/data/words/82.json',
  'public/data/words/83.json',
  'public/data/words/84.json',
  'public/data/words/85.json',
  'public/data/words/86.json',
  'public/data/words/87.json',
  'public/data/words/88.json',
  'public/data/words/89.json',
  'public/data/words/9.json',
  'public/data/words/90.json',
  'public/data/words/91.json',
  'public/data/words/92.json',
  'public/data/words/93.json',
  'public/data/words/94.json',
  'public/data/words/95.json',
  'public/data/words/96.json',
  'public/data/words/97.json',
  'public/data/words/98.json',
  'public/data/words/99.json',
  'public/data/words/labels.json',
  'public/fonts/amiri-quran.woff2',
  'public/fonts/noto-kufi-arabic.woff2',
  'public/fonts/noto-kufi-latin.woff2',
  'public/fonts/uthmanic-hafs.woff2',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-512.png',
  'public/lib/adhan.esm.js',
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
  if ((url.hostname.endsWith('mp3quran.net') || url.hostname === 'everyayah.com') && url.pathname.endsWith('.mp3')) {
    event.respondWith(audioResponse(req));
    return;
  }

  // توقيت الآيات: كاش أولًا (صغير، يُحفظ عند أول تشغيل ليعمل التظليل بدون إنترنت)
  if (url.hostname.endsWith('mp3quran.net') && url.pathname.includes('/ayat_timing')) {
    event.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(TIMING_CACHE)).put(req.url, res.clone());
      return res;
    })());
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
