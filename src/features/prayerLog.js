// متابعة الصلوات (على الجهاز فقط): لكل يوم حالة كل فريضة، والسنن الرواتب
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { sheet, toast } from '../ui.js';
import { dayKey } from './activity.js';

export const FARD = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];
export const STATES = { jamaah: 'في جماعة', ontime: 'في وقتها', late: 'قضاء' };
// السنن الرواتب الثنتا عشرة (حديث أم حبيبة عند مسلم، وتفصيلها عند الترمذي)
export const SUNNAH = [['fajr2', 'ركعتان قبل الفجر'], ['dhuhr4', 'أربع قبل الظهر'], ['dhuhr2', 'ركعتان بعد الظهر'], ['maghrib2', 'ركعتان بعد المغرب'], ['isha2', 'ركعتان بعد العشاء']];

const log = () => settings.get('prayerLog') || {};
export const dayLog = (d = new Date()) => log()[dayKey(d)] || {};

async function update(d, fn) {
  const all = { ...log() };
  const k = dayKey(d);
  const cur = { ...(all[k] || {}) };
  fn(cur);
  all[k] = cur;
  // نحتفظ بآخر ٩٠ يومًا
  const keys = Object.keys(all).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 90))) delete all[old];
  await settings.set('prayerLog', all);
}

export const setPrayer = (key, state, d = new Date()) => update(d, (x) => { if (state) x[key] = state; else delete x[key]; });
export const toggleSunnah = (id, d = new Date()) => update(d, (x) => { const s = new Set(x.sunnah || []); s.has(id) ? s.delete(id) : s.add(id); x.sunnah = [...s]; });

/** عدد الفرائض المؤداة في يوم */
export const doneCount = (d = new Date()) => FARD.filter(([k]) => dayLog(d)[k]).length;

/** ورقة اختيار حالة صلاة */
export function prayerSheet(key, name, onDone) {
  const cur = dayLog()[key];
  sheet({ title: `صلاة ${name}`, content: (close) => h('div.choice-list.pl-choices',
    ...Object.entries(STATES).map(([s, label]) => h('button.row-btn', { type: 'button', 'aria-pressed': String(cur === s), onclick: async () => {
      await setPrayer(key, s); close(); onDone?.(); toast(`تقبّل الله منك`);
    } }, h('span', h('strong', label)), cur === s ? icon('check') : null)),
    cur ? h('button.btn.ghost.block', { type: 'button', onclick: async () => { await setPrayer(key, null); close(); onDone?.(); } }, 'إلغاء التسجيل') : null) });
}

/** زر الحالة بجانب كل صلاة في جدول المواقيت */
export function statusButton(key, name, onDone) {
  const st = dayLog()[key];
  return h('button.pl-btn', { type: 'button', class: st ? `pl-btn on ${st}` : 'pl-btn', 'aria-label': st ? `صلاة ${name}: ${STATES[st]}` : `سجّل صلاة ${name}`, onclick: (e) => { e.stopPropagation(); prayerSheet(key, name, onDone); } },
    st ? icon('check') : h('span.pl-empty'));
}

/** كارت الأسبوع: ٥ صفوف × ٧ أيام */
export function weekCard() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const fmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'narrow' });
  const total = days.reduce((n, d) => n + doneCount(d), 0);
  const sunnah = days.reduce((n, d) => n + (dayLog(d).sunnah || []).length, 0);
  return h('section.card.pl-week',
    h('h2', 'صلواتي هذا الأسبوع'),
    h('div.pl-grid', { role: 'table', 'aria-label': 'الصلوات في آخر سبعة أيام' },
      h('span'), ...days.map((d) => h('small.pl-day', fmt.format(d))),
      ...FARD.flatMap(([k, name]) => [h('span.pl-name', name), ...days.map((d) => { const s = dayLog(d)[k]; return h('i', { class: `pl-dot ${s || ''}`, title: s ? STATES[s] : 'لم تُسجَّل' }); })])),
    h('div.pl-sum', h('span', `${ar(total)} من ${ar(35)} فريضة`), h('span', `${ar(sunnah)} من السنن الرواتب`)),
    h('div.pl-legend', h('span', h('i.pl-dot.jamaah'), 'جماعة'), h('span', h('i.pl-dot.ontime'), 'في وقتها'), h('span', h('i.pl-dot.late'), 'قضاء')));
}

/** كارت السنن الرواتب لليوم */
export function sunnahCard(onChange) {
  const box = h('section.card.pl-sunnah', h('h2', 'السنن الرواتب اليوم'));
  const draw = () => {
    const done = new Set(dayLog().sunnah || []);
    box.replaceChildren(h('h2', 'السنن الرواتب اليوم'), h('div.notify-chips', SUNNAH.map(([id, label]) => h('button.pb-chip', { type: 'button', 'aria-pressed': String(done.has(id)), onclick: async () => { await toggleSunnah(id); draw(); onChange?.(); } }, label))),
      h('p.small-note', '«من صلى اثنتي عشرة ركعة في يوم وليلة بُني له بهن بيت في الجنة» رواه مسلم.'));
  };
  draw();
  return box;
}
