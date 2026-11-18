// خطة الحفظ: تختار جزءًا أو سورة وعدد الآيات يوميًا، فيظهر لك ورد كل يوم وموعد الإتمام المتوقع.
// ما تحفظه يُضاف تلقائيًا إلى جدول المراجعة.
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';
import { getSurahs, getSurahMeta, globalIndex, fromGlobal, juzStart, TOTAL_AYAHS } from '../data.js';
import * as srs from '../features/srs.js';
import { dayKey } from '../features/activity.js';

const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));

/** مقاطع الخطة: [{s, from, to}] بترتيب الحفظ */
function segments(plan) {
  let g0, g1;
  if (plan.kind === 'juz') {
    const a = juzStart(plan.n); g0 = globalIndex(a.surah, a.ayah);
    if (plan.n < 30) { const b = juzStart(plan.n + 1); g1 = globalIndex(b.surah, b.ayah) - 1; } else g1 = TOTAL_AYAHS - 1;
  } else { g0 = globalIndex(plan.n, 1); g1 = globalIndex(plan.n, getSurahMeta(plan.n).ayahCount); }
  const segs = [];
  for (let g = g0; g <= g1;) {
    const { surah, ayah } = fromGlobal(g);
    const end = Math.min(g1, globalIndex(surah, getSurahMeta(surah).ayahCount));
    segs.push({ s: surah, from: ayah, to: ayah + (end - g) });
    g = end + 1;
  }
  return plan.reverse ? segs.reverse() : segs;
}
const total = (plan) => segments(plan).reduce((n, x) => n + x.to - x.from + 1, 0);

/** ورد اليوم: الآيات التالية بعد ما حُفظ (لا يتجاوز نهاية السورة) */
export function portion(plan) {
  let skip = plan.done || 0;
  for (const x of segments(plan)) {
    const len = x.to - x.from + 1;
    if (skip >= len) { skip -= len; continue; }
    const from = x.from + skip;
    return { s: x.s, from, to: Math.min(x.to, from + plan.perDay - 1) };
  }
  return null;
}
const title = (plan) => (plan.kind === 'juz' ? `الجزء ${ar(plan.n)}` : `سورة ${getSurahMeta(plan.n).nameAr}`);
const range = (p) => `سورة ${getSurahMeta(p.s).nameAr}: ${p.from === p.to ? `آية ${ar(p.from)}` : `${ar(p.from)}–${ar(p.to)}`}`;

/** بطاقة «اليوم» لمن عنده خطة لم ينجز وردها اليوم */
export function hifzTodayCard() {
  const plan = settings.get('hifzPlan');
  if (!plan || plan.days?.[dayKey()]) return null;
  const p = portion(plan);
  if (!p) return null;
  return h('a.td-friday', { href: '#/hifz' },
    h('span.td-ic', icon('lamp')),
    h('span.td-pt', h('strong', 'ورد الحفظ اليوم'), h('small', range(p))),
    icon('forward'));
}

export async function renderHifz() {
  const plan = settings.get('hifzPlan');
  if (!plan) return mount(h('div.hifz-page', topbar({ title: 'خطة الحفظ', back: '#/memorize' }), setup()));
  const n = total(plan), done = Math.min(plan.done || 0, n), left = n - done;
  const p = portion(plan);
  const today = dayKey();
  const doneToday = !!plan.days?.[today];
  const finish = new Date(); finish.setDate(finish.getDate() + Math.ceil(left / plan.perDay) - (doneToday ? 0 : 1));
  const dueCount = (await srs.due().catch(() => [])).length;
  const pct = Math.round((done / n) * 100);
  const markDone = async () => {
    await srs.addRange(p.s, p.from, p.to);
    const np = { ...plan, done: done + (p.to - p.from + 1), days: { ...(plan.days || {}), [today]: true } };
    await settings.set('hifzPlan', np);
    toast(np.done >= n ? `أتممت حفظ ${title(plan)}، بارك الله فيك` : 'أحسنت؛ أُضيفت الآيات إلى جدول المراجعة');
    rerender();
  };
  mount(h('div.hifz-page',
    topbar({ title: 'خطة الحفظ', sub: title(plan), back: '#/memorize' }),
    h('section.card.qd-hero', h('strong', `${ar(pct)}٪`), h('span', `حفظت ${ar(done)} من ${ar(n)} آية`), h('div.bar', h('span', { style: { width: `${pct}%` } })),
      left ? h('small.muted', `الإتمام المتوقع: ${finish.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}`) : null),
    p ? h('section.card.hf-today',
      h('h2', doneToday ? 'ورد الغد' : 'ورد اليوم'),
      h('p.hf-range', range(p)),
      h('div.btn-row',
        h('a.btn.ghost', { href: `#/memorize?mode=practice&s=${p.s}&from=${p.from}&to=${p.to}` }, icon('repeat'), 'تدرّب عليها'),
        doneToday ? null : h('button.btn', { type: 'button', onclick: markDone }, icon('check'), 'حفظتها'))) : h('section.card', h('p', 'أتممت الخطة كلها، بارك الله فيك.')),
    dueCount ? h('a.row-btn.card', { href: '#/memorize?mode=review' }, h('span', h('strong', 'المراجعة'), h('small', `${ar(dueCount)} آية تنتظر المراجعة اليوم`)), icon('forward')) : null,
    h('div.btn-row',
      h('button.btn.ghost', { type: 'button', onclick: async () => { const np = { ...plan, perDay: plan.perDay === 1 ? 3 : plan.perDay === 3 ? 5 : plan.perDay === 5 ? 10 : 1 }; await settings.set('hifzPlan', np); rerender(); } }, `الورد: ${ar(plan.perDay)} ${plan.perDay > 2 && plan.perDay < 11 ? 'آيات' : 'آية'} يوميًا`),
      h('button.btn.ghost.danger', { type: 'button', onclick: async () => { if (confirm('إنهاء الخطة؟ ستبقى الآيات في جدول المراجعة.')) { await settings.set('hifzPlan', null); rerender(); } } }, 'إنهاء الخطة')),
  ));
}

function setup() {
  let kind = 'juz', perDay = 3;
  const juzSel = h('select', { 'aria-label': 'الجزء' }, Array.from({ length: 30 }, (_, i) => h('option', { value: String(30 - i) }, `الجزء ${ar(30 - i)}`)));
  const surSel = h('select', { 'aria-label': 'السورة', hidden: true }, getSurahs().map((s) => h('option', { value: String(s.id) }, `${ar(s.id)}. ${s.nameAr}`)));
  surSel.value = '67';
  const rev = h('input', { type: 'checkbox', checked: true });
  const revRow = h('label.hf-check', rev, h('span', 'ابدأ من آخر الجزء (من الناس صعودًا)'));
  const juzChange = () => { revRow.hidden = kind !== 'juz' || juzSel.value !== '30'; };
  juzSel.addEventListener('change', juzChange);
  const kinds = h('div.seg', { role: 'radiogroup', 'aria-label': 'ماذا تحفظ' }, [['juz', 'جزء'], ['surah', 'سورة']].map(([id, name]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(id === kind), onclick: (e) => { kind = id; juzSel.hidden = id !== 'juz'; surSel.hidden = id !== 'surah'; for (const b of kinds.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); juzChange(); },
  }, name)));
  const per = h('div.seg', { role: 'radiogroup', 'aria-label': 'آيات يوميًا' }, [1, 3, 5, 10].map((n) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(n === perDay), onclick: (e) => { perDay = n; for (const b of per.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
  }, ar(n))));
  juzChange();
  return h('section.card.form',
    h('h2', 'ماذا تريد أن تحفظ؟'), kinds, juzSel, surSel, revRow,
    h('div.field', h('span', 'كم آية يوميًا؟'), per),
    h('button.btn.block', { type: 'button', onclick: async () => {
      const n = +(kind === 'juz' ? juzSel.value : surSel.value);
      await settings.set('hifzPlan', { kind, n, perDay, reverse: kind === 'juz' && n === 30 && rev.checked, done: 0, days: {}, start: dayKey() });
      rerender();
    } }, icon('check'), 'ابدأ الخطة'));
}
