// تنزيل سور/قراء كاملة للأوفلاين مع طابور وتقدم وإلغاء
import { db } from '../db.js';
import { ayahUrl } from '../audio/player.js';
import { getSurahMeta } from '../data.js';
import { AUDIO_CACHE, requestPersist, deleteSurah as removeFiles } from './storage.js';

const CONCURRENCY = 4;
const queue = [];          // [{ reciter, surah }]
let active = null;         // { reciter, surah, done, total, bytes, abort }
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(status()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const status = () => ({
  active: active && { reciter: active.reciter, surah: active.surah, done: active.done, total: active.total },
  queued: queue.map((q) => ({ ...q })),
});

/** روابط ملفات السورة (البسملة من ملف الفاتحة 1 لكل السور عدا الفاتحة والتوبة) */
export function surahUrls(reciter, s, { forDelete = false } = {}) {
  const n = getSurahMeta(s).ayahCount;
  const urls = Array.from({ length: n }, (_, i) => ayahUrl(reciter, s, i + 1));
  if (!forDelete && s !== 1 && s !== 9) urls.unshift(ayahUrl(reciter, 1, 1));
  return urls;
}

export function isQueued(reciter, s) {
  return (active && active.reciter === reciter && active.surah === s) || queue.some((q) => q.reciter === reciter && q.surah === s);
}

export function enqueue(reciter, surahs) {
  requestPersist();
  for (const s of [].concat(surahs)) if (!isQueued(reciter, s)) queue.push({ reciter, surah: s });
  emit();
  pump();
}

export function cancel(reciter, s) {
  const i = queue.findIndex((q) => q.reciter === reciter && q.surah === s);
  if (i >= 0) queue.splice(i, 1);
  if (active && active.reciter === reciter && active.surah === s) active.abort.abort();
  emit();
}
export function cancelAll() {
  queue.length = 0;
  active?.abort.abort();
  emit();
}

export async function deleteSurah(reciter, s) {
  cancel(reciter, s);
  await removeFiles(reciter, s, surahUrls(reciter, s, { forDelete: true }));
  emit();
}

let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      await run(job);
    }
  } finally {
    pumping = false;
    active = null;
    emit();
  }
}

async function run({ reciter, surah }) {
  const urls = surahUrls(reciter, surah);
  const abort = new AbortController();
  active = { reciter, surah, done: 0, total: urls.length, bytes: 0, abort };
  emit();
  const cache = await caches.open(AUDIO_CACHE);
  const id = `${reciter}:${surah}`;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < urls.length && !abort.signal.aborted) {
      const url = urls[i++];
      try {
        const hit = await cache.match(url);
        if (hit) {
          active.bytes += +(hit.headers.get('content-length') || 0) || (await hit.blob()).size;
        } else {
          const res = await fetch(url, { mode: 'cors', signal: abort.signal });
          if (!res.ok) throw new Error(res.status);
          const blob = await res.blob();
          await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }));
          active.bytes += blob.size;
        }
        active.done++;
      } catch (e) {
        if (abort.signal.aborted) return;
        failed++;
      }
      emit();
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const complete = !abort.signal.aborted && failed === 0;
  await db.put('downloads', {
    id, reciter, surah,
    status: complete ? 'done' : 'partial',
    files: active.done, total: urls.length,
    bytes: active.bytes, updatedAt: Date.now(),
  });
}

/** حالة السورة من الكاش مباشرة (للتأكد) */
export async function verify(reciter, s) {
  const cache = await caches.open(AUDIO_CACHE);
  const urls = surahUrls(reciter, s);
  const hits = await Promise.all(urls.map((u) => cache.match(u)));
  return hits.filter(Boolean).length === urls.length;
}
