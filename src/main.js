// نقطة البداية: تجهيز البيانات، الإعدادات، الراوتر، والـ Service Worker
import { initData } from './data.js';
import { loadSettings, get as getSetting } from './state.js';
import { route, start } from './router.js';
import { loadReciters, player } from './audio/player.js';
import { mountPlayerBar } from './audio/playerBar.js';
import { initAutoDownload } from './offline/autoDownload.js';
import { renderHome } from './views/home.js';
import { renderReader } from './views/reader.js';
import { renderSearch } from './views/search.js';
import { renderBookmarks } from './views/bookmarks.js';
import { renderSettings } from './views/settings.js';
import { renderDownloads } from './views/downloads.js';
import { renderAbout } from './views/about.js';
import { renderKhatma, initKhatmaAutoRecord } from './views/khatma.js';
import { renderMemorize } from './views/memorize.js';
import { renderCar } from './views/car.js';
import { renderMushaf } from './views/mushaf.js';
import { renderWelcome } from './views/welcome.js';
import { renderPrayer, renderAdhkarChapter } from './views/prayer.js';
import { timeOfDay, getLocation } from './features/prayer.js';
import { h } from './lib/dom.js';
import { toast, closeAllSheets } from './ui.js';

const TAB_FOR = { '/': 'home', '/surah': 'home', '/search': 'search', '/bookmarks': 'bookmarks', '/downloads': 'settings', '/prayer': 'prayer', '/adhkar': 'prayer', '/settings': 'settings', '/about': 'settings', '/khatma': 'home', '/memorize': 'home', '/car': 'home', '/page': 'home' };

async function boot() {
  const status = document.querySelector('.boot p');
  try {
    await loadSettings();
    await Promise.all([initData((msg) => { if (status) status.textContent = msg; }), loadReciters()]);
  } catch (e) {
    console.error(e);
    document.getElementById('main').replaceChildren(h('div.boot',
      h('p', 'تعذر تحميل المصحف. تأكد من الاتصال بالإنترنت لأول مرة ثم أعد المحاولة.'),
      h('button.btn', { type: 'button', onclick: () => location.reload() }, 'إعادة المحاولة'),
    ));
    return;
  }

  route('/', renderHome);
  route('/surah/:surah/:ayah?', renderReader);
  route('/search', renderSearch);
  route('/bookmarks', renderBookmarks);
  route('/downloads', renderDownloads);
  route('/settings', renderSettings);
  route('/about', renderAbout);
  route('/khatma', renderKhatma);
  route('/memorize', renderMemorize);
  route('/car', renderCar);
  route('/page/:page', renderMushaf);
  route('/welcome', renderWelcome);
  route('/prayer', renderPrayer);
  route('/adhkar/:id', renderAdhkarChapter);

  // لون الخلفية حسب وقت الصلاة الحقيقي (لو الموقع محدد)
  const tod = () => { try { const t = timeOfDay(getLocation()); if (t) document.documentElement.dataset.tod = t; } catch { /* */ } };
  tod(); setInterval(tod, 5 * 60000);

  // أول فتح: شاشة الترحيب
  if (!getSetting('onboarded') && (!location.hash || location.hash === '#/' || location.hash === '#')) history.replaceState(null, '', '#/welcome');

  mountPlayerBar();
  player.restore(getSetting('lastListen'));
  initAutoDownload();
  initKhatmaAutoRecord();

  start((m) => {
    // أي انتقال يغلق الأوراق السفلية المفتوحة (مثل زر الرجوع في الموبايل)
    closeAllSheets();
    const base = '/' + (m.path.split('/')[1] || '');
    const tab = TAB_FOR[base] || 'home';
    for (const a of document.querySelectorAll('.tabbar a')) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    document.body.dataset.route = base.slice(1) || 'home';
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('يوجد تحديث جديد — أعد فتح التطبيق لتطبيقه', 5000);
      });
    });
  }).catch((e) => console.warn('SW registration failed', e));
}

addEventListener('online', () => toast('عاد الاتصال بالإنترنت'));
addEventListener('offline', () => toast('أنت الآن بدون إنترنت — النص متاح بالكامل'));

boot();
// تسجيل الـ SW بعد اكتمال التحميل حتى لا ينافس الكاش المسبق ظهور الواجهة
if (document.readyState === "complete") setTimeout(registerSW, 1500);
else addEventListener("load", () => setTimeout(registerSW, 1500));
