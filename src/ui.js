// مكونات واجهة مشتركة: تركيب الشاشة، الورقة السفلية، التنبيه
import { h, icon } from './lib/dom.js';

const main = () => document.getElementById('main');

/** يستبدل محتوى الشاشة */
export function mount(el, { scroll = 'top' } = {}) {
  const m = main();
  m.replaceChildren(el);
  if (scroll === 'top') window.scrollTo(0, 0);
}

/** رأس الشاشة */
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

/** ورقة سفلية (Bottom sheet) قابلة للوصول */
export function sheet({ title, content, onClose }) {
  const root = document.getElementById('sheet-root');
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (immediate) => {
    if (closed) return;
    closed = true;
    openSheets.delete(api);
    panel.classList.remove('open');
    scrim.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    if (immediate === true) wrap.remove();
    else setTimeout(() => { wrap.remove(); prevFocus?.focus?.({ preventScroll: true }); }, 200);
    onClose?.();
  };
  const api = { close };
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
