// الأذان: يُشغَّل عند دخول وقت الصلاة إذا كان التطبيق مفتوحًا، وعند فتح تنبيه الأذان
// صوت الأذان: ويكيميديا كومنز «Beautiful adhan» (CC0، ملكية عامة)
import { h, icon } from '../lib/dom.js';
import * as settings from '../state.js';
import * as P from './prayer.js';
import { player } from '../audio/player.js';
import { restoreMediaSession } from '../audio/mediaSession.js';

const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
// أصوات الأذان المتاحة
export const VOICES = [
  { id: 'egypt', name: 'المصري', by: 'بصوت الشيخ محمد رفعت', file: 'adhan-egypt.mp3' },
  { id: 'makkah', name: 'الحرم المكي', by: 'من المسجد الحرام', file: 'adhan-makkah.mp3' },
  { id: 'calm', name: 'هادئ', by: '', file: 'adhan.mp3' },
];
const voice = (id = settings.get('adhanVoice')) => VOICES.find((v) => v.id === id) || VOICES[0];
const srcOf = (v) => new URL(`../../public/audio/${v.file}`, import.meta.url).href;
let audio = null, box = null;
const blobs = {};

// نحمّل الملف كاملًا مرة واحدة (يُحفظ في الكاش فيعمل بدون إنترنت) ونشغّله من الذاكرة؛
// هذا أضمن على الآيفون من طلبات الصوت الجزئية
export function preloadAdhan(v = voice()) {
  const src = srcOf(v);
  return (blobs[v.id] ||= fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then((b) => URL.createObjectURL(b)).catch(() => { delete blobs[v.id]; return src; }));
}

const playedKey = () => 'qa:adhan-played';
const todayStr = () => new Date().toLocaleDateString('en-CA');
function markPlayed(k) { try { const v = JSON.parse(localStorage.getItem(playedKey()) || '{}'); v[k] = todayStr(); localStorage.setItem(playedKey(), JSON.stringify(v)); } catch { /* */ } }
function wasPlayed(k) { try { return JSON.parse(localStorage.getItem(playedKey()) || '{}')[k] === todayStr(); } catch { return false; } }

export function stopAdhan() {
  if (audio) { audio.pause(); audio.currentTime = 0; }
  box?.remove(); box = null;
  restoreMediaSession();
}

/** يعرض بطاقة الأذان ويحاول تشغيله؛ إن منع المتصفح التشغيل التلقائي يظهر زر «تشغيل الأذان» */
export function playAdhan(key, voiceId) {
  // فتح التنبيه في نفس لحظة تشغيل المجدول: لا نعيد الأذان من أوله
  if (box?.dataset.key === String(key) && key !== 'test' && audio && !audio.paused) return;
  if (key && key !== 'test') markPlayed(key);
  if (player.state().status === 'playing') player.pause();
  const v = voice(voiceId), src = srcOf(v);
  audio ||= new Audio();
  if (audio.dataset.voice !== v.id) { audio.src = src; audio.dataset.voice = v.id; }
  audio.volume = 1;
  preloadAdhan(v).then((u) => { if (u !== src && audio.dataset.voice === v.id && audio.paused && audio.src !== u) audio.src = u; });
  const title = NAMES[key] ? `حان الآن موعد صلاة ${NAMES[key]}` : 'الأذان';
  const playBtn = h('button.btn.adh-play', { type: 'button' });
  const setBtn = () => playBtn.replaceChildren(icon(audio.paused ? 'play' : 'pause'), h('span', audio.paused ? 'تشغيل الأذان' : 'إيقاف مؤقت'));
  playBtn.onclick = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
  audio.onplay = audio.onpause = setBtn;
  audio.onended = () => { setBtn(); setTimeout(() => { if (audio.paused) stopAdhan(); }, 4000); };
  box?.remove();
  box = h('div.adhan-box', { role: 'alertdialog', 'aria-label': title, dataset: { key: String(key) } },
    h('div.adh-card',
      h('span.adh-mark', { 'aria-hidden': 'true' }, '۞'),
      h('strong', title),
      h('p', '«حيّ على الصلاة، حيّ على الفلاح»'),
      v.by ? h('small.adh-by', v.by) : null,
      h('div.adh-actions', playBtn, h('button.btn.ghost', { type: 'button', onclick: stopAdhan }, 'إغلاق'))));
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopAdhan(); });
  document.body.append(box);
  setBtn();
  playBtn.focus();
  audio.currentTime = 0;
  audio.play().catch(() => setBtn()); // قد يمنع المتصفح التشغيل قبل أي لمسة من المستخدم
  // زر الإيقاف في شريط الإشعارات وشاشة القفل
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: v.by || 'رتّل', album: 'الأذان' });
    navigator.mediaSession.playbackState = 'playing';
    const stop = () => stopAdhan();
    try { navigator.mediaSession.setActionHandler('stop', stop); } catch { /* */ }
    try { navigator.mediaSession.setActionHandler('pause', stop); } catch { /* */ }
    try { navigator.mediaSession.setActionHandler('play', () => audio?.play().catch(() => {})); } catch { /* */ }
  }
}

/** «فتح» عنصر الصوت بأول لمسة من المستخدم: المتصفحات تمنع التشغيل التلقائي لعنصر لم يُشغَّل بلمسة،
 *  فنشغّله صامتًا لحظة ثم نوقفه، فيُسمح بتشغيله لاحقًا عند دخول الوقت دون لمسة */
function unlockOnFirstTap() {
  const unlock = () => {
    audio ||= new Audio();
    if (!audio.src) { const v = voice(); audio.src = srcOf(v); audio.dataset.voice = v.id; }
    const vol = audio.volume;
    audio.muted = true;
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; audio.volume = vol; }).catch(() => { audio.muted = false; });
    removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true);
  };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
}

/** يُشغَّل الأذان عند دخول وقت الصلاة والتطبيق مفتوح: مؤقّت دقيق للصلاة القادمة، وفحص احتياطي كل ٢٠ ثانية */
export function initAdhanScheduler() {
  let exact = 0;
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
      if (diff >= 0 && diff < 180000 && !wasPlayed(k)) { playAdhan(k); break; }
    }
    // مؤقّت للصلاة القادمة بالثانية (إن كانت خلال الساعة القادمة)
    clearTimeout(exact);
    const next = keys.map((k) => today[k]).filter((t) => t && t > now).sort((a, b) => a - b)[0];
    if (next && next - now < 3600000) exact = setTimeout(tick, next - now + 500);
  };
  unlockOnFirstTap();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
    else if (audio && !audio.paused) stopAdhan(); // إغلاق الأذان حين يُخفى التطبيق
  });
  settings.subscribe((k) => { if (['notifyPrayers', 'prayerLocation', 'adhanInApp'].includes(k)) tick(); });
  tick();
}
