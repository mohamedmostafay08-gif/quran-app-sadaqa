// تنزيل سور/قراء كاملة للأوفلاين مع طابور وتقدم وإلغاء
import { db } from '../db.js';
import { surahUrl, timingUrl } from '../audio/player.js';
import { AUDIO_CACHE, requestPersist, deleteSurah as removeFiles } from './storage.js';

const CONCURRENCY = 2;
const queue = [];          // [{ reciter, surah }]
let active = null;         // { reciter, surah, done, total, bytes, abort }
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(status()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let soon = 0;
const emitSoon = () => { if (!soon) soon = setTimeout(() => { soon = 0; emit(); }, 250); };

export const status = () => ({
  active: active && { reciter: active.reciter, surah: active.surah, done: active.done + (active.fraction || 0), total: active.total },
  queued: queue.map((q) => ({ ...q })),
});

/** ملفات السورة: الصوت الكامل + توقيت الآيات (التوقيت صغير ويبقى عند الحذف) */
export function surahUrls(reciter, s, { forDelete = false } = {}) {
  return forDelete ? [surahUrl(reciter, s)] : [surahUrl(reciter, s), timingUrl(reciter, s)];
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
          const type = url.endsWith('.mp3') ? 'audio/mpeg' : 'application/json';
          const total = +(res.headers.get('content-length') || 0);
          // حفظ متدفق مع تقدم بالبايت (ملف السورة قد يتجاوز 100 م.ب)
          let loaded = 0;
          const reader = res.body.getReader();
          const stream = new ReadableStream({
            async pull(ctrl) {
              const { done, value } = await reader.read();
              if (done) { ctrl.close(); return; }
              loaded += value.length;
              if (total && type === 'audio/mpeg') { active.fraction = loaded / total; emitSoon(); }
              ctrl.enqueue(value);
            },
            cancel() { reader.cancel(); },
          });
          const headers = { 'Content-Type': type };
          if (total) headers['Content-Length'] = String(total);
          await cache.put(url, new Response(stream, { headers }));
          if (abort.signal.aborted) { await cache.delete(url); return; }
          active.bytes += loaded;
          active.fraction = 0;
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
