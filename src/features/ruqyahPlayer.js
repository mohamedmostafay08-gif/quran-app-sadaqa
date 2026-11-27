// تشغيل آيات الرقية متتابعة بصوت القارئ المختار: كل موضع نطاق، وعند اكتماله يبدأ الذي يليه (مع تكرار القائمة اختياريًا).
// - تغيير القائمة أثناء التشغيل يبدأ القائمة الجديدة فورًا
// - المتابعة تستأنف إن كان المقطع نفسه موقوفًا مؤقتًا، وإلا تعيد تشغيل المقطع الحالي (بعد خطأ أو انقطاع على iOS)
// - تغيير القارئ يعيد المقطع الحالي بالصوت الجديد
// - يتوقف التتابع تلقائيًا إن شغّل المستخدم شيئًا آخر
import { player, isUntimed, timedFallback } from '../audio/player.js';
import * as settings from '../state.js';

let queue = [], idx = -1, loop = false, active = false, handled = 0;
const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(state()); };

export const state = () => ({ active, idx, total: queue.length, item: queue[idx] || null, loop });
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** القارئ الذي سيُسمع فعلًا: التلاوات بلا توقيت آيات لا يمكن تشغيل مقاطع منها، فيُستخدم أقرب قارئ له توقيت */
export const effectiveReciter = () => timedFallback(settings.get('reciter'));
export const usesFallback = () => isUntimed(settings.get('reciter'));

const same = (r, x) => !!r && !!x && r.from.surah === x[0] && r.from.ayah === x[1] && r.to.surah === x[0] && r.to.ayah === x[2];

function playAt(i) {
  idx = i;
  const [s, f, t] = queue[i];
  player.playFrom(s, f, { range: { from: { surah: s, ayah: f }, to: { surah: s, ayah: t }, times: 1 } });
  notify();
}

/** items: [[سورة، من، إلى، عنوان]...] */
export function playRuqyah(items, { start = 0, repeat = false } = {}) {
  if (!items.length) return;
  queue = items.slice();
  loop = repeat;
  active = true;
  handled = Date.now();
  playAt(Math.min(start, queue.length - 1));
}

/** تغيّرت المواضع المختارة: إن كانت الرقية تعمل تبدأ القائمة الجديدة من أولها */
export function replaceQueue(items) {
  if (!active || !items.length) { queue = items.slice(); notify(); return false; }
  playRuqyah(items, { repeat: loop });
  return true;
}

/** زر الإيقاف/المتابعة */
export function toggle() {
  if (!active) return;
  const st = player.state();
  if (st.status === 'playing' || st.status === 'loading') return player.toggle();
  // موقوف مؤقتًا على المقطع نفسه: استئناف من الموضع
  if (st.status === 'paused' && same(st.range, queue[idx]) && player.audio.getAttribute('src')) return player.resume();
  // غير ذلك (توقف بخطأ، أو فُقد الصوت في الخلفية، أو تغيّر شيء): نعيد المقطع الحالي
  playAt(Math.max(0, idx));
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
  if (st.radio || ((st.status === 'playing' || st.status === 'loading') && !same(st.range, cur))) { active = false; notify(); return; }
  notify();
});

// تغيير القارئ أثناء الرقية: نعيد المقطع الحالي بالصوت الجديد
// (بعد أن ينهي player.setReciter تحميله، وإلا عاد القارئ بلا توقيت على النطاق)
settings.subscribe((k) => { if (k === 'reciter' && active) setTimeout(() => { if (active) playAt(Math.max(0, idx)); }, 0); });
