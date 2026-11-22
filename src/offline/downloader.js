// تنزيل سور/قراء كاملة للأوفلاين مع طابور وتقدم وإلغاء
// يدعم Background Fetch API (التنزيل يستمر حتى عند إغلاق التطبيق)
import { db } from '../db.js';
import { surahUrl, timingUrl, surahUrlFor, timingUrlFor, variantOf, pinVariant } from '../audio/player.js';
import { getSurahMeta } from '../data.js';
import { AUDIO_CACHE, requestPersist, deleteSurah as removeFiles } from './storage.js';

const CONCURRENCY = 2;
const queue = [];          // [{ reciter, surah }]
let active = null;         // { reciter, surah, done, total, bytes, abort }
const bgfetchIds = new Map(); // `${reciter}:${surah}` → معرّف Background Fetch المسجَّل فعلًا
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(status()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let soon = 0;
const emitSoon = () => { if (!soon) soon = setTimeout(() => { soon = 0; emit(); }, 250); };

export const status = () => ({
  active: active && { reciter: active.reciter, surah: active.surah, done: active.done + (active.fraction || 0), total: active.total },
  queued: queue.map((q) => ({ ...q })),
  bgfetching: [...bgfetchIds.keys()].map((id) => { const [r, s] = id.split(':'); return { reciter: r, surah: +s }; }),
});

/** ملفات السورة: الصوت الكامل + توقيت الآيات (التوقيت صغير ويبقى عند الحذف) */
export function surahUrls(reciter, s, { forDelete = false, variant } = {}) {
  const a = variant ? surahUrlFor(reciter, s, variant) : surahUrl(reciter, s);
  const t = variant ? timingUrlFor(reciter, s, variant) : timingUrl(reciter, s);
  return forDelete ? [a] : [a, t];
}

/** عند فتح التطبيق: نثبّت كل سورة منزّلة على النسخة المحفوظة فعلًا على الجهاز */
export async function initPins() {
  let rows = [];
  try { rows = await db.all('downloads'); } catch { return; }
  const cache = await caches.open(AUDIO_CACHE).catch(() => null);
  for (const r of rows) {
    if (r.status !== 'done') continue;
    if (r.variant) { pinVariant(r.reciter, r.surah, r.variant); continue; }
    // تنزيلات قديمة لم تُسجَّل نسختها: نبحث عن الملف المحفوظ بين النسختين
    if (!cache) continue;
    for (const v of ['qdc', 'base']) {
      if (await cache.match(surahUrlFor(r.reciter, r.surah, v))) {
        pinVariant(r.reciter, r.surah, v);
        db.put('downloads', { ...r, variant: v }).catch(() => {});
        break;
      }
    }
  }
}

export function isQueued(reciter, s) {
  return bgfetchIds.has(`${reciter}:${s}`) ||
    (active && active.reciter === reciter && active.surah === s) ||
    queue.some((q) => q.reciter === reciter && q.surah === s);
}

export function enqueue(reciter, surahs) {
  requestPersist();
  const toAdd = [];
  for (const s of [].concat(surahs)) {
    if (!isQueued(reciter, s)) { queue.push({ reciter, surah: s }); toAdd.push(s); }
  }
  emit();
  if (toAdd.length) _tryBgFetch(reciter, toAdd);
  pump();
}

export async function cancel(reciter, s) {
  // إلغاء Background Fetch إن وُجد
  const bgId = bgfetchIds.get(`${reciter}:${s}`);
  if (bgId) {
    try {
      const reg = await navigator.serviceWorker?.ready;
      const bgf = await reg?.backgroundFetch?.get(bgId);
      bgf?.abort().catch(() => {});
    } catch {}
    bgfetchIds.delete(`${reciter}:${s}`);
  }
  const i = queue.findIndex((q) => q.reciter === reciter && q.surah === s);
  if (i >= 0) queue.splice(i, 1);
  if (active && active.reciter === reciter && active.surah === s) active.abort.abort();
  emit();
}
export function cancelAll() {
  // إلغاء كل Background Fetches
  for (const bgId of bgfetchIds.values()) {
    navigator.serviceWorker?.ready.then((reg) =>
      reg?.backgroundFetch?.get(bgId)?.then((bgf) => bgf?.abort())
    ).catch(() => {});
  }
  bgfetchIds.clear();
  queue.length = 0;
  active?.abort.abort();
  emit();
}

/** يحاول تسجيل Background Fetch لكل سورة — يُزيل من الطابور العادي إن نجح */
async function _tryBgFetch(reciter, surahs) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.backgroundFetch) return; // غير مدعوم
    for (const s of surahs) {
      const variant = variantOf(reciter);
      const urls = surahUrls(reciter, s, { variant });
      const id = `dl_${reciter}_${s}_${variant}`;
      try {
        // إذا كان هناك تنزيل قائم بنفس الـ id أُلغي سابقًا، نتجاوزه
        const existing = await reg.backgroundFetch.get(id).catch(() => null);
        if (existing) continue;
        const meta = getSurahMeta(s);
        await reg.backgroundFetch.fetch(id, urls, {
          title: `سورة ${meta?.nameAr || s} — رتّل`,
          icons: [{ sizes: '192x192', src: 'public/icons/icon-192.png', type: 'image/png' }],
        });
        // نجح التسجيل: نُزيل من الطابور العادي وندير عبر bgfetchIds
        const qi = queue.findIndex((q) => q.reciter === reciter && q.surah === s);
        if (qi >= 0) queue.splice(qi, 1);
        bgfetchIds.set(`${reciter}:${s}`, id);
        emit();
      } catch {
        // هذه السورة ستُنزَّل بالطريقة العادية
      }
    }
  } catch {}
}

/** يستقبل رسائل الـ SW عند اكتمال Background Fetch */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    if (e.data?.type !== 'bgfetch-done') return;
    const { reciter, surah, variant, done, failed, bytes, total } = e.data;
    bgfetchIds.delete(`${reciter}:${surah}`);
    // نُثبّت نسخة الملف في الذاكرة
    if (done > 0 && typeof pinVariant === 'function') pinVariant(reciter, surah, variant);
    // نكتب حالة التنزيل في IndexedDB
    const complete = failed === 0 && done > 0;
    db.put('downloads', {
      id: `${reciter}:${surah}`, reciter, surah,
      status: complete ? 'done' : 'partial', variant: variant || 'qdc',
      files: done, total: total || 2, bytes: bytes || 0, updatedAt: Date.now(),
    }).catch(() => {});
    emit();
  });
}

export async function deleteSurah(reciter, s) {
  cancel(reciter, s);
  // نحذف النسختين احتياطًا (قد تكون السورة نُزّلت قبل تسجيل النسخة)
  await removeFiles(reciter, s, ['qdc', 'base'].map((v) => surahUrlFor(reciter, s, v)));
  pinVariant(reciter, s, null);
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
  const variant = variantOf(reciter);
  const urls = surahUrls(reciter, surah, { variant });
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
    status: complete ? 'done' : 'partial', variant,
    files: active.done, total: urls.length,
    bytes: active.bytes, updatedAt: Date.now(),
  });
  if (complete) pinVariant(reciter, surah, variant);
}
