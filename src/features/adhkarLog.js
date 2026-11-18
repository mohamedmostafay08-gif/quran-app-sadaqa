// متابعة أذكار الصباح والمساء والنوم (على الجهاز فقط)
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import * as P from './prayer.js';
import { dayKey } from './activity.js';

export const SESSIONS = [['sabah', 'الصباح', 27, 'sun'], ['masa', 'المساء', 27, 'moon'], ['nawm', 'النوم', 28, 'moon']];

/** فترة أذكار الصباح والمساء الآن: الصباح قبل العصر، والمساء بعده */
export function currentPeriod(now = new Date()) {
  try { const loc = P.getLocation(); if (loc) return now < P.computeTimes(loc, now).asr ? 'sabah' : 'masa'; } catch { /* */ }
  return now.getHours() < 15 ? 'sabah' : 'masa';
}

const log = () => settings.get('adhkarLog') || {};
export const todayLog = (d = new Date()) => log()[dayKey(d)] || {};

export async function markDone(session) {
  const all = { ...log() };
  const k = dayKey();
  all[k] = { ...(all[k] || {}), [session]: true };
  const keys = Object.keys(all).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 90))) delete all[old];
  await settings.set('adhkarLog', all);
}

/** أيام متتالية أُتمّت فيها أذكار الصباح والمساء */
export function adhkarStreak() {
  const d = new Date();
  const full = (x) => { const l = todayLog(x); return l.sabah && l.masa; };
  if (!full(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (full(d) && n < 400) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** كارت «أذكاري اليوم» */
export function adhkarTodayCard() {
  const l = todayLog();
  const st = adhkarStreak();
  return h('section.card.ak-card',
    h('div.ak-head', h('strong', 'أذكاري اليوم'), st ? h('small', `${ar(st)} ${st === 1 ? 'يوم' : st === 2 ? 'يومان' : st <= 10 ? 'أيام' : 'يومًا'} متتالية`) : null),
    h('div.ak-row', SESSIONS.map(([id, name, ch, ic]) => h('a', { href: `#/adhkar/${ch}${ch === 27 ? `?p=${id}` : ''}`, class: l[id] ? 'ak-chip done' : 'ak-chip' },
      l[id] ? icon('check') : icon(ic), h('span', name)))));
}
