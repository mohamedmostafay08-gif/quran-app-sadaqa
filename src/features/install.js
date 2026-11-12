// اقتراح تثبيت التطبيق على الشاشة الرئيسية
// أندرويد/كروم/إيدج/سامسونج: نافذة التثبيت الرسمية (beforeinstallprompt)
// آيفون/آيباد: لا توجد نافذة رسمية، فنعرض الخطوات (مشاركة ← إضافة إلى الشاشة الرئيسية)
import { h, icon } from '../lib/dom.js';
import { sheet, toast } from '../ui.js';

let deferred = null;
const KEY = 'qa:install-dismissed';
const SNOOZE_DAYS = 7;

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ua = navigator.userAgent;
export const isIOS = () => /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => /Android|iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && innerWidth < 900);

export const canInstall = () => !isStandalone() && (!!deferred || isIOS() || isMobile());

function snoozed() {
  try { const t = +localStorage.getItem(KEY); return t && Date.now() - t < SNOOZE_DAYS * 86400000; } catch { return false; }
}
function snooze() { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ } }

let banner = null;
function hideBanner() { banner?.classList.remove('show'); setTimeout(() => { banner?.remove(); banner = null; }, 300); }

function showBanner() {
  if (banner || isStandalone() || snoozed()) return;
  if (document.body.dataset.route === 'welcome' || document.body.classList.contains('car-mode')) return;
  banner = h('div.install-banner', { role: 'dialog', 'aria-label': 'تثبيت التطبيق' },
    h('img', { src: 'public/icons/icon-192.png', alt: '', width: 44, height: 44 }),
    h('div.ib-text', h('strong', 'ثبّت «رتّل» على شاشتك'), h('small', 'يفتح كتطبيق، بدون متصفح، ويعمل بدون إنترنت')),
    h('button.btn.ib-go', { type: 'button', onclick: () => install() }, 'تثبيت'),
    h('button.icon-btn.ib-close', { type: 'button', 'aria-label': 'لاحقًا', onclick: () => { snooze(); hideBanner(); } }, icon('close')),
  );
  document.body.append(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
}

/** يبدأ التثبيت: النافذة الرسمية إن وُجدت، وإلا الخطوات */
export async function install() {
  if (deferred) {
    hideBanner();
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
    deferred = null;
    if (outcome !== 'accepted') snooze();
    return;
  }
  hideBanner();
  instructionsSheet();
}

function instructionsSheet() {
  const step = (n, content) => h('li', h('span.ib-n', n), h('div', content));
  const shareIcon = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ib-ico');
    s.innerHTML = '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/>';
    return s;
  };
  const addIcon = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ib-ico');
    s.innerHTML = '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>';
    return s;
  };
  const ios = isIOS();
  sheet({
    title: 'ثبّت «رتّل» على الشاشة الرئيسية',
    content: () => h('div',
      h('ol.ib-steps', ios ? [
        step('١', [h('span', 'اضغط زر المشاركة '), shareIcon(), h('span', ' أسفل الشاشة في Safari (أو أعلاها في iPad).')]),
        step('٢', [h('span', 'انزل واختر '), addIcon(), h('strong', ' «إضافة إلى الشاشة الرئيسية»'), h('span', '.')]),
        step('٣', [h('span', 'اضغط '), h('strong', '«إضافة»'), h('span', '، وستجد أيقونة «رتّل» مع تطبيقاتك.')]),
      ] : [
        step('١', [h('span', 'افتح قائمة المتصفح '), icon('more'), h('span', ' (النقاط الثلاث أعلى الشاشة).')]),
        step('٢', [h('span', 'اختر '), h('strong', '«تثبيت التطبيق»'), h('span', ' أو '), h('strong', '«إضافة إلى الشاشة الرئيسية»'), h('span', '.')]),
        step('٣', [h('span', 'وافق، وستجد أيقونة «رتّل» مع تطبيقاتك.')]),
      ]),
      ios && !/Safari/.test(ua) ? h('p.notice', 'إذا لم يظهر الخيار، فافتح الموقع من Safari.') : null,
      h('p.small-note', 'يفتح التطبيق المثبّت في شاشة كاملة، ويعمل بدون إنترنت، ولا يحتاج إلى متجر تطبيقات.'),
    ),
  });
}

export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    setTimeout(showBanner, 4000);
  });
  addEventListener('appinstalled', () => { deferred = null; hideBanner(); toast('تم تثبيت «رتّل»، تجده مع تطبيقاتك'); });
  // آيفون وأي موبايل لا يدعم النافذة الرسمية: نعرض البانر بعد قليل
  if (!isStandalone() && (isIOS() || isMobile())) setTimeout(() => { if (!deferred) showBanner(); }, 6000);
}
