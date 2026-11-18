// وضع التركيز: المصحف وحده بملء الشاشة، بلا أشرطة ولا رسائل جانبية، حتى تتم عدد الصفحات الذي اخترته
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { navigate } from '../router.js';
import { sheet } from '../ui.js';

let state = null; // { goal, pages: Set }
export const focusActive = () => !!state;

export function startFocus(goal, page) {
  state = { goal, pages: new Set() };
  settings.set('focusGoal', goal);
  document.body.classList.add('focus-mode', 'immersive');
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {}); } catch { /* غير مدعوم */ }
  navigate(`/page/${page}`);
}

export function endFocus() {
  if (!state) return;
  state = null;
  document.body.classList.remove('focus-mode', 'immersive');
  document.querySelector('.focus-pill')?.remove();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ }
}

/** يُستدعى من صفحات المصحف عند عرض صفحات */
export function focusPages(nums) {
  if (!state) return;
  document.body.classList.add('focus-mode', 'immersive');
  const before = state.pages.size;
  nums.forEach((p) => state.pages.add(p));
  const n = Math.min(state.pages.size, state.goal);
  let pill = document.querySelector('.focus-pill');
  if (!pill) {
    pill = h('div.focus-pill', { role: 'status' }, h('span'), h('button', { type: 'button', 'aria-label': 'إنهاء وضع التركيز', onclick: () => { endFocus(); navigate('/quran'); } }, icon('close')));
    document.body.append(pill);
  }
  pill.firstChild.textContent = `${ar(n)} / ${ar(state.goal)}`;
  if (before < state.goal && state.pages.size >= state.goal) {
    const goal = state.goal;
    sheet({ title: 'أتممت وردك', content: (close) => h('div',
      h('p', `قرأت ${goal === 2 ? 'صفحتين' : `${ar(goal)} ${goal > 2 && goal < 11 ? 'صفحات' : 'صفحة'}`} بتركيز، تقبّل الله منك.`),
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: () => { close(); state.goal += goal; focusPages([]); } }, 'أكمل القراءة'),
        h('button.btn.ghost', { type: 'button', onclick: () => { close(); endFocus(); navigate('/'); } }, 'إنهاء'))) });
  }
}

/** صفحة البدء: اختر عدد الصفحات */
export function renderFocus() {
  import('../ui.js').then(({ mount, topbar }) => import('../data.js').then(({ pageOf }) => {
    let goal = settings.get('focusGoal') || 5;
    const last = settings.get('lastRead');
    const page = last ? pageOf(last.surah, last.ayah || 1) : 1;
    const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'عدد الصفحات' }, [2, 5, 10, 20].map((n) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(n === goal), onclick: (e) => { goal = n; for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
    }, ar(n))));
    mount(h('div.focus-page',
      topbar({ title: 'وضع التركيز', back: '#/quran' }),
      h('section.card.form',
        h('p.fc-lead', 'المصحف وحده بملء الشاشة، بلا أزرار ولا رسائل، حتى تُتم وردك.'),
        h('div.field', h('span', 'كم صفحة تقرأ؟'), seg),
        h('p.muted', `تبدأ من الصفحة ${ar(page)}${last ? ' حيث توقفت' : ''}.`),
        h('button.btn.block', { type: 'button', onclick: () => startFocus(goal, page) }, icon('book'), 'ابدأ'))));
  }));
}
