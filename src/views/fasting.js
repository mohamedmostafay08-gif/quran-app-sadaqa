// متابعة الصيام: تسجيل الأيام التي صمتها (تطوع أو قضاء أو فريضة) في شبكة شهرية،
// مع تمييز الاثنين والخميس والأيام البيض، وربط القضاء بحاسبة «قضاء الفوائت»
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';
import { dayKey } from '../features/activity.js';
import { hijri } from '../features/prayer.js';

export const KINDS = [['nafl', 'تطوع'], ['qada', 'قضاء'], ['fard', 'فريضة']];
const LABEL = Object.fromEntries(KINDS);
// من hijri() نفسها حتى يُطبَّق «تعديل التاريخ الهجري» الذي اختاره المستخدم
const hijriDay = (d) => hijri(d)?.day || 0;
const isRamadan = (d) => hijri(d)?.month === 9;
/** سبب استحباب صيام اليوم (أو null) */
export function sunnahReason(d = new Date()) {
  const hd = hijriDay(d), wd = d.getDay();
  if (hd >= 13 && hd <= 15) return 'من الأيام البيض';
  if (wd === 1) return 'يوم الاثنين';
  if (wd === 4) return 'يوم الخميس';
  return null;
}
const log = () => settings.get('fastLog') || {};

/** يسجّل صيام يوم أو يلغيه، ويخصم القضاء من «قضاء الفوائت» إن وُجد */
export async function setFast(key, kind) {
  const l = { ...log() };
  const prev = l[key] && l[key] !== 'none' ? l[key] : null;
  if (kind) l[key] = kind; else l[key] = 'none'; // «none» بدل الحذف حتى تنتقل الإزالة عند المزامنة
  await settings.set('fastLog', l);
  const q = settings.get('qada');
  if (q?.total?.fast && (prev === 'qada') !== (kind === 'qada')) {
    const d = kind === 'qada' ? -1 : 1;
    const left = Math.min(q.total.fast, Math.max(0, (q.left?.fast || 0) + d));
    await settings.set('qada', { ...q, left: { ...q.left, fast: left } });
  }
}

/** بطاقة «اليوم» في أيام السنة المؤكدة، أو إذا سجلت صيامك */
export function fastingTodayCard() {
  const now = new Date(), key = dayKey(now), cur = log()[key];
  const why = sunnahReason(now);
  if (isRamadan(now) || (!why && (!cur || cur === 'none'))) return null;
  const done = cur && cur !== 'none';
  return h('section.td-friday.fast-today',
    h('span.td-ic', icon('moon')),
    h('span.td-pt', h('strong', done ? `صائم اليوم (${LABEL[cur]}) ✓` : `يُستحب صيامه: ${why}`), h('small', done ? 'تقبّل الله صيامك' : 'هل أنت صائم اليوم؟')),
    done ? h('a.btn.ghost', { href: '#/fasting' }, 'سجلّي')
      : h('button.btn', { type: 'button', onclick: async (e) => { await setFast(key, 'nafl'); toast('تقبّل الله صيامك'); e.currentTarget.closest('section').replaceWith(fastingTodayCard() || ''); } }, 'نعم، صائم'));
}

export function renderFasting(_p, query = {}) {
  const base = new Date(); base.setDate(1);
  const off = +query.m || 0;
  base.setMonth(base.getMonth() + off);
  const y = base.getFullYear(), m = base.getMonth();
  const l = log();
  const days = new Date(y, m + 1, 0).getDate();
  const first = new Date(y, m, 1).getDay(); // ٠ = الأحد
  const monthName = base.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const inMonth = Object.entries(l).filter(([k, v]) => v !== 'none' && k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`));
  const yearCount = Object.entries(l).filter(([k, v]) => v !== 'none' && k.startsWith(String(y))).length;
  const todayKey = dayKey();
  const cell = (d) => {
    const date = new Date(y, m, d), key = dayKey(date), v = l[key] && l[key] !== 'none' ? l[key] : null;
    const why = sunnahReason(date);
    const future = key > todayKey;
    return h('button', {
      type: 'button', class: `fs-day${v ? ' on ' + v : ''}${why ? ' sunnah' : ''}${key === todayKey ? ' today' : ''}`, disabled: future,
      'aria-label': `${date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}${v ? '، ' + LABEL[v] : ''}${why ? '، ' + why : ''}`,
      onclick: async () => { const order = [null, 'nafl', 'qada', 'fard']; await setFast(key, order[(order.indexOf(v) + 1) % order.length]); dispatchEvent(new HashChangeEvent('hashchange')); },
    }, h('span', ar(d)), v ? h('small', LABEL[v]) : null);
  };
  const q = settings.get('qada');
  mount(h('div.fasting-page',
    topbar({ title: 'متابعة الصيام', back: '#/' }),
    h('section.card.qd-hero', h('strong', ar(inMonth.length)), h('span', `يومًا صمتها في ${monthName}`), h('small.muted', `هذا العام: ${ar(yearCount)}`)),
    h('div.fs-nav',
      h('a.icon-btn', { href: `#/fasting?m=${off - 1}`, 'aria-label': 'الشهر السابق' }, icon('forward')),
      h('strong', monthName),
      off < 0 ? h('a.icon-btn', { href: `#/fasting?m=${off + 1}`, 'aria-label': 'الشهر التالي' }, icon('back')) : h('span.icon-btn', { 'aria-hidden': 'true' })),
    h('div.fs-grid', { role: 'group', 'aria-label': 'أيام الشهر' },
      ...['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((d) => h('span.fs-wd', { 'aria-hidden': 'true' }, d)),
      ...Array.from({ length: first }, () => h('span')),
      ...Array.from({ length: days }, (_, i) => cell(i + 1))),
    h('p.small-note', 'اضغط على اليوم: تطوع ← قضاء ← فريضة ← إلغاء. الأيام المنقوطة يُستحب صيامها.'),
    q?.total?.fast ? h('a.row-btn', { href: '#/qada' }, h('span', h('strong', 'قضاء الصيام'), h('small', `باقٍ ${ar(q.left?.fast || 0)} من ${ar(q.total.fast)} — يُخصم تلقائيًا عند تسجيل «قضاء»`)), icon('forward')) : null,
  ));
}
