// مكونات واجهة مشتركة: تركيب الشاشة، الورقة السفلية، التنبيه
import { h, icon, ar } from './lib/dom.js';

const main = () => document.getElementById('main');

/** يستبدل محتوى الشاشة */
// عدد مرات عرض المحتوى: يمنع شاشة التحميل من الظهور فوق محتوى عُرض بالفعل
export let mountCount = 0;
export function mount(el, { scroll = 'top' } = {}) {
  const m = main();
  mountCount++;
  // حركة دخول خفيفة (تُلغى مع «تقليل الحركة»)
  if (el?.classList && !m.querySelector('.skeleton')) el.classList.add('page-in');
  m.replaceChildren(el);
  if (scroll === 'top') window.scrollTo(0, 0);
}

/** رأس الشاشة */
/** «الجزء ١٥ · الحزب ٢٩ · الربع ٢ · ص ٢٩٤» */
export const posText = (p) => `الجزء ${ar(p.juz)} · الحزب ${ar(p.hizb)} · الربع ${ar(p.rub)} · ص ${ar(p.page)}`;

export function topbar({ title, sub, back, actions = [] }) {
  return h('header.topbar',
    back ? h('a.icon-btn', { href: back, 'aria-label': 'رجوع' }, icon('back')) : null,
    h('div.topbar-title', h('h1', title), sub ? h('p', sub) : null),
    h('div.topbar-actions', actions),
  );
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const openSheets = new Set();
/** يغلق كل الأوراق فورًا (عند الانتقال بين الشاشات) */
export function closeAllSheets() {
  for (const s of [...openSheets]) s.close(true);
}

let _ignorePopstate = 0;
let _sheetPopstateReady = false;
function initSheetPopstate() {
  if (_sheetPopstateReady) return;
  _sheetPopstateReady = true;
  // زر الرجوع في أندرويد: إذا كانت هناك ورقة مفتوحة، أغلقها بدل التنقل
  addEventListener('popstate', () => {
    if (_ignorePopstate > 0) { _ignorePopstate--; return; }
    const top = [...openSheets].at(-1);
    if (top) { top._fromBack = true; top.close(); }
  });
}

/** ورقة سفلية (Bottom sheet) قابلة للوصول */
export function sheet({ title, content, onClose }) {
  initSheetPopstate();
  const root = document.getElementById('sheet-root');
  const prevFocus = document.activeElement;
  let closed = false;
  let _hasPushed = false;
  const close = (immediate) => {
    if (closed) return;
    closed = true;
    openSheets.delete(api);
    panel.classList.remove('open');
    scrim.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    // إذا فتحنا إدخالًا في السجل وأُغلقت الورقة بغير زر الرجوع، أزل الإدخال بصمت
    if (_hasPushed && !api._fromBack && immediate !== true) {
      _hasPushed = false;
      _ignorePopstate++;
      history.back();
    }
    if (immediate === true) wrap.remove();
    else setTimeout(() => { wrap.remove(); prevFocus?.focus?.({ preventScroll: true }); }, 200);
    onClose?.();
  };
  const api = { close, _fromBack: false };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const scrim = h('div.scrim', { onclick: () => close() });
  const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'قائمة' },
    h('div.sheet-handle', { 'aria-hidden': 'true' }),
    title ? h('div.sheet-head', h('h2', title), h('button.icon-btn', { onclick: () => close(), 'aria-label': 'إغلاق' }, icon('close'))) : null,
    h('div.sheet-body', typeof content === 'function' ? content(close) : content),
  );
  const wrap = h('div', scrim, panel);
  root.append(wrap);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    scrim.classList.add('open');
    panel.classList.add('open');
    // أضف إدخالًا للسجل حتى يُغلق زر الرجوع في أندرويد الورقة بدل التنقل للخلف
    history.pushState({ _qaSheet: true }, '', location.href);
    _hasPushed = true;
    (panel.querySelector('.sheet-body button, .sheet-body input, .sheet-body a') || panel).focus?.({ preventScroll: true });
  });
  openSheets.add(api);
  api.panel = panel;
  return api;
}

/** صف إجراء داخل الورقة */
export function actionRow(iconName, label, onclick, extra) {
  return h('button.action-row', { type: 'button', onclick }, icon(iconName), h('span', label), extra || null);
}

/** حالة فارغة */
export function empty(iconName, title, text, action) {
  return h('div.empty', icon(iconName), h('h2', title), text ? h('p', text) : null, action || null);
}

/** هيكل تحميل مؤقت يظهر إذا تأخرت الشاشة */
export function showSkeleton() {
  const bar = (w, hgt = 14) => h('span.sk', { style: `width:${w};height:${hgt}px` });
  main().replaceChildren(h('div.skeleton', { 'aria-busy': 'true', 'aria-label': 'جارٍ التحميل' },
    h('div.sk-top', bar('40%', 20), bar('22%', 12)),
    h('div.sk-card', bar('30%', 12), bar('70%', 22), bar('50%', 12)),
    ...[0, 1, 2, 3].map(() => h('div.sk-row', h('span.sk.sk-dot'), h('div', bar('55%', 14), bar('35%', 10)))),
  ));
}

/** خطأ غير متوقع في شاشة: رسالة واضحة مع إعادة المحاولة بدل هيكل تحميل لا ينتهي */
export function showError() {
  main().replaceChildren(h('section.card', { style: 'margin-top:var(--sp-5)' }, empty('info', 'تعذّر فتح هذه الشاشة', navigator.onLine ? 'حدث خطأ غير متوقع.' : 'قد تحتاج اتصالًا بالإنترنت.',
    h('div.btn-row', h('button.btn', { type: 'button', onclick: () => dispatchEvent(new HashChangeEvent('hashchange')) }, 'إعادة المحاولة'), h('a.btn.ghost', { href: '#/' }, 'الرئيسية')))));
}
