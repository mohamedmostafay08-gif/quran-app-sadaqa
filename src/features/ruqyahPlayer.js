// تشغيل آيات الرقية متتابعة بصوت القارئ المختار: كل موضع نطاق، وعند اكتماله يبدأ الذي يليه (مع تكرار القائمة اختياريًا).
// - تغيير القائمة أثناء التشغيل يبدأ القائمة الجديدة فورًا
// - المتابعة تستأنف إن كان المقطع نفسه موقوفًا مؤقتًا، وإلا تعيد تشغيل المقطع الحالي (بعد خطأ أو انقطاع على iOS)
// - تغيير القارئ يكمل المقطع بالصوت الجديد (وبالقارئ البديل إن كانت التلاوة بلا توقيت)
// - يتوقف التتابع تلقائيًا إن شغّل المستخدم شيئًا آخر
import { player, isUntimed, timedFallback } from '../audio/player.js';
import * as settings from '../state.js';

let queue = [], idx = -1, loop = false, active = false, handled = 0;
let fixing = false;
let started = false; // بدأ المقطع الحالي يُسمع فعلًا (فيصح استئنافه من موضعه)
const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(state()); };

export const state = () => ({ active, idx, total: queue.length, item: queue[idx] || null, loop });
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** القارئ الذي سيُسمع فعلًا: التلاوات بلا توقيت آيات لا يمكن تشغيل مقاطع منها، فيُستخدم أقرب قارئ له توقيت */
export const effectiveReciter = () => timedFallback(settings.get('reciter'));
export const usesFallback = () => isUntimed(settings.get('reciter'));

const same = (r, x) => !!r && !!x && r.from.surah === x[0] && r.from.ayah === x[1] && r.to.surah === x[0] && r.to.ayah === x[2];
const keys = (list) => list.map((x) => `${x[0]}:${x[1]}-${x[2]}`).join();

function playAt(i) {
  idx = i;
  started = false;
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

/** تغيّرت المواضع المختارة: إن كانت الرقية تعمل تبدأ القائمة الجديدة من أولها،
 *  وإن كانت موقوفة مؤقتًا تُحفظ لتبدأ عند «متابعة» دون تشغيل مفاجئ */
export function replaceQueue(items) {
  if (!items.length || keys(items) === keys(queue)) return false;
  if (!active) { queue = items.slice(); notify(); return false; }
  const st = player.state();
  if (st.status === 'playing' || st.status === 'loading') { playRuqyah(items, { repeat: loop }); return true; }
  queue = items.slice(); idx = 0; started = false;
  notify();
  return false;
}

/** زر الإيقاف/المتابعة */
export function toggle() {
  if (!active) return;
  const st = player.state();
  if (st.status === 'playing' || st.status === 'loading') return player.toggle();
  // موقوف مؤقتًا أثناء سماع المقطع نفسه: استئناف من الموضع (وإن رفض المتصفح نعيد المقطع)
  if (st.status === 'paused' && started && !st.error && same(st.range, queue[idx]) && player.audio.getAttribute('src')) {
    player.audio.play().catch((e) => { if (e.name !== 'AbortError' && active) playAt(idx); });
    return;
  }
  // غير ذلك (خطأ، أو إيقاف أثناء التحميل والملف القديم ما زال محمّلًا، أو فُقد الصوت في الخلفية): نعيد المقطع الحالي
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
  // شغّل المستخدم شيئًا آخر (سورة أو إذاعة أو نطاقًا مختلفًا)، أو أغلق المشغّل
  if (st.radio || (!st.surah && st.status === 'idle') || ((st.status === 'playing' || st.status === 'loading') && !same(st.range, cur))) { active = false; notify(); return; }
  // اختار المستخدم أثناء الرقية تلاوة بلا توقيت (ولو كانت المختارة أصلًا): player.setReciter يحمّل السورة كاملة
  // بصوتها، فنعيد المقطع الحالي بالقارئ البديل بعد أن ينهي setReciter عمله
  if (st.reciter && st.reciter !== effectiveReciter() && !fixing) {
    fixing = true;
    setTimeout(() => { fixing = false; if (active) playAt(Math.max(0, idx)); }, 0);
  }
  if (st.status === 'playing') started = true;
  notify();
});
