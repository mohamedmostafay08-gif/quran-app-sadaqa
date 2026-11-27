// الإذاعة: بث مباشر لإذاعة القرآن الكريم من القاهرة والسعودية، وإذاعات القراء والبرامج
import { h, icon, ar } from '../lib/dom.js';
import { normalize } from '../lib/arabic.js';
import { player } from '../audio/player.js';
import { mount, topbar, empty } from '../ui.js';
import { track } from '../features/stats.js';

let dataP = null;
const load = () => (dataP ||= fetch(new URL('../../public/data/radios.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { dataP = null; throw e; }));

export async function renderRadio() {
  track('radio');
  let data;
  try { data = await load(); } catch {
    mount(h('div', topbar({ title: 'الإذاعة', back: '#/listen' }), h('section.card', empty('radio', 'الإذاعة تحتاج اتصالًا بالإنترنت', 'البث المباشر لا يعمل بدون إنترنت.'))));
    return;
  }
  // الصفوف تُبنى مرة واحدة؛ تحديثات المشغّل تغيّر الصف القديم والجديد فقط، فلا يضيع التمرير ولا التركيز
  const rows = new Map();
  const paint = (ref) => {
    const st = player.state();
    const on = st.radio?.id === ref.r.id;
    const playing = on && (st.status === 'playing' || st.status === 'loading');
    const mode = !on ? 'off' : st.status;
    if (mode === ref.mode) return;
    ref.mode = mode;
    ref.li.classList.toggle('on', on);
    ref.btn.setAttribute('aria-pressed', String(playing));
    ref.ic.replaceChildren(playing ? h('span.eq', h('i'), h('i'), h('i')) : icon('play'));
    if (on && st.status === 'playing') ref.btn.append(ref.live); else ref.live.remove();
  };
  const row = (r, big) => {
    const ic = h('span.ri-icon', { 'aria-hidden': 'true' });
    const btn = h('button', { type: 'button', dataset: { id: r.id }, onclick: () => (player.state().radio?.id === r.id ? player.toggle() : player.playRadio(r)) },
      ic, h('span.ri-text', h('strong', r.name), r.sub ? h('small', r.sub) : null));
    const ref = { r, btn, ic, li: h('li', { class: `radio-item${big ? ' big' : ''}` }, btn), live: h('span.live-dot', 'مباشر'), text: normalize(r.name + ' ' + (r.sub || '')), mode: null };
    rows.set(r.id, ref);
    paint(ref);
    return ref.li;
  };
  const featured = h('ul.radio-list.featured', data.featured.map((r) => row(r, true)));
  const list = h('ul.radio-list', data.reciters.map((r) => row(r)));
  const programs = h('ul.radio-list', data.programs.map((r) => row(r)));
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن قارئ أو برنامج…', 'aria-label': 'ابحث في الإذاعات' });
  const filter = () => {
    const q = normalize(input.value);
    for (const ref of rows.values()) ref.li.hidden = !!q && !ref.text.includes(q);
    for (const ul of [featured, list, programs]) if (ul.previousElementSibling) ul.previousElementSibling.hidden = ![...ul.children].some((li) => !li.hidden);
  };
  input.addEventListener('input', filter);
  let lastId = player.state().radio?.id;
  const unsub = player.subscribe((st) => {
    const id = st.radio?.id;
    if (lastId !== id && rows.has(lastId)) paint(rows.get(lastId));
    if (rows.has(id)) paint(rows.get(id));
    lastId = id;
  });
  mount(h('div.radio-page',
    topbar({ title: 'الإذاعة', sub: 'بث مباشر على مدار الساعة', back: '#/listen' }),
    h('div.radio-search', input),
    h('h2.radio-h', 'الإذاعات'), featured,
    h('h2.radio-h', `إذاعات القراء (${ar(data.reciters.length)})`), list,
    h('h2.radio-h', 'برامج'), programs,
  ));
  return { cleanup: unsub };
}
