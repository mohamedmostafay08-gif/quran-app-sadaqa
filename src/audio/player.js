// محرك الصوت: تشغيل آية آية من EveryAyah مع طابور، تكرار، سرعة، وتحميل مسبق
import * as settings from '../state.js';
import { getSurahMeta } from '../data.js';
import { setupMediaSession, updateMediaSession } from './mediaSession.js';

const AUDIO_BASE = 'https://everyayah.com/data/';
const pad = (n) => String(n).padStart(3, '0');

let reciters = [];
export async function loadReciters() {
  const res = await fetch(new URL('../../public/data/reciters.json', import.meta.url));
  reciters = await res.json();
  return reciters;
}
export const getReciters = () => reciters;
export const getReciter = (id) => reciters.find((r) => r.id === id) || reciters[0];

export function ayahUrl(reciterId, s, a) {
  return `${AUDIO_BASE}${reciterId}/${pad(s)}${pad(a)}.mp3`;
}

// ---- الحالة ----
const st = {
  status: 'idle',      // idle | loading | playing | paused
  surah: null,
  ayah: null,          // 0 = البسملة
  reciter: null,
  only: false,         // تكرار آية واحدة
  repeatLeft: 0,
  compare: null,       // { list: [reciterIds], idx }
  error: null,
  range: null,         // { from:{surah,ayah}, to:{surah,ayah}, loop } نطاق (ورد / حفظ)
  completed: null,     // آخر نطاق اكتمل تشغيله (لتسجيل الورد)
};
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(st); updateMediaSession(st); };

const audio = new Audio();
audio.preload = 'auto';
const preloader = new Audio();
preloader.preload = 'auto';
let sleepFade = 1;

function src(s, a, reciterId = st.reciter) {
  // الآية 0 = البسملة (تُقرأ من ملف الفاتحة 1 كما في EveryAyah)
  return a === 0 ? ayahUrl(reciterId, 1, 1) : ayahUrl(reciterId, s, a);
}

function needsBasmala(s) { return s !== 1 && s !== 9; }

async function load(s, a) {
  st.surah = s; st.ayah = a; st.status = 'loading'; st.error = null;
  const reciterId = st.compare ? st.compare.list[st.compare.idx] : st.reciter;
  audio.src = src(s, a, reciterId);
  audio.playbackRate = settings.get('rate');
  audio.volume = sleepFade;
  emit();
  try {
    await audio.play();
  } catch (e) {
    if (e.name === 'AbortError') return;
    st.status = 'paused';
    st.error = navigator.onLine ? 'تعذر تشغيل الصوت' : 'لا يوجد اتصال، والآية غير منزّلة';
    emit();
    return;
  }
  preloadNext();
}

function nextPos() {
  const { surah: s, ayah: a } = st;
  const count = getSurahMeta(s).ayahCount;
  if (st.range && a !== 0) {
    const t = st.range.to;
    if (s > t.surah || (s === t.surah && a >= t.ayah)) {
      if (st.range.loop) return { s: st.range.from.surah, a: st.range.from.ayah };
      return null;
    }
  }
  if (a < count) return { s, a: a + 1 };
  if (s >= 114 || (!settings.get('autoNext') && !st.range)) return null;
  const ns = s + 1;
  return { s: ns, a: needsBasmala(ns) ? 0 : 1 };
}

function preloadNext() {
  if (st.only || st.compare) return;
  const n = nextPos();
  if (n) preloader.src = src(n.s, n.a);
}

audio.addEventListener('playing', () => { st.status = 'playing'; emit(); });
audio.addEventListener('pause', () => { if (st.status === 'playing') { st.status = 'paused'; emit(); } });
audio.addEventListener('waiting', () => { st.status = 'loading'; emit(); });
audio.addEventListener('error', () => {
  if (!audio.src) return;
  st.status = 'paused';
  st.error = navigator.onLine ? 'تعذر تحميل ملف الصوت' : 'لا يوجد اتصال، والآية غير منزّلة';
  emit();
});
audio.addEventListener('ended', () => {
  if (st.compare) {
    st.compare.idx++;
    if (st.compare.idx < st.compare.list.length) return load(st.surah, st.ayah);
    st.compare = null;
    st.status = 'idle'; emit();
    return;
  }
  if (st.ayah !== 0 && st.repeatLeft > 1) { st.repeatLeft--; return load(st.surah, st.ayah); }
  if (st.only) { st.status = 'idle'; emit(); return; }
  const n = nextPos();
  if (!n) {
    if (st.range) st.completed = { ...st.range, at: Date.now() };
    st.status = 'idle'; emit(); return;
  }
  if (st.range?.loop && n.s === st.range.from.surah && n.a === st.range.from.ayah) st.loops = (st.loops || 0) + 1;
  st.repeatLeft = st.range?.times || settings.get('repeat');
  load(n.s, n.a);
});

settings.subscribe((k, v) => {
  if (k === 'rate') audio.playbackRate = v;
});

export const player = {
  state: () => st,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** يبدأ من آية؛ {only:true} يكرر آية واحدة، {range:{from,to}} نطاق محدد */
  playFrom(s, a, opts = {}) {
    st.reciter = settings.get('reciter');
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
    st.reciter = settings.get('reciter');
    st.only = true;
    st.range = null;
    st.compare = { list, idx: 0 };
    load(s, a);
  },
  pause() { audio.pause(); },
  resume() { if (st.surah) audio.play().catch(() => {}); },
  toggle() { st.status === 'playing' ? audio.pause() : (st.status === 'idle' && st.surah ? player.playFrom(st.surah, st.ayah || 1) : player.resume()); },
  stop() {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    Object.assign(st, { status: 'idle', surah: null, ayah: null, compare: null, error: null });
    emit();
  },
  next() {
    if (!st.surah) return;
    const count = getSurahMeta(st.surah).ayahCount;
    if (st.ayah < count) load(st.surah, st.ayah + 1);
    else if (st.surah < 114) load(st.surah + 1, needsBasmala(st.surah + 1) ? 0 : 1);
  },
  prev() {
    if (!st.surah) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (st.ayah > 1) load(st.surah, st.ayah - 1);
    else if (st.surah > 1) load(st.surah - 1, getSurahMeta(st.surah - 1).ayahCount);
  },
  setReciter(id) {
    settings.set('reciter', id);
    if (st.surah && st.status !== 'idle') { st.reciter = id; load(st.surah, st.ayah); }
  },
  /** لمؤقت النوم: 0..1 */
  setFade(v) { sleepFade = v; audio.volume = v; },
  get audio() { return audio; },
};

setupMediaSession(player);
