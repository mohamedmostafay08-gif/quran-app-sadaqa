// التقرير الأسبوعي: ملخص آخر ٧ أيام من القراءة والاستماع والصلاة والأذكار والصيام والحفظ
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { lastDays, dayKey } from './activity.js';
import { FARD } from './prayerLog.js';
import * as srs from './srs.js';

export async function weekReport() {
  const days = lastDays(7);
  const keys = days.map((d) => dayKey(d.date));
  const pl = settings.get('prayerLog') || {}, al = settings.get('adhkarLog') || {}, fl = settings.get('fastLog') || {}, dl = settings.get('dhikrLog') || {};
  let prayers = 0, jamaah = 0, adhkar = 0, fasts = 0, istighfar = 0, salat = 0;
  for (const k of keys) {
    const p = pl[k] || {};
    for (const [f] of FARD) if (p[f]) { prayers++; if (p[f] === 'jamaah') jamaah++; }
    adhkar += ['sabah', 'masa', 'nawm'].filter((s) => (al[k] || {})[s]).length;
    if (fl[k] && fl[k] !== 'none') fasts++;
    istighfar += (dl[k] || {}).istighfar || 0; salat += (dl[k] || {}).salat || 0;
  }
  const since = days[0].date.setHours(0, 0, 0, 0);
  const memorized = (await srs.all().catch(() => [])).filter((x) => x.addedAt >= since).length;
  const sum = (k) => days.reduce((n, d) => n + d[k], 0);
  return { pages: sum('pages'), minutes: sum('minutes'), tasbih: sum('tasbih'), prayers, jamaah, adhkar, fasts, memorized, istighfar, salat };
}

/** صفوف التقرير (ما فيه قيمة فقط) */
export function reportRows(r) {
  return [
    ['صفحات قرأتها', r.pages], ['دقائق استماع', r.minutes], ['صلوات سجّلتها', r.prayers, `من ${ar(35)}`], ['منها في جماعة', r.jamaah],
    ['أذكار (صباح ومساء ونوم)', r.adhkar], ['آيات حفظتها', r.memorized], ['أيام صمتها', r.fasts],
    ['استغفار', r.istighfar], ['صلاة على النبي ﷺ', r.salat], ['تسبيحات', r.tasbih],
  ].filter(([, v]) => v > 0);
}

export async function shareWeek() {
  const r = await weekReport();
  const rows = reportRows(r).slice(0, 6).map(([l, v]) => [l, ar(v)]);
  const m = await import('./imageCard.js');
  m.shareImageCard({ eyebrow: 'أسبوعي مع «رتّل»', title: 'حصاد الأسبوع', rows: rows.length ? rows : [['ابدأ أسبوعك', '…']], theme: 'green', emoji: '🌿' }, 'rattil-week.png');
}

/** بطاقة الجمعة والسبت في «اليوم» */
export function weeklyCard() {
  const wd = new Date().getDay();
  if (wd !== 5 && wd !== 6) return null;
  const box = h('section.card.wk-card', h('div.wk-head', h('strong', 'حصاد أسبوعك'), h('a.btn.ghost', { href: '#/stats' }, 'التفاصيل')));
  weekReport().then((r) => {
    const rows = reportRows(r);
    if (!rows.length) { box.remove(); return; }
    box.append(h('div.wk-grid', rows.slice(0, 6).map(([l, v]) => h('div.wk-item', h('strong', ar(v)), h('small', l)))),
      h('button.btn.ghost.block', { type: 'button', onclick: shareWeek }, icon('share'), 'شاركه صورة'));
  }).catch(() => box.remove());
  return box;
}

/** القسم الكامل في «إحصائياتي» */
export function weeklySection() {
  const box = h('section.card.wk-card', h('div.wk-head', h('strong', 'تقرير الأسبوع'), h('button.btn.ghost', { type: 'button', onclick: shareWeek }, icon('share'), 'شارك')));
  weekReport().then((r) => {
    const rows = reportRows(r);
    box.append(rows.length ? h('div.wk-grid', rows.map(([l, v, extra]) => h('div.wk-item', h('strong', ar(v)), h('small', extra ? `${l} ${extra}` : l))))
      : h('p.muted', 'سجّل صلاتك وأذكارك واقرأ ولو صفحة، ويظهر حصادك هنا.'));
  });
  return box;
}
