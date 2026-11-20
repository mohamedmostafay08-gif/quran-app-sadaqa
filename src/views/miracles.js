// معجزات الأنبياء: صورة تخيلية للمشهد (بلا تصوير للأنبياء أو البشر)، ونص قصير من القرآن والسنة الصحيحة
import { h, icon, ar } from '../lib/dom.js';
import { mount, topbar, empty } from '../ui.js';
import { navigate } from '../router.js';
import { storyNodes } from '../features/story.js';

let dataP = null;
export const loadMiracles = () => (dataP ||= fetch(new URL('../../public/data/library/miracles.json', import.meta.url).href)
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { dataP = null; throw e; }));
const img = (id) => new URL(`../../public/img/miracles/${id}.svg`, import.meta.url).href;

/** بطاقة معجزة (تُستخدم في القائمة وفي صفحة النبي) */
export const miracleCard = (m) => h('a.card.mr-card', { href: `#/miracles/${m.id}` },
  h('img', { src: img(m.id), alt: '', loading: 'lazy', width: 800, height: 450 }),
  h('span.mr-cap', h('strong', m.title), h('small', m.name)));

export async function renderMiracles(params) {
  let list;
  try { list = await loadMiracles(); } catch {
    return mount(h('div.miracles-page', topbar({ title: 'معجزات الأنبياء', back: '#/prophets' }), h('section.card', empty('wifiOff', 'تحتاج اتصالًا لأول مرة', ''))));
  }
  if (!params.id) {
    return mount(h('div.miracles-page',
      topbar({ title: 'معجزات الأنبياء', sub: `${ar(list.length)} معجزة كما جاءت في القرآن والسنة`, back: '#/prophets' }),
      h('p.small-note.mr-note', 'الصور تخيلية للمشهد فقط، ولا نصوّر الأنبياء ولا الملائكة.'),
      h('div.mr-grid', list.map(miracleCard))));
  }
  const i = list.findIndex((m) => m.id === params.id);
  if (i < 0) return navigate('/miracles', { replace: true });
  const m = list[i], next = list[i + 1];
  const body = await storyNodes(m);
  mount(h('div.miracles-page',
    topbar({ title: m.title, sub: m.name, back: '#/miracles' }),
    h('figure.mr-hero', h('img', { src: img(m.id), alt: `صورة تخيلية لمشهد: ${m.title}`, width: 800, height: 450 })),
    h('article.card.st-body', ...body),
    h('div.btn-row.mr-links',
      h('a.btn.ghost', { href: `#/prophets/${m.prophet}` }, icon('book'), `قصة ${m.name.replace(/ عليهما? السلام| ﷺ/, '')}`),
      next ? h('a.btn', { href: `#/miracles/${next.id}` }, next.title, icon('back')) : null)));
}
