// الأربعون النووية: قراءة بالترتيب، وتعليم ما حفظته، واختبار نفسك بإخفاء النص
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast, empty } from '../ui.js';
import { navigate } from '../router.js';

let dataP = null;
const load = () => (dataP ||= fetch(new URL('../../public/data/library/nawawi.json', import.meta.url).href)
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { dataP = null; throw e; }));
const memo = () => settings.get('nawawi') || {};

export async function renderNawawi(params) {
  let data;
  try { data = await load(); } catch {
    return mount(h('div.library', topbar({ title: 'الأربعون النووية', back: '#/library' }),
      h('section.card', empty('wifiOff', 'تحتاج اتصالًا لأول مرة', 'بعد أول فتح تعمل بدون إنترنت.'))));
  }
  const items = data.items;
  if (params.n) return detail(items, +params.n);
  const done = memo(), n = items.filter((x) => done[x.n]).length;
  const pct = Math.round((n / items.length) * 100);
  const nextUp = items.find((x) => !done[x.n]);
  mount(h('div.library.nw-page',
    topbar({ title: 'الأربعون النووية', sub: 'للإمام النووي رحمه الله', back: '#/library' }),
    h('section.card.qd-hero', h('strong', `${ar(n)} من ${ar(items.length)}`), h('span', n ? 'حديثًا حفظته' : 'ابدأ بحفظ حديث كل يوم'),
      h('div.bar', h('span', { style: { width: `${pct}%` } })),
      nextUp ? h('a.btn', { href: `#/nawawi/${nextUp.n}` }, n ? 'تابع الحفظ' : 'ابدأ بالحديث الأول') : h('span', 'أتممت حفظها، بارك الله فيك')),
    h('ol.nw-list', items.map((x) => h('li', h('a.card.nw-item', { href: `#/nawawi/${x.n}` },
      h('span.nw-num', ar(x.n)),
      h('span.nw-title', x.title),
      done[x.n] ? h('span.nw-done', { 'aria-label': 'محفوظ' }, icon('check')) : null)))),
  ));
}

function detail(items, num) {
  const i = items.findIndex((x) => x.n === num);
  if (i < 0) return navigate('/nawawi', { replace: true });
  const x = items[i], prev = items[i - 1], next = items[i + 1];
  const text = h('p.hd-text', { lang: 'ar' }, x.text);
  let hidden = false;
  const hideBtn = h('button.pb-chip', { type: 'button', 'aria-pressed': 'false', onclick: () => {
    hidden = !hidden; text.classList.toggle('nw-hide', hidden); hideBtn.setAttribute('aria-pressed', String(hidden));
    hideBtn.lastChild.textContent = hidden ? 'أظهر النص' : 'اختبر نفسك';
  } }, icon('eye'), h('span', 'اختبر نفسك'));
  const isDone = () => !!memo()[x.n];
  const doneBtn = h('button.btn.block', { type: 'button', onclick: async () => {
    const m = { ...memo() };
    if (m[x.n]) delete m[x.n]; else m[x.n] = new Date().toISOString().slice(0, 10);
    await settings.set('nawawi', m);
    paint();
    if (m[x.n]) toast(next ? 'أحسنت، حفظك الله' : 'بارك الله فيك');
  } });
  const paint = () => { doneBtn.replaceChildren(icon('check'), isDone() ? 'حفظته، الحمد لله' : 'حفظته'); doneBtn.setAttribute('aria-pressed', String(isDone())); doneBtn.classList.toggle('ghost', isDone()); };
  paint();
  const copyTxt = `${x.text}\n\n[${x.by}]\nمن الأربعين النووية — تطبيق «رتّل»`;
  const share = () => (navigator.share ? navigator.share({ text: copyTxt }).catch(() => {}) : navigator.clipboard.writeText(copyTxt).then(() => toast('تم نسخ الحديث'), () => toast('تعذر النسخ')));
  const go = (y) => (e) => { e.preventDefault(); navigate(`/nawawi/${y.n}`, { replace: true }); };
  mount(h('div.library.hd-page',
    topbar({ title: `الحديث ${ar(x.n)}`, sub: x.title, back: '#/nawawi' }),
    h('article.hd-card', text,
      h('div.hd-badges', h('span.hd-badge', x.by), h('span.hd-badge.hd-grade', x.grade)),
      h('div.hd-actions', hideBtn, h('button.pb-chip', { type: 'button', onclick: share }, icon('share'), h('span', 'مشاركة')))),
    doneBtn,
    h('nav.surah-nav', { 'aria-label': 'الأحاديث المجاورة' },
      prev ? h('a.btn.ghost', { href: `#/nawawi/${prev.n}`, onclick: go(prev) }, icon('back'), 'السابق') : h('span'),
      next ? h('a.btn.ghost', { href: `#/nawawi/${next.n}`, onclick: go(next) }, 'التالي', icon('forward')) : h('span')),
  ));
}
