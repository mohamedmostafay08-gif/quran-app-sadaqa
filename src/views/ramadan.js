// خطة رمضان: العد التنازلي، وإمساكية الشهر (السحور والإفطار)، وختمة رمضان، وأدعية الصيام
import { h, icon, ar } from '../lib/dom.js';
import * as P from '../features/prayer.js';
import * as K from '../features/khatma.js';
import { mount, topbar, toast } from '../ui.js';
import { navigate } from '../router.js';
import { upcomingOccasions } from './calendar.js';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x; };

/** حالة رمضان: { inRamadan, day, start (تاريخ أول يوم), daysLeft (حتى بدايته) } */
export function ramadanStatus(now = new Date()) {
  const hj = P.hijri(now);
  if (!hj) return null;
  if (hj.month === 9) return { inRamadan: true, day: hj.day, start: addDays(now, 1 - hj.day) };
  const next = upcomingOccasions(now, 8).find((o) => o.name === 'شهر رمضان');
  return next ? { inRamadan: false, daysLeft: next.days, start: next.date } : null;
}

/** كارت «اليوم»: يظهر قبل رمضان بثلاثين يومًا وطوال الشهر */
export function ramadanCard() {
  const st = ramadanStatus();
  if (!st || (!st.inRamadan && st.daysLeft > 30)) return null;
  const loc = P.getLocation();
  let line = '';
  if (st.inRamadan && loc) {
    try {
      const t = P.computeTimes(loc, new Date());
      const now = new Date();
      line = now < t.maghrib ? `الإفطار ${P.fmtTime(t.maghrib, loc.tz)}، بعد ${P.countdown(t.maghrib - now)}` : `السحور حتى ${P.fmtTime(P.computeTimes(loc, addDays(now, 1)).fajr, loc.tz)}`;
    } catch { /* */ }
  }
  return h('a.td-ramadan', { href: '#/ramadan' },
    h('span.td-ic', icon('moon')),
    h('span.td-pt',
      h('strong', st.inRamadan ? `رمضان: اليوم ${ar(st.day)}` : st.daysLeft === 0 ? 'رمضان يبدأ اليوم' : `رمضان بعد ${ar(st.daysLeft)} ${st.daysLeft <= 10 && st.daysLeft > 2 ? 'أيام' : st.daysLeft === 1 ? 'يوم' : st.daysLeft === 2 ? 'يومين' : 'يومًا'}`),
      h('small', line || (st.inRamadan ? 'الإمساكية وختمة رمضان' : 'جهّز خطتك: ختمة رمضان والإمساكية'))),
    icon('forward'));
}

export async function renderRamadan() {
  const st = ramadanStatus();
  const loc = P.getLocation();
  const active = await K.getActive('read');
  const remaining = st?.inRamadan ? 30 - st.day + 1 : 30;

  const plan = (n, label) => h('button.lib-card.rm-plan', { type: 'button', onclick: async () => {
    const days = Math.max(1, Math.floor(remaining / n));
    await K.create({ type: 'read', days });
    toast(n === 1 ? 'بدأت ختمة رمضان، وفقك الله' : `بدأت الختمة الأولى من ${ar(n)} (${ar(days)} يومًا لكل ختمة)`);
    navigate('/khatma');
  } }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon('book')), h('span.lib-text', h('strong', label), h('small', `نحو ${ar(Math.ceil(604 * n / remaining))} صفحة يوميًا`)));

  // الإمساكية: أيام رمضان الثلاثون (أو المتبقية)
  let table = null;
  if (loc && st) {
    const rows = [];
    for (let i = 0; i < 30; i++) {
      const d = addDays(st.start, i);
      const hj = P.hijri(d);
      if (!hj || hj.month !== 9) break;
      const t = P.computeTimes(loc, d);
      const today = d.toDateString() === new Date().toDateString();
      rows.push(h('tr', { class: today ? 'today' : '' },
        h('td', ar(hj.day)), h('td', new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)),
        h('td.num', P.fmtTime(t.fajr, loc.tz)), h('td.num', P.fmtTime(t.maghrib, loc.tz))));
    }
    table = h('section.card.rm-table',
      h('h2', `إمساكية رمضان — ${loc.name}`),
      h('table', h('thead', h('tr', h('th', 'اليوم'), h('th', 'التاريخ'), h('th', 'الإمساك (الفجر)'), h('th', 'الإفطار (المغرب)'))), h('tbody', rows)),
      h('p.small-note', 'المواعيد حسب طريقة الحساب المختارة، والإمساك عند أذان الفجر.'));
  }

  mount(h('div.ramadan-page',
    topbar({ title: 'رمضان', back: '#/' }),
    h('section.card.rm-hero',
      h('span.eyebrow', st?.inRamadan ? 'رمضان مبارك' : 'استعد لرمضان'),
      h('strong', !st ? 'رمضان' : st.inRamadan ? `اليوم ${ar(st.day)} من رمضان` : st.daysLeft === 0 ? 'يبدأ اليوم' : `بعد ${ar(st.daysLeft)} يومًا`),
      st && !st.inRamadan ? h('small', `أول أيامه المتوقع: ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(st.start)} (حسب أم القرى)`) : null),
    h('h2.lib-h', 'ختمة رمضان'),
    active ? h('a.row-btn.card', { href: '#/khatma' }, h('span', h('strong', 'لديك ختمة جارية'), h('small', 'افتح الختمة لمتابعة وردك')), icon('forward')) : null,
    h('div.lib-grid', plan(1, 'ختمة واحدة'), plan(2, 'ختمتان'), plan(3, 'ثلاث ختمات')),
    table || h('section.card', h('p.muted', 'حدّد مدينتك من شاشة الصلاة لتظهر الإمساكية.'), h('a.btn', { href: '#/prayer' }, icon('pin'), 'تحديد الموقع')),
    h('h2.lib-h', 'من هدي الصيام'),
    h('div.rm-duas',
      h('section.card.dua-card', h('strong.dua-title', 'فضل صيام رمضان'), h('p.dua-text', '«مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ»'), h('small.dua-ref', 'متفق عليه')),
      h('section.card.dua-card', h('strong.dua-title', 'عند الإفطار'), h('p.dua-text', '«ذَهَبَ الظَّمَأُ، وَابْتَلَّتِ الْعُرُوقُ، وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ»'), h('small.dua-ref', 'رواه أبو داود، وحسّنه الألباني')),
      h('section.card.dua-card', h('strong.dua-title', 'في ليلة القدر'), h('p.dua-text', '«اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي»'), h('small.dua-ref', 'رواه الترمذي وصححه'))),
  ));
}
