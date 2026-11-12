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
  const row = (r, big) => {
    const st = player.state();
    const on = st.radio?.id === r.id;
    const playing = on && (st.status === 'playing' || st.status === 'loading');
    return h('li', { class: `radio-item${big ? ' big' : ''}${on ? ' on' : ''}` },
      h('button', { type: 'button', 'aria-pressed': String(playing), dataset: { id: r.id }, onclick: () => (on ? player.toggle() : player.playRadio(r)) },
        h('span.ri-icon', { 'aria-hidden': 'true' }, playing ? h('span.eq', h('i'), h('i'), h('i')) : icon('play')),
        h('span.ri-text', h('strong', r.name), r.sub ? h('small', r.sub) : null),
        on && st.status === 'playing' ? h('span.live-dot', 'مباشر') : null,
      ));
  };
  const featured = h('ul.radio-list.featured');
  const list = h('ul.radio-list');
  const programs = h('ul.radio-list');
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن قارئ أو برنامج…', 'aria-label': 'ابحث في الإذاعات' });
  const draw = () => {
    const q = normalize(input.value);
    const match = (r) => !q || normalize(r.name + ' ' + (r.sub || '')).includes(q);
    featured.replaceChildren(...data.featured.filter(match).map((r) => row(r, true)));
    list.replaceChildren(...data.reciters.filter(match).map((r) => row(r)));
    programs.replaceChildren(...data.programs.filter(match).map((r) => row(r)));
    for (const ul of [featured, list, programs]) ul.previousElementSibling && (ul.previousElementSibling.hidden = !ul.children.length);
  };
  input.addEventListener('input', draw);
  const unsub = player.subscribe(() => draw());
  draw();
  mount(h('div.radio-page',
    topbar({ title: 'الإذاعة', sub: 'بث مباشر على مدار الساعة', back: '#/listen' }),
    h('div.radio-search', input),
    h('h2.radio-h', 'الإذاعات'), featured,
    h('h2.radio-h', `إذاعات القراء (${ar(data.reciters.length)})`), list,
    h('h2.radio-h', 'برامج'), programs,
    h('p.small-note', 'البث من إذاعة القرآن الكريم ومن mp3quran.net، ويحتاج اتصالًا بالإنترنت.'),
  ));
  return { cleanup: unsub };
}
