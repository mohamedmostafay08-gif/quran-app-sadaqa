// تشغيل آيات الرقية متتابعة بصوت القارئ المختار: كل موضع نطاق، وعند اكتماله يبدأ الذي يليه (مع تكرار القائمة اختياريًا).
// يتوقف التتابع تلقائيًا إن شغّل المستخدم شيئًا آخر.
import { player } from '../audio/player.js';

let queue = [], idx = -1, loop = false, active = false, handled = 0;
const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(state()); };

export const state = () => ({ active, idx, total: queue.length, item: queue[idx] || null, loop });
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const same = (r, [s, f, t]) => r && r.from.surah === s && r.from.ayah === f && r.to.surah === s && r.to.ayah === t;

function playAt(i) {
  idx = i;
  const [s, f, t] = queue[i];
  player.playFrom(s, f, { range: { from: { surah: s, ayah: f }, to: { surah: s, ayah: t }, times: 1 } });
  notify();
}

/** items: [[سورة، من، إلى، عنوان]...] */
export function playRuqyah(items, { start = 0, repeat = false } = {}) {
  queue = items.slice();
  loop = repeat;
  active = true;
  handled = Date.now();
  playAt(start);
}

export function setLoop(v) { loop = v; notify(); }

export function stopRuqyah() {
  if (!active) return;
  active = false;
  notify();
}

player.subscribe((st) => {
  if (!active) return;
  const cur = queue[idx];
  // اكتمل الموضع الحالي: ننتقل للتالي
  if (st.completed && st.completed.at > handled && same(st.completed, cur)) {
    handled = st.completed.at;
    if (idx + 1 < queue.length) playAt(idx + 1);
    else if (loop) playAt(0);
    else { active = false; notify(); }
    return;
  }
  // شغّل المستخدم شيئًا آخر (سورة أو إذاعة أو نطاقًا مختلفًا)
  if (st.radio || (st.status !== 'idle' && !same(st.range, cur))) { active = false; notify(); }
});
