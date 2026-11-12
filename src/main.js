// نقطة البداية: تجهيز البيانات، الإعدادات، الراوتر، والـ Service Worker
import { initData } from './data.js';
import { loadSettings, get as getSetting } from './state.js';
import { route, start } from './router.js';
import { loadReciters, player } from './audio/player.js';
import { mountPlayerBar } from './audio/playerBar.js';
import { initAutoDownload } from './offline/autoDownload.js';
import { renderQuran } from './views/home.js';
import { renderToday } from './views/today.js';
import { renderHelp } from './views/help.js';
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
import { renderGroups, renderGroup } from './views/group.js';
import { renderRadio } from './views/radio.js';
import { renderListen, renderMore } from './views/listen.js';
import { renderLibrary, renderTopic, renderHadith, renderGuide, renderSahabi } from './views/library.js';
import { initInstall, isStandalone } from './features/install.js';
import { track } from './features/stats.js';
import { refreshPush } from './features/push.js';
import { initAdhanScheduler, playAdhan } from './features/adhan.js';
import { h } from './lib/dom.js';
import { toast, closeAllSheets } from './ui.js';

const TAB_FOR = { '/': 'today', '/quran': 'quran', '/surah': 'quran', '/page': 'quran', '/search': 'quran', '/bookmarks': 'quran', '/khatma': 'quran', '/memorize': 'quran', '/group': 'quran', '/listen': 'listen', '/radio': 'listen', '/car': 'listen', '/downloads': 'more', '/library': 'more', '/hadith': 'more', '/guide': 'more', '/sahabi': 'more', '/prayer': 'prayer', '/adhkar': 'prayer', '/more': 'more', '/settings': 'more', '/about': 'more', '/help': 'more' };

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

  route('/', renderToday);
  route('/quran', renderQuran);
  route('/help', renderHelp);
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
  route('/group', renderGroups);
  route('/group/:id', renderGroup);
  route('/radio', renderRadio);
  route('/listen', renderListen);
  route('/more', renderMore);
  route('/library', renderLibrary);
  route('/library/:topic', renderTopic);
  route('/hadith/:topic/:id', renderHadith);
  route('/guide/:id', renderGuide);
  route('/sahabi/:i?', renderSahabi);


  // أول فتح: شاشة الترحيب
  if (!getSetting('onboarded') && (!location.hash || location.hash === '#/' || location.hash === '#')) history.replaceState(null, '', '#/welcome');

  mountPlayerBar();
  player.restore(getSetting('lastListen'));
  initAutoDownload();
  initKhatmaAutoRecord();
  initInstall();
  track(isStandalone() ? 'open_installed' : 'open');
  refreshPush();
  initAdhanScheduler();
  // ضغطة على تنبيه الأذان والتطبيق مفتوح: يصل طلب التشغيل من عامل الخدمة
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'adhan') playAdhan(e.data.key); });
  player.subscribe((st) => { if (st.status === 'playing') track('listen'); });
  const ROUTE_EVENT = { surah: 'read', page: 'pages', prayer: 'prayer', group: 'group', memorize: 'memorize', sahabi: 'library', guide: 'library' };

  start((m) => {
    // أي انتقال يغلق الأوراق السفلية المفتوحة (مثل زر الرجوع في الموبايل)
    closeAllSheets();
    const base = '/' + (m.path.split('/')[1] || '');
    const tab = TAB_FOR[base] || 'today';
    for (const a of document.querySelectorAll('.tabbar a')) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    document.body.dataset.route = base.slice(1) || 'home';
    if (ROUTE_EVENT[base.slice(1)]) track(ROUTE_EVENT[base.slice(1)]);
  });
}

// نسخة جديدة فعّلت نفسها: نعرض زر «حدّث الآن» (لا نعيد التحميل تلقائيًا حتى لا نقطع القراءة أو التلاوة)
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // فحص التحديثات عند العودة للتطبيق وكل ساعة
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 3600000);
  }).catch((e) => console.warn('SW registration failed', e));
}

function showUpdateBanner() {
  if (document.querySelector('.update-banner')) return;
  const bar = h('div.install-banner.update-banner', { role: 'status' },
    h('img', { src: 'public/icons/icon-192.png', alt: '', width: 40, height: 40 }),
    h('div.ib-text', h('strong', 'نسخة جديدة من «رتّل» جاهزة'), h('small', 'حدّث التطبيق لتحصل على آخر التحسينات')),
    h('button.btn.ib-go', { type: 'button', onclick: () => location.reload() }, 'حدّث الآن'),
    h('button.icon-btn.ib-close', { type: 'button', 'aria-label': 'لاحقًا', onclick: () => bar.remove() }, '✕'),
  );
  document.body.append(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
}

addEventListener('online', () => toast('عاد الاتصال بالإنترنت'));
addEventListener('offline', () => toast('أنت الآن بدون إنترنت — النص متاح بالكامل'));

boot();
// تسجيل الـ SW بعد اكتمال التحميل حتى لا ينافس الكاش المسبق ظهور الواجهة
if (document.readyState === "complete") setTimeout(registerSW, 1500);
else addEventListener("load", () => setTimeout(registerSW, 1500));
