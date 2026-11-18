// التقويم الهجري: شهر كامل، والأيام البيض والاثنين والخميس، والمناسبات القادمة مع العدّ التنازلي
import { h, icon, ar } from '../lib/dom.js';
import * as P from '../features/prayer.js';
import { mount, topbar } from '../ui.js';

const MONTHS = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة'];
const WEEK = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

// [شهر، يوم، الاسم، وصف قصير]
export const OCCASIONS = [
  [1, 1, 'رأس السنة الهجرية', ''],
  [1, 10, 'يوم عاشوراء', 'يُستحب صيامه مع اليوم التاسع'],
  [9, 1, 'شهر رمضان', 'أول أيام الصيام'],
  [9, 21, 'العشر الأواخر من رمضان', 'فيها ليلة القدر'],
  [10, 1, 'عيد الفطر', ''],
  [12, 1, 'العشر الأوائل من ذي الحجة', 'أفضل أيام الدنيا'],
  [12, 9, 'يوم عرفة', 'يُستحب صيامه لغير الحاج'],
  [12, 10, 'عيد الأضحى', ''],
];

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** المناسبات القادمة خلال سنة (الأقرب أولًا) */
export function upcomingOccasions(from = new Date(), limit = 8) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 400 && out.length < OCCASIONS.length; i++) {
    const d = addDays(from, i);
    const hj = P.hijri(d);
    if (!hj) break;
    for (const [m, day, name, desc] of OCCASIONS) {
      if (hj.month === m && hj.day === day && !seen.has(name)) { seen.add(name); out.push({ date: d, days: i, name, desc, hijri: hj }); }
    }
  }
  return out.sort((a, b) => a.days - b.days).slice(0, limit);
}

function monthStart(d) {
  let x = addDays(d, 0);
  for (let i = 0; i < 31 && P.hijri(x)?.day !== 1; i++) x = addDays(x, -1);
  return x;
}

export function renderCalendar() {
  if (!P.hijri()) {
    mount(h('div.calendar-page', topbar({ title: 'التقويم الهجري', back: '#/' }), h('p.muted', 'متصفحك لا يدعم التقويم الهجري.')));
    return;
  }
  let start = monthStart(new Date());
  const grid = h('div.cal-grid', { role: 'grid' });
  const title = h('h2.cal-title');
  const draw = () => {
    const hj0 = P.hijri(start);
    title.replaceChildren(h('strong', `${MONTHS[hj0.month - 1]} ${ar(hj0.year)} هـ`),
      h('small', new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(start)));
    const cells = WEEK.map((w) => h('span.cal-wd', { role: 'columnheader' }, w));
    const lead = (start.getDay() + 1) % 7; // السبت أول الأسبوع
    for (let i = 0; i < lead; i++) cells.push(h('span.cal-day.empty'));
    const today = new Date();
    for (let i = 0; i < 31; i++) {
      const d = addDays(start, i);
      const hj = P.hijri(d);
      if (hj.month !== hj0.month) break;
      const occ = OCCASIONS.find(([m, day]) => m === hj.month && day === hj.day);
      const white = hj.day >= 13 && hj.day <= 15;
      const monThu = d.getDay() === 1 || d.getDay() === 4;
      const cls = ['cal-day', sameDay(d, today) && 'today', white && 'white', occ && 'occ', monThu && 'fast'].filter(Boolean).join(' ');
      cells.push(h('span', { class: cls, role: 'gridcell', title: occ ? occ[2] : white ? 'من الأيام البيض' : monThu ? 'يُستحب صيامه' : null },
        h('b', ar(hj.day)), h('small', ar(d.getDate()))));
    }
    grid.replaceChildren(...cells);
  };
  const nav = (dir) => { start = monthStart(addDays(start, dir > 0 ? 32 : -2)); draw(); };
  draw();

  const list = upcomingOccasions();
  mount(h('div.calendar-page',
    topbar({ title: 'التقويم الهجري', sub: P.hijri()?.text, back: '#/' }),
    h('section.card.cal-card',
      h('div.cal-head',
        h('button.icon-btn', { type: 'button', 'aria-label': 'الشهر السابق', onclick: () => nav(-1) }, icon('forward')),
        title,
        h('button.icon-btn', { type: 'button', 'aria-label': 'الشهر التالي', onclick: () => nav(1) }, icon('back'))),
      grid,
      h('div.cal-legend',
        h('span', h('i.lg-white'), 'الأيام البيض'),
        h('span', h('i.lg-fast'), 'الاثنين والخميس'),
        h('span', h('i.lg-occ'), 'مناسبة')),
      h('p.small-note', 'حسب تقويم أم القرى، وقد يختلف يومًا حسب رؤية الهلال.')),
    h('h2.lib-h', 'المناسبات القادمة'),
    h('ul.occ-list', list.map((o) => h('li.occ-item',
      h('span.occ-days', o.days === 0 ? h('strong', 'اليوم') : [h('strong', ar(o.days)), h('small', o.days === 1 ? 'يوم' : o.days <= 10 ? 'أيام' : 'يومًا')]),
      h('span.occ-text', h('strong', o.name), h('small', [`${ar(o.hijri.day)} ${MONTHS[o.hijri.month - 1]} — ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(o.date)}`, o.desc ? ` · ${o.desc}` : ''].join(''))))),
    ),
  ));
}
