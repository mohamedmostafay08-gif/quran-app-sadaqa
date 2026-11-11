// المساحة، التخزين الدائم، وحذف الملفات الصوتية
import { db } from '../db.js';

export const AUDIO_CACHE = 'audio-v1';

export async function estimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export async function isPersisted() {
  return navigator.storage?.persisted ? navigator.storage.persisted() : false;
}

/** يطلب من المتصفح عدم مسح البيانات (مهم على iOS) */
export async function requestPersist() {
  if (!navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

export async function downloadsFor(reciterId) {
  const all = await db.all('downloads');
  return new Map(all.filter((d) => d.reciter === reciterId).map((d) => [d.surah, d]));
}

export async function totalAudioBytes() {
  const all = await db.all('downloads');
  return all.reduce((s, d) => s + (d.bytes || 0), 0);
}

export async function deleteSurah(reciterId, s, urls) {
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(urls.map((u) => cache.delete(u)));
  await db.del('downloads', `${reciterId}:${s}`);
}

export async function deleteReciter(reciterId) {
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.filter((r) => r.url.includes(`/${reciterId}/`)).map((r) => cache.delete(r)));
  const all = await db.all('downloads');
  await Promise.all(all.filter((d) => d.reciter === reciterId).map((d) => db.del('downloads', d.id)));
}
