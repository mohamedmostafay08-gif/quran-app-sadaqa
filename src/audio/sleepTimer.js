// مؤقت النوم: خفوت تدريجي للصوت ثم إيقاف
// المؤقتات (setInterval) تتوقف أو تتأخر في الخلفية على iOS، فنفحص الموعد أيضًا مع كل timeupdate للصوت
// (يستمر ما دام الصوت يعمل) وعند العودة للتطبيق. وعلى iOS لا يمكن تغيير مستوى الصوت من الصفحة،
// فبدل الخفوت نوقف التلاوة عند نهاية الآية الجارية حتى لا تنقطع في منتصف كلمة.
import { h, ar, icon } from '../lib/dom.js';
import { sheet, toast } from '../ui.js';
import { player } from './player.js';

const FADE_MS = 60000;
const GRACE_MS = 45000; // أقصى انتظار لنهاية الآية بعد الموعد
let endAt = 0;
let timer = null;
let unsubAyah = null;

/** هل يسمح المتصفح بتغيير مستوى الصوت؟ (iOS يتجاهله ويبقيه 1) */
export const canFade = (() => { try { const a = new Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; } catch { return false; } })();

export function sleepState() {
  if (!endAt) return null;
  const left = Math.max(0, endAt - Date.now());
  return `${ar(Math.ceil(left / 60000))} د`;
}

// منحنى خفوت ناعم (ربع جيب): يبدأ بطيئًا ثم يتسارع، فلا يُحسّ بقفزة
const fadeAt = (left) => (left >= FADE_MS ? 1 : Math.max(0.02, Math.sin((left / FADE_MS) * Math.PI / 2)));

function stopNow() {
  if (!endAt) return;
  // نلغي الاشتراك أولًا (pause يطلق تحديثًا قد يعيد استدعاءنا)، ونعيد مستوى الصوت بعد الإيقاف لا قبله
  endAt = 0;
  unsubAyah?.(); unsubAyah = null;
  player.pause();
  cancelSleep(true);
}

function check() {
  if (!endAt) return;
  const left = endAt - Date.now();
  if (left > 0) { if (canFade) player.setFade(fadeAt(left)); return; }
  const st = player.state();
  if (st.status !== 'playing' && st.status !== 'loading') return stopNow();
  // بلا خفوت: ننتظر نهاية الآية الجارية (للسور ذات التوقيت) بحد أقصى، وإلا نوقف فورًا
  if (canFade || st.radio || !st.surah || left < -GRACE_MS) return stopNow();
  if (!unsubAyah) {
    const ayah = st.ayah, surah = st.surah;
    unsubAyah = player.subscribe((s) => { if (s.ayah !== ayah || s.surah !== surah || s.status !== 'playing') stopNow(); });
  }
}

const onVisible = () => { if (document.visibilityState === 'visible') check(); };

export function startSleep(minutes) {
  cancelSleep(true);
  endAt = Date.now() + minutes * 60000;
  timer = setInterval(check, 500);
  player.audio.addEventListener('timeupdate', check);
  document.addEventListener('visibilitychange', onVisible);
  addEventListener('pageshow', check);
  toast(`سيتوقف التشغيل بعد ${ar(minutes)} دقيقة`);
}

export function cancelSleep(silent) {
  clearInterval(timer);
  timer = null;
  endAt = 0;
  unsubAyah?.(); unsubAyah = null;
  player.audio.removeEventListener('timeupdate', check);
  document.removeEventListener('visibilitychange', onVisible);
  removeEventListener('pageshow', check);
  player.setFade(1);
  if (!silent) toast('تم إلغاء مؤقت النوم');
}

export function sleepSheet() {
  sheet({
    title: 'مؤقت النوم',
    content: (close) => h('div',
      h('p.muted', canFade ? 'يخفت الصوت تدريجيًا في آخر دقيقة ثم يتوقف.' : 'يتوقف التشغيل بهدوء عند نهاية الآية.'),
      h('div.chip-grid', [5, 10, 15, 30, 45, 60, 90].map((m) => h('button.chip', { type: 'button', onclick: () => { startSleep(m); close(); } }, `${ar(m)} دقيقة`))),
      endAt ? h('button.btn.ghost.block', { type: 'button', onclick: () => { cancelSleep(); close(); } }, icon('close'), 'إلغاء المؤقت') : null,
    ),
  });
}
