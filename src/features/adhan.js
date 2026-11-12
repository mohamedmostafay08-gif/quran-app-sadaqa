// الأذان: يُشغَّل عند دخول وقت الصلاة إذا كان التطبيق مفتوحًا، وعند فتح تنبيه الأذان
// صوت الأذان: ويكيميديا كومنز «Beautiful adhan» (CC0، ملكية عامة)
import { h, icon } from '../lib/dom.js';
import * as settings from '../state.js';
import * as P from './prayer.js';
import { player } from '../audio/player.js';

const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const SRC = new URL('../../public/audio/adhan.mp3', import.meta.url).href;
let audio = null, box = null, blobP = null;

// نحمّل الملف كاملًا مرة واحدة (يُحفظ في الكاش فيعمل بدون إنترنت) ونشغّله من الذاكرة؛
// هذا أضمن على الآيفون من طلبات الصوت الجزئية
export function preloadAdhan() {
  return (blobP ||= fetch(SRC).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then((b) => URL.createObjectURL(b)).catch(() => { blobP = null; return SRC; }));
}

const playedKey = () => 'qa:adhan-played';
const todayStr = () => new Date().toLocaleDateString('en-CA');
function markPlayed(k) { try { const v = JSON.parse(localStorage.getItem(playedKey()) || '{}'); v[k] = todayStr(); localStorage.setItem(playedKey(), JSON.stringify(v)); } catch { /* */ } }
function wasPlayed(k) { try { return JSON.parse(localStorage.getItem(playedKey()) || '{}')[k] === todayStr(); } catch { return false; } }

export function stopAdhan() {
  if (audio) { audio.pause(); audio.currentTime = 0; }
  box?.remove(); box = null;
}

/** يعرض بطاقة الأذان ويحاول تشغيله؛ إن منع المتصفح التشغيل التلقائي يظهر زر «تشغيل الأذان» */
export function playAdhan(key) {
  if (key && key !== 'test') markPlayed(key);
  if (player.state().status === 'playing') player.pause();
  audio ||= new Audio(SRC);
  audio.volume = 1;
  preloadAdhan().then((u) => { if (audio.src !== u && audio.paused && u !== SRC) { audio.src = u; } });
  const title = NAMES[key] ? `حان الآن موعد صلاة ${NAMES[key]}` : 'الأذان';
  const playBtn = h('button.btn.adh-play', { type: 'button' });
  const setBtn = () => playBtn.replaceChildren(icon(audio.paused ? 'play' : 'pause'), h('span', audio.paused ? 'تشغيل الأذان' : 'إيقاف مؤقت'));
  playBtn.onclick = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
  audio.onplay = audio.onpause = setBtn;
  audio.onended = () => { setBtn(); setTimeout(() => { if (audio.paused) stopAdhan(); }, 4000); };
  box?.remove();
  box = h('div.adhan-box', { role: 'alertdialog', 'aria-label': title },
    h('div.adh-card',
      h('span.adh-mark', { 'aria-hidden': 'true' }, '۞'),
      h('strong', title),
      h('p', '«حيّ على الصلاة، حيّ على الفلاح»'),
      h('div.adh-actions', playBtn, h('button.btn.ghost', { type: 'button', onclick: stopAdhan }, 'إغلاق'))));
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopAdhan(); });
  document.body.append(box);
  setBtn();
  playBtn.focus();
  audio.currentTime = 0;
  audio.play().catch(() => setBtn()); // قد يمنع المتصفح التشغيل قبل أي لمسة من المستخدم
}

/** فحص كل ٢٠ ثانية: إن دخل وقت صلاة مختارة والتطبيق مفتوح، يُشغَّل الأذان مرة واحدة */
export function initAdhanScheduler() {
  const tick = () => {
    if (settings.get('adhanInApp') === false) return;
    const loc = P.getLocation();
    const keys = settings.get('notifyPrayers') || [];
    if (!loc || !keys.length) return;
    preloadAdhan();
    const now = new Date();
    let today;
    try { today = P.computeTimes(loc, now); } catch { return; }
    for (const k of keys) {
      const t = today[k];
      if (!t) continue;
      const diff = now - t;
      if (diff >= 0 && diff < 120000 && !wasPlayed(k)) { playAdhan(k); break; }
    }
  };
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  tick();
}
