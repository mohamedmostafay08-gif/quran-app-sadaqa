// نسخة احتياطية كاملة لبيانات المستخدم في ملف واحد، واستعادتها على أي جهاز
import { db } from '../db.js';
import * as settings from '../state.js';

const STORES = ['bookmarks', 'notes', 'memorize', 'khatma'];
// إعدادات لا معنى لنقلها بين الأجهزة
const SKIP_SETTINGS = new Set(['dataNotice', 'lastListen']);

export async function exportBackup() {
  const stores = {};
  for (const s of STORES) stores[s] = await db.all(s);
  stores.settings = (await db.all('settings')).filter((r) => !SKIP_SETTINGS.has(r.key));
  const data = { app: 'rattil', version: 1, exportedAt: new Date().toISOString(), stores };
  await settings.set('lastBackupAt', Date.now());
  return data;
}

export function summary(data) {
  const s = data.stores || {};
  return {
    bookmarks: (s.bookmarks || []).length,
    notes: (s.notes || []).length,
    memorize: (s.memorize || []).length,
    khatma: (s.khatma || []).length,
    groups: ((s.settings || []).find((r) => r.key === 'myGroups')?.value || []).length,
  };
}

/** يقرأ ملف النسخة ويتحقق منه */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('الملف ليس نسخة احتياطية صالحة'); }
  if (data?.app !== 'rattil' || typeof data.stores !== 'object') throw new Error('الملف ليس نسخة احتياطية من «رتّل»');
  return data;
}

/** دمج النسخة مع البيانات الحالية (العناصر بنفس المفتاح تُستبدل بما في النسخة) */
export async function importBackup(data) {
  const s = data.stores;
  for (const name of STORES) {
    const rows = Array.isArray(s[name]) ? s[name].filter((r) => r && typeof r === 'object' && r.id != null) : [];
    if (rows.length) await db.putMany(name, rows);
  }
  const rows = Array.isArray(s.settings) ? s.settings.filter((r) => r && typeof r.key === 'string' && !SKIP_SETTINGS.has(r.key)) : [];
  // الختمات الجماعية: دمج القائمتين بدل الاستبدال
  const groups = rows.find((r) => r.key === 'myGroups');
  if (groups && Array.isArray(groups.value)) {
    const mine = settings.get('myGroups') || [];
    const byId = new Map([...mine, ...groups.value].map((g) => [g.id, { ...(mine.find((x) => x.id === g.id) || {}), ...g }]));
    groups.value = [...byId.values()];
  }
  if (rows.length) await db.putMany('settings', rows);
}

export function backupFilename() {
  return `rattil-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
