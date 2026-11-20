// نقطة البداية: تجهيز البيانات، الإعدادات، الراوتر، والـ Service Worker
import { initData } from './data.js';
import { loadSettings, get as getSetting, setPrayerNight, subscribe as onSetting } from './state.js';
import { computeTimes } from './features/prayer.js';
import { route, start, navigate } from './router.js';
import { loadReciters, player } from './audio/player.js';
import { mountPlayerBar } from './audio/playerBar.js';
import { initAutoDownload } from './offline/autoDownload.js';
import { renderQuran } from './views/home.js';
import { renderToday } from './views/today.js';
import { renderHelp } from './views/help.js';
import { renderTasbih } from './views/tasbih.js';
import { renderCalendar } from './views/calendar.js';
import { renderStats } from './views/stats.js';
import { renderDuas, renderAsma } from './views/duas.js';
import { renderQuiz } from './views/quiz.js';
import { renderRamadan } from './views/ramadan.js';
import { renderKids } from './views/kids.js';
import { renderGreetings } from './views/greetings.js';
import { renderElder } from './views/elder.js';
import { renderQada } from './views/qada.js';
import { renderWallpaper } from './views/wallpaper.js';
import { renderSleep } from './views/sleep.js';
import { renderNawawi } from './views/nawawi.js';
import { initSync } from './features/sync.js';
import { renderFocus, endFocus, focusActive } from './features/focus.js';
import { renderZakat } from './views/zakat.js';
import { renderFasting } from './views/fasting.js';
import { renderHifz } from './views/hifz.js';
import { renderTajweed } from './views/tajweed.js';
import { renderProphets } from './views/prophets.js';
import { renderLessons } from './views/lessons.js';
import { renderMiracles } from './views/miracles.js';
import { renderWhatsNew, checkWhatsNew, bannerSummary } from './features/whatsNew.js';
import { initAppBadge } from './features/appBadge.js';
import { checkBadges } from './features/badges.js';
import { initActivity } from './features/activity.js';
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
import { renderListen, renderMore, renderAdhkar } from './views/listen.js';
import { renderLibrary, renderTopic, renderHadith, renderGuide, renderSahabi } from './views/library.js';
import { initInstall, isStandalone } from './features/install.js';
import { track } from './features/stats.js';
import { refreshPush } from './features/push.js';
import { initAdhanScheduler, playAdhan } from './features/adhan.js';
import { h } from './lib/dom.js';
import { toast, closeAllSheets } from './ui.js';

const TAB_FOR = { '/': 'today', '/quran': 'quran', '/surah': 'quran', '/page': 'quran', '/search': 'quran', '/bookmarks': 'quran', '/khatma': 'quran', '/memorize': 'quran', '/group': 'quran', '/focus': 'quran', '/quiz': 'quran', '/kids': 'quran', '/tajweed': 'quran', '/hifz': 'quran', '/listen': 'tilawat', '/radio': 'tilawat', '/car': 'tilawat', '/downloads': 'tilawat', '/prayer': 'prayer', '/qada': 'prayer', '/adhkar': 'adhkar', '/dhikr': 'adhkar', '/tasbih': 'adhkar', '/duas': 'adhkar', '/asma': 'adhkar', '/more': 'more', '/settings': 'more', '/about': 'more', '/help': 'more', '/library': 'more', '/hadith': 'more', '/guide': 'more', '/sahabi': 'more', '/nawawi': 'more', '/greetings': 'more', '/elder': 'more', '/wallpaper': 'more', '/whats-new': 'more', '/lessons': 'more', '/prophets': 'more', '/miracles': 'more', '/calendar': 'today', '/stats': 'today', '/ramadan': 'today', '/sleep': 'today', '/zakat': 'today', '/fasting': 'today' };

async function boot() {
  const status = document.querySelector('.boot p');
  try {
    await loadSettings();
    await Promise.all([initData((msg) => { if (status) status.textContent = msg; }), loadReciters()]);
    await import('./offline/downloader.js').then((m) => m.initPins()).catch(() => {});
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
  route('/tasbih', renderTasbih);
  route('/calendar', renderCalendar);
  route('/stats', renderStats);
  route('/duas', renderDuas);
  route('/asma', renderAsma);
  route('/quiz', renderQuiz);
  route('/ramadan', renderRamadan);
  // اختصار أيقونة التطبيق: أكمل القراءة من آخر موضع
  route('/continue', () => { const l = getSetting('lastRead'); navigate(l ? `/surah/${l.surah}/${l.ayah}` : '/quran', { replace: true }); });
  route('/kids/:surah?', renderKids);
  route('/greetings', renderGreetings);
  route('/elder', renderElder);
  route('/qada', renderQada);
  route('/wallpaper', renderWallpaper);
  route('/sleep', renderSleep);
  route('/nawawi/:n?', renderNawawi);
  route('/focus', renderFocus);
  route('/zakat', renderZakat);
  route('/fasting', renderFasting);
  route('/hifz', renderHifz);
  route('/tajweed/:id?', renderTajweed);
  route('/prophets/:id?', renderProphets);
  route('/whats-new', renderWhatsNew);
  route('/lessons/:id?', renderLessons);
  route('/miracles/:id?', renderMiracles);
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
  route('/dhikr', renderAdhkar);
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
  initPrayerNight();
  initActivity();
  initSync();
  initAppBadge();
  checkWhatsNew().catch(() => {});
  // ضغطة على تنبيه الأذان والتطبيق مفتوح: يصل طلب التشغيل من عامل الخدمة
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'adhan') playAdhan(e.data.key); });
  player.subscribe((st) => { if (st.status === 'playing') track('listen'); });
  const ROUTE_EVENT = { surah: 'read', page: 'pages', prayer: 'prayer', group: 'group', memorize: 'memorize', sahabi: 'library', guide: 'library' };

  start((m) => {
    // أي انتقال يغلق الأوراق السفلية المفتوحة (مثل زر الرجوع في الموبايل)
    closeAllSheets();
    const base = '/' + (m.path.split('/')[1] || '');
    const tab = TAB_FOR[base] || 'today';
    for (const a of document.querySelectorAll('.tabbar > a')) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    markSubnav();
    if (focusActive() && base !== '/page') endFocus();
    clearTimeout(badgeTimer); badgeTimer = setTimeout(() => checkBadges().catch(() => {}), 1500);
    document.body.dataset.route = base.slice(1) || 'home';
    if (ROUTE_EVENT[base.slice(1)]) track(ROUTE_EVENT[base.slice(1)]);
  });
}

let badgeTimer = 0;

/** الثيم «حسب المغرب»: ليلي من المغرب حتى الفجر، ويُعاد حسابه كل دقيقة */
function initPrayerNight() {
  const update = () => {
    if (getSetting('theme') !== 'prayer') return;
    const loc = getSetting('prayerLocation');
    if (!loc) return setPrayerNight(null);
    try { const now = new Date(); const t = computeTimes(loc, now); setPrayerNight(now >= t.maghrib || now < t.fajr); } catch { setPrayerNight(null); }
  };
  update();
  setInterval(update, 60000);
  onSetting((k) => { if (k === 'theme' || k === 'prayerLocation') update(); });
}

/** القائمة الجانبية (الكمبيوتر): تمييز الصفحة الفرعية الحالية */
function markSubnav() {
  const hash = location.hash || '#/';
  const [path, qs] = hash.split('?');
  const tabQ = new URLSearchParams(qs || '').get('tab');
  for (const a of document.querySelectorAll('.tab-sub a')) {
    const [p, q] = a.getAttribute('href').split('?');
    const on = p === path && (!q || new URLSearchParams(q).get('tab') === (tabQ || (path === '#/prayer' ? sessionStorage.getItem('qa:prTab') || 'times' : null)));
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}
addEventListener('qa:nav', markSubnav);

// نسخة جديدة فعّلت نفسها:
// — إذا كان التطبيق في الخلفية عند التحديث: أعد التحميل تلقائياً فور فتحه
// — إذا كان المستخدم يستخدمه فعلياً الآن: اعرض زر «حدّث الآن» حتى لا نقطع القراءة أو التلاوة
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let wasHidden = !document.hasFocus();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') wasHidden = true; });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (wasHidden || document.visibilityState !== 'visible') location.reload();
    else showUpdateBanner();
  });
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
  const sub = h('small', 'حدّث التطبيق لتحصل على آخر التحسينات');
  bannerSummary().then((t) => { if (t) { sub.textContent = t; sub.classList.add('ib-new'); } }).catch(() => {});
  const bar = h('div.install-banner.update-banner', { role: 'status' },
    h('img', { src: 'public/icons/icon-192.png', alt: '', width: 40, height: 40 }),
    h('div.ib-text', h('strong', 'نسخة جديدة من «رتّل» جاهزة'), sub),
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
