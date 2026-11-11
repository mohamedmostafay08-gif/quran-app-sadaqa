// محرك الصوت: تلاوة السورة كاملة (متصلة بدون فواصل) من mp3quran.net أو Quran.com (المجوّد والمعلّم)
// مع توقيت كل آية لتظليل الآية المقروءة، والتكرار، والنطاقات، ومقارنة القراء — كلها بالقفز داخل نفس الملف.
import * as settings from '../state.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { setupMediaSession, updateMediaSession } from './mediaSession.js';

const TIMING_API = 'https://www.mp3quran.net/api/v3/ayat_timing';
const QDC_API = 'https://api.quran.com/api/v4/chapter_recitations';
const pad = (n) => String(n).padStart(3, '0');
export const DEFAULT_RECITER = '123'; // مشاري العفاسي

let reciters = [];
export async function loadReciters() {
  const res = await fetch(new URL('../../public/data/reciters.json', import.meta.url));
  reciters = await res.json();
  for (const r of reciters) r.style = r.style === 'المجود' ? 'مجوّد' : r.style;
  // تصنيف: مرتل / مجوّد / معلّم
  // ترحيل إعداد القارئ القديم (معرّفات EveryAyah) إلى القائمة الجديدة
  if (!reciters.some((r) => r.id === settings.get('reciter'))) settings.set('reciter', DEFAULT_RECITER);
  return reciters;
}
export const getReciters = () => reciters;
export const getReciter = (id) => reciters.find((r) => r.id === id) || reciters[0];
/** قراء بلا توقيت آيات (تلاوة متصلة بلا تظليل ولا قفز داخل السورة) */
export const isUntimed = (id) => !!getReciter(id)?.untimed;
/** أقرب قارئ له توقيت (للتكرار والحفظ والمقارنة) */
export const timedFallback = (id) => (isUntimed(id) ? (reciters.find((r) => !r.untimed && r.featured) || reciters[0]).id : id);

export function surahUrl(reciterId, s) {
  const r = getReciter(reciterId);
  return `${r.server}${r.source === 'qdc' && !r.pad ? s : pad(s)}.mp3`;
}
export function timingUrl(reciterId, s) {
  const r = getReciter(reciterId);
  return r.source === 'qdc' ? `${QDC_API}/${r.qdc}/${s}?segments=true` : `${TIMING_API}?surah=${s}&read=${reciterId}`;
}

// ---- توقيتات الآيات ----
const timingCache = new Map();
/** يرجع مصفوفة [start, end] بالثواني؛ الفهرس 0 = البسملة/الاستعاذة قبل الآية الأولى */
export async function getTimings(reciterId, s) {
  const key = `${reciterId}:${s}`;
  if (timingCache.has(key)) return timingCache.get(key);
  const res = await fetch(timingUrl(reciterId, s));
  if (!res.ok) throw new Error('timing ' + res.status);
  const data = await res.json();
  const t = [];
  if (getReciter(reciterId).source === 'qdc') {
    for (const x of data.audio_file?.timestamps || []) {
      const a = +x.verse_key.split(':')[1];
      t[a] = [x.timestamp_from / 1000, x.timestamp_to / 1000];
    }
  } else {
    for (const x of data) if (x.ayah >= 1) t[x.ayah] = [x.start_time / 1000, x.end_time / 1000];
  }
  const count = getSurahMeta(s).ayahCount;
  t.length = count + 1;
  // بعض التوقيتات تدمج آيتين في مدخل واحد (مثل آخر آيتين من الفاتحة عند الحصري):
  // نوزّع مدة المقطع على آياته بنسبة طول نصها بدل رفض السورة كلها
  if ([...t.slice(1)].some((x) => !x)) {
    const have = t.slice(1).filter(Boolean).length;
    if (have < count * 0.5) throw new Error('timing incomplete');
    await fillGaps(t, count, await getSurahText(s));
  }
  t[0] = [0, t[1][0]];
  timingCache.set(key, t);
  if (timingCache.size > 30) timingCache.delete(timingCache.keys().next().value);
  return t;
}

/** يملأ الآيات الناقصة: كل مجموعة ناقصة تُدمج مع الآية المعروفة قبلها وتُقسَّم المدة بنسبة عدد الحروف */
export async function fillGaps(t, count, texts) {
  const len = (a) => Math.max(1, (texts[a - 1] || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\s]/g, '').length);
  let a = 1;
  while (a <= count) {
    if (t[a]) { a++; continue; }
    let b = a;
    while (b <= count && !t[b]) b++;            // الناقص: a .. b-1
    const first = a > 1 ? a - 1 : a;              // نضم الآية المعروفة السابقة
    const start = a > 1 ? t[a - 1][0] : 0;
    const end = b <= count ? t[b][0] : (a > 1 ? t[a - 1][1] : start);
    const group = [];
    for (let k = first; k < b; k++) group.push(k);
    const total = group.reduce((n, k) => n + len(k), 0);
    let pos = start;
    for (const k of group) {
      const d = (end - start) * (len(k) / total);
      t[k] = [pos, pos + d];
      pos += d;
    }
    a = b;
  }
  return t;
}

// ---- الحالة ----
const st = {
  status: 'idle',      // idle | loading | playing | paused
  surah: null,
  ayah: null,          // 0 = البسملة (ما قبل الآية الأولى)
  reciter: null,
  only: false,         // تكرار آية واحدة ثم التوقف
  repeatLeft: 0,
  compare: null,       // { list: [reciterIds], idx }
  error: null,
  range: null,         // { from:{surah,ayah}, to:{surah,ayah}, loop, times } نطاق (ورد / حفظ)
  completed: null,     // آخر نطاق اكتمل تشغيله (لتسجيل الورد)
  loops: 0,
};
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(st); updateMediaSession(st); };

const audio = new Audio();
audio.preload = 'auto';
let sleepFade = 1;
let timings = null;     // توقيتات الملف المحمّل
let loadedKey = null;   // reciter:surah للملف المحمّل
let loadSeq = 0;
let switching = false;
let resumeAt = null;     // ثانية الاستكمال بعد إعادة فتح التطبيق  // أثناء تبديل الملف/القفز: تجاهل مراقبة الحدود حتى يبدأ التشغيل فعليًا

const needsBasmala = (s) => s !== 1 && s !== 9;
const currentReciter = () => (st.compare ? st.compare.list[st.compare.idx] : st.reciter);
const startOf = (a) => timings[a][0];
const endOf = (a) => timings[a][1];

function ayahAt(t) {
  if (!timings) return null;
  const n = timings.length - 1;
  // بحث ثنائي على بدايات الآيات
  let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (timings[mid][0] <= t + 0.02) lo = mid; else hi = mid - 1; }
  return lo;
}

function fail(msg) {
  st.status = 'paused';
  st.error = msg || (navigator.onLine ? 'تعذر تشغيل الصوت' : 'لا يوجد اتصال، والسورة غير منزّلة');
  emit();
}

/** يحمّل ملف السورة (لو لزم) ثم يقفز لبداية الآية ويشغّل */
async function load(s, a) {
  const my = ++loadSeq;
  const reciterId = currentReciter();
  const key = `${reciterId}:${s}`;
  st.surah = s; st.ayah = a; st.error = null;
  switching = true;
  if (key !== loadedKey) {
    audio.pause();
    timings = null;
    st.status = 'loading';
    emit();
    if (isUntimed(reciterId)) {
      loadedKey = key;
      audio.src = surahUrl(reciterId, s);
    } else try {
      const t = await getTimings(reciterId, s);
      if (my !== loadSeq) return;
      timings = t;
    } catch (e) {
      if (my !== loadSeq) return;
      // توقيت هذه السورة غير متوفر عند المصدر: نشغّلها متصلة بلا تظليل بدل الخطأ
      if (e.message !== 'timing incomplete') return fail(navigator.onLine ? 'تعذر تحميل توقيت الآيات' : null);
      loadedKey = key;
      audio.src = surahUrl(reciterId, s);
    }
    if (!isUntimed(reciterId) && timings) {
      loadedKey = key;
      audio.src = surahUrl(reciterId, s);
    }
  }
  st.untimed = !timings;
  if (st.untimed) { st.ayah = null; emit(); }
  audio.playbackRate = rateFor(reciterId);
  audio.volume = sleepFade;
  await seek(resumeAt != null ? resumeAt : timings ? startOf(a) : 0);
  resumeAt = null;
  if (my !== loadSeq) return;
  try {
    await audio.play();
    if (my === loadSeq) switching = false;
  } catch (e) {
    if (e.name === 'AbortError' || my !== loadSeq) return;
    switching = false;
    fail();
  }
}

function seek(sec) {
  return new Promise((resolve) => {
    const set = () => { try { audio.currentTime = sec; } catch { /* */ } resolve(); };
    if (audio.readyState >= 1) set();
    else audio.addEventListener('loadedmetadata', set, { once: true });
  });
}

// ---- المراقبة الدقيقة لحدود الآيات ----
// timeupdate يأتي كل ~250ms؛ نستخدم requestAnimationFrame أثناء التشغيل لدقة القفز عند التكرار/النطاقات
let rafId = 0;
function loop() {
  tick();
  if (!audio.paused) rafId = requestAnimationFrame(loop);
}
audio.addEventListener('timeupdate', tick);

function tick() {
  if (switching || !timings || st.status === 'idle' || !st.surah) return;
  const t = audio.currentTime;
  const cur = st.ayah;
  // هل تجاوزنا نهاية الآية الحالية؟
  if (cur != null && cur >= 0 && timings[cur] && t >= endOf(cur) - 0.03) {
    if (boundary(cur)) return;
  }
  const at = ayahAt(t);
  if (at !== cur && at != null) {
    // انتقال طبيعي داخل الملف (بدون أي فاصل)
    if (cur != null && at > cur) st.repeatLeft = st.range?.times || settings.get('repeat');
    st.ayah = at;
    emit();
  }
}

/** قرار عند نهاية آية: يرجع true لو تدخّلنا (قفز/إيقاف) */
function boundary(a) {
  if (st.compare) {
    st.compare.idx++;
    if (st.compare.idx < st.compare.list.length) { load(st.surah, a); return true; }
    st.compare = null;
    audio.pause(); st.status = 'idle'; emit();
    return true;
  }
  if (a !== 0 && st.repeatLeft > 1) {
    st.repeatLeft--;
    audio.currentTime = startOf(a);
    return true;
  }
  if (st.only) { audio.pause(); st.status = 'idle'; st.only = false; emit(); return true; }
  const r = st.range;
  if (r && a !== 0 && st.surah === r.to.surah && a >= r.to.ayah) {
    if (r.loop) {
      st.loops++;
      st.repeatLeft = r.times || settings.get('repeat');
      if (r.from.surah === st.surah && loadedKey === `${currentReciter()}:${st.surah}`) { st.ayah = r.from.ayah; audio.currentTime = startOf(r.from.ayah); emit(); }
      else load(r.from.surah, r.from.ayah);
      return true;
    }
    st.completed = { ...r, at: Date.now() };
    audio.pause(); st.status = 'idle'; emit();
    return true;
  }
  return false;
}

audio.addEventListener('playing', () => { st.status = 'playing'; emit(); cancelAnimationFrame(rafId); rafId = requestAnimationFrame(loop); });
audio.addEventListener('pause', () => { cancelAnimationFrame(rafId); if (st.status === 'playing') { st.status = 'paused'; emit(); } });
audio.addEventListener('waiting', () => { if (st.status !== 'idle') { st.status = 'loading'; emit(); } });
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  loadedKey = null;
  fail(navigator.onLine ? 'تعذر تحميل ملف الصوت' : null);
});
audio.addEventListener('ended', () => {
  if (!st.surah || switching) return;
  const last = getSurahMeta(st.surah).ayahCount;
  if (!timings) {
    // بلا توقيت: حدود النطاق على مستوى السورة
    const r = st.range;
    if (r && st.surah >= r.to.surah) {
      if (r.loop) { st.loops++; load(r.from.surah, 0); return; }
      st.completed = { ...r, at: Date.now() };
      st.status = 'idle'; emit(); return;
    }
  } else if (boundary(last)) return;
  const inRange = st.range && (st.surah < st.range.to.surah);
  if (st.surah < 114 && (settings.get('autoNext') || inRange) && !st.only) {
    st.repeatLeft = st.range?.times || settings.get('repeat');
    load(st.surah + 1, needsBasmala(st.surah + 1) ? 0 : 1);
    return;
  }
  st.status = 'idle'; emit();
});

/** السرعة الفعلية: المخصصة للقارئ إن وُجدت، وإلا الافتراضية */
export function rateFor(reciterId) {
  const r = (settings.get('rateByReciter') || {})[reciterId];
  return r || settings.get('rate') || 1;
}
/** تغيير سرعة القارئ الحالي (تُحفظ له وحده) */
export function setRate(v) {
  const id = currentReciter() || settings.get('reciter');
  settings.set('rateByReciter', { ...(settings.get('rateByReciter') || {}), [id]: v });
  audio.playbackRate = v;
}
settings.subscribe((k) => { if (k === 'rate' || k === 'rateByReciter') audio.playbackRate = rateFor(currentReciter() || settings.get('reciter')); });

// حفظ موضع الاستماع لاستكماله من نفس الثانية
let lastSave = 0;
function saveListen(force) {
  if (!st.surah || st.compare || switching || !audio.getAttribute('src')) return;
  const now = Date.now();
  if (!force && now - lastSave < 5000) return;
  lastSave = now;
  settings.set('lastListen', { surah: st.surah, ayah: st.ayah, reciter: currentReciter(), time: Math.max(0, audio.currentTime - 1), at: now });
}
audio.addEventListener('timeupdate', () => saveListen(false));
audio.addEventListener('pause', () => saveListen(true));
addEventListener('pagehide', () => saveListen(true));

export const player = {
  state: () => st,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** يبدأ من آية؛ {only:true} يكرر آية واحدة، {range:{from,to,loop,times}} نطاق محدد */
  playFrom(s, a, opts = {}) {
    resumeAt = null;
    st.reciter = settings.get('reciter');
    // تكرار آية أو نطاق داخل سورة يحتاج توقيت الآيات
    st.fellBack = false;
    if ((opts.only || opts.range) && isUntimed(st.reciter)) { st.reciter = timedFallback(st.reciter); st.fellBack = true; }
    st.only = !!opts.only;
    st.compare = null;
    st.range = opts.range || null;
    st.completed = null;
    st.loops = 0;
    st.repeatLeft = opts.only ? Math.max(settings.get('repeat'), opts.times || 3) : (opts.times || opts.range?.times || settings.get('repeat'));
    const start = a === 1 && needsBasmala(s) && !opts.only && !opts.noBasmala ? 0 : a;
    load(s, start);
  },
  /** مقارنة القراء: نفس الآية بأكثر من قارئ ورا بعض */
  compare(s, a, list) {
    resumeAt = null;
    st.reciter = settings.get('reciter');
    st.only = false;
    st.range = null;
    st.repeatLeft = 1;
    st.compare = { list: list.map(timedFallback), idx: 0 };
    load(s, a);
  },
  pause() { audio.pause(); },
  resume() {
    if (!st.surah) return;
    if (!audio.getAttribute('src')) { st.reciter = st.reciter || settings.get('reciter'); st.repeatLeft = settings.get('repeat'); load(st.surah, st.ayah || 0); return; }
    audio.play().catch(() => {});
  },
  /** استعادة آخر موضع استماع (بدون تحميل الصوت حتى يضغط المستخدم تشغيل) */
  restore(last) {
    if (!last || !last.surah || st.surah) return;
    Object.assign(st, { surah: last.surah, ayah: last.ayah ?? 1, reciter: last.reciter || settings.get('reciter'), status: 'paused', error: null });
    resumeAt = last.time || null;
    emit();
  },
  toggle() {
    if (st.status === 'playing') audio.pause();
    else if (st.status === 'paused' && !audio.getAttribute('src')) player.resume();
    else if (st.status === 'idle' && st.surah) player.playFrom(st.surah, st.ayah || 1);
    else player.resume();
  },
  stop() {
    loadSeq++;
    switching = false;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    loadedKey = null; timings = null; resumeAt = null;
    Object.assign(st, { status: 'idle', surah: null, ayah: null, compare: null, error: null, range: null, only: false });
    settings.set('lastListen', null);
    emit();
  },
  next() {
    if (st.surah && !timings && audio.getAttribute('src')) { if (st.surah < 114) load(st.surah + 1, 0); return; }
    if (!st.surah || !timings) return;
    st.repeatLeft = st.range?.times || settings.get('repeat');
    const count = getSurahMeta(st.surah).ayahCount;
    if (st.ayah < count) { st.ayah += 1; audio.currentTime = startOf(st.ayah); emit(); }
    else if (st.surah < 114) load(st.surah + 1, needsBasmala(st.surah + 1) ? 0 : 1);
  },
  prev() {
    if (st.surah && !timings && audio.getAttribute('src')) {
      if (audio.currentTime > 5 || st.surah === 1) audio.currentTime = 0; else load(st.surah - 1, 0);
      return;
    }
    if (!st.surah || !timings) return;
    st.repeatLeft = st.range?.times || settings.get('repeat');
    const a = st.ayah || 0;
    if (audio.currentTime - startOf(a) > 3) { audio.currentTime = startOf(a); return; }
    const first = needsBasmala(st.surah) ? 0 : 1;
    if (a > first) { st.ayah = a - 1; audio.currentTime = startOf(st.ayah); emit(); }
    else if (st.surah > 1) load(st.surah - 1, getSurahMeta(st.surah - 1).ayahCount);
    else audio.currentTime = startOf(a);
  },
  setReciter(id) {
    settings.set('reciter', id);
    if (st.surah && st.status !== 'idle') { st.reciter = id; load(st.surah, st.ayah ?? (needsBasmala(st.surah) ? 0 : 1)); }
  },
  /** لمؤقت النوم: 0..1 */
  setFade(v) { sleepFade = v; audio.volume = v; },
  get audio() { return audio; },
};

setupMediaSession(player);
