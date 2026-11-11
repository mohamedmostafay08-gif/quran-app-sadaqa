// مؤقت النوم مع خفوت تدريجي للصوت
import { h, ar, icon } from '../lib/dom.js';
import { sheet, toast } from '../ui.js';
import { player } from './player.js';

const FADE_MS = 45000;
let endAt = 0;
let tick = null;

export function sleepState() {
  if (!endAt) return null;
  const left = Math.max(0, endAt - Date.now());
  return `${ar(Math.ceil(left / 60000))} د`;
}

export function startSleep(minutes) {
  cancelSleep(true);
  endAt = Date.now() + minutes * 60000;
  tick = setInterval(() => {
    const left = endAt - Date.now();
    if (left <= 0) {
      player.pause();
      cancelSleep(true);
      return;
    }
    player.setFade(left < FADE_MS ? Math.max(0.05, left / FADE_MS) : 1);
  }, 500);
  toast(`سيتوقف التشغيل بعد ${ar(minutes)} دقيقة`);
}

export function cancelSleep(silent) {
  clearInterval(tick);
  tick = null;
  endAt = 0;
  player.setFade(1);
  if (!silent) toast('تم إلغاء مؤقت النوم');
}

export function sleepSheet() {
  sheet({
    title: 'مؤقت النوم',
    content: (close) => h('div',
      h('p.muted', 'يخفت الصوت تدريجيًا في آخر ٤٥ ثانية ثم يتوقف.'),
      h('div.chip-grid', [5, 10, 15, 30, 45, 60, 90].map((m) => h('button.chip', { type: 'button', onclick: () => { startSleep(m); close(); } }, `${ar(m)} دقيقة`))),
      endAt ? h('button.btn.ghost.block', { type: 'button', onclick: () => { cancelSleep(); close(); } }, icon('close'), 'إلغاء المؤقت') : null,
    ),
  });
}
