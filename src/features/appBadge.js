// رقم على أيقونة التطبيق (بعد تثبيته): عدد الصلوات التي دخل وقتها اليوم ولم تسجّلها بعد
import * as settings from '../state.js';
import * as P from './prayer.js';
import { FARD, dayLog } from './prayerLog.js';

export function badgeCount(now = new Date()) {
  const loc = settings.get('prayerLocation');
  if (!loc) return 0;
  try {
    const t = P.computeTimes(loc, now), log = dayLog(now);
    return FARD.filter(([k]) => t[k] && t[k] <= now && !log[k]).length;
  } catch { return 0; }
}

function update() {
  if (!('setAppBadge' in navigator)) return;
  const n = settings.get('appBadge') === false ? 0 : badgeCount();
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

export function initAppBadge() {
  if (!('setAppBadge' in navigator)) return;
  update();
  setInterval(update, 60_000);
  settings.subscribe((k) => { if (k === 'prayerLog' || k === 'appBadge' || k === 'prayerLocation') update(); });
  addEventListener('visibilitychange', update);
}
