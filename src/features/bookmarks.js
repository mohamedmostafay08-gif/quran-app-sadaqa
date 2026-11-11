// العلامات المرجعية وآخر موضع قراءة
import { db } from '../db.js';
import * as settings from '../state.js';

let cache = null;
const key = (s, a) => `${s}:${a}`;

async function load() {
  if (!cache) cache = new Map((await db.all('bookmarks')).map((b) => [b.id, b]));
  return cache;
}

export async function list() {
  return [...(await load()).values()].sort((x, y) => y.createdAt - x.createdAt);
}
export async function has(s, a) { return (await load()).has(key(s, a)); }
export async function bookmarkedIn(s) {
  return new Set([...(await load()).values()].filter((b) => b.surah === s).map((b) => b.ayah));
}

/** يقلب حالة العلامة ويرجع الحالة الجديدة */
export async function toggle(s, a) {
  const m = await load();
  const id = key(s, a);
  if (m.has(id)) { m.delete(id); await db.del('bookmarks', id); return false; }
  const b = { id, surah: s, ayah: a, createdAt: Date.now() };
  m.set(id, b);
  await db.put('bookmarks', b);
  return true;
}
export async function remove(s, a) {
  const m = await load();
  m.delete(key(s, a));
  await db.del('bookmarks', key(s, a));
}

export function saveLastRead(s, a) {
  const cur = settings.get('lastRead');
  if (cur && cur.surah === s && cur.ayah === a) return;
  settings.set('lastRead', { surah: s, ayah: a, at: Date.now() });
}
