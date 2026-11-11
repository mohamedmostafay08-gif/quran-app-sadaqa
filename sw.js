/* Service Worker — القرآن الكريم
 * - Precache لواجهة التطبيق وبيانات المصحف (app-*)
 * - الصوت: كاش أولًا من audio-v1 مع دعم Range requests (مهم لـ iOS Safari)
 * يُحدَّث VERSION و ASSETS تلقائيًا بواسطة scripts/stamp-sw.js
 */
const VERSION = '9f1d6b8a14';
const APP_CACHE = 'app-' + VERSION;
const AUDIO_CACHE = 'audio-v1';
const TIMING_CACHE = 'timing-v1';
// البيانات الإضافية (الكلمات، التفسير، الصفحات، الترجمات…) تُخزَّن عند أول استخدام في كاش مستقل
const EXTRAS_VERSION = '80dad7f240';
const EXTRAS_CACHE = 'extras-' + EXTRAS_VERSION;
const isExtra = (path) => /\/public\/data\/(words|tafsir|tafsir-saadi|mushaf|trans)\//.test(path) || /\/public\/data\/(roots|tajweed|tajweed-qpc)\.json$/.test(path);
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
  'src/features/backup.js',
  'src/features/bookmarks.js',
  'src/features/extra.js',
  'src/features/group.js',
  'src/features/immersive.js',
  'src/features/install.js',
  'src/features/khatma.js',
  'src/features/notes.js',
  'src/features/prayer.js',
  'src/features/push.js',
  'src/features/shareAudio.js',
  'src/features/shareCard.js',
  'src/features/srs.js',
  'src/features/stats.js',
  'src/lib/arabic.js',
  'src/lib/dom.js',
  'src/main.js',
  'src/offline/autoDownload.js',
  'src/offline/downloader.js',
  'src/offline/extras.js',
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
  'src/views/notifyCard.js',
  'src/views/prayer.js',
  'src/views/reader.js',
  'src/views/search.js',
  'src/views/settings.js',
  'src/views/welcome.js',
  'public/data/adhkar.json',
  'public/data/extra-notice.json',
  'public/data/quran-meta.json',
  'public/data/quran-simple.json',
  'public/data/quran-uthmani.json',
  'public/data/reciters.json',
  'public/data/surahs.json',
  'public/fonts/amiri-quran.woff2',
  'public/fonts/noto-kufi-arabic.woff2',
  'public/fonts/noto-kufi-latin.woff2',
  'public/fonts/uthmanic-hafs.woff2',
  'public/icons/badge-96.png',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-512.png',
  'public/lib/adhan.esm.js',
  'public/data/extras.json',
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
    await Promise.all(keys.filter((k) => (k.startsWith('app-') && k !== APP_CACHE) || (k.startsWith('extras-') && k !== EXTRAS_CACHE)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ===== الإشعارات =====
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'رتّل', body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'رتّل', {
    body: d.body || '', tag: d.tag || 'rattil', renotify: true, lang: 'ar', dir: 'rtl',
    icon: 'public/icons/icon-192.png', badge: 'public/icons/badge-96.png', data: { url: d.url || '' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(self.registration.scope).href + (event.notification.data?.url || '');
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); return w.navigate(target).catch(() => {}); }
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الصوت
  if ((url.hostname.endsWith('mp3quran.net') || url.hostname === 'download.quranicaudio.com' || url.hostname === 'everyayah.com') && url.pathname.endsWith('.mp3')) {
    event.respondWith(audioResponse(req));
    return;
  }

  // توقيت الآيات: كاش أولًا (صغير، يُحفظ عند أول تشغيل ليعمل التظليل بدون إنترنت)
  if ((url.hostname.endsWith('mp3quran.net') && url.pathname.includes('/ayat_timing')) || (url.hostname === 'api.quran.com' && url.pathname.includes('/chapter_recitations/'))) {
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
    const scope = new URL(self.registration.scope);
    const isShell = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
    if (isShell) {
      // واجهة التطبيق: من الكاش (يعمل بدون إنترنت)
      event.respondWith((async () => {
        const cache = await caches.open(APP_CACHE);
        return (await cache.match('index.html')) || (await cache.match('./')) || fetch(req);
      })().catch(() => fetch(req)));
    } else {
      // صفحات السور الثابتة وغيرها: الشبكة أولًا ثم الكاش
      event.respondWith((async () => {
        const cache = await caches.open('pages-v1');
        try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
        catch { return (await cache.match(req)) || Response.error(); }
      })());
    }
    return;
  }

  // باقي الملفات: كاش أولًا ثم الشبكة (البيانات الإضافية في كاشها المستقل)
  event.respondWith((async () => {
    const cache = await caches.open(isExtra(url.pathname) ? EXTRAS_CACHE : APP_CACHE);
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
