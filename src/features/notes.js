// الملاحظات والتظليل الملوّن + التصدير
import { db } from '../db.js';
import { getSurahMeta, getSurahText } from '../data.js';

export const COLORS = [
  { id: 'yellow', name: 'أصفر' },
  { id: 'green', name: 'أخضر' },
  { id: 'blue', name: 'أزرق' },
  { id: 'pink', name: 'وردي' },
];

let cache = null;
const key = (s, a) => `${s}:${a}`;
async function load() {
  if (!cache) cache = new Map((await db.all('notes')).map((n) => [n.id, n]));
  return cache;
}

export async function get(s, a) { return (await load()).get(key(s, a)) || null; }
export async function inSurah(s) {
  return new Map([...(await load()).values()].filter((n) => n.surah === s).map((n) => [n.ayah, n]));
}
export async function list() {
  return [...(await load()).values()].sort((x, y) => x.surah - y.surah || x.ayah - y.ayah);
}

/** يحفظ ملاحظة/لون؛ لو الاتنين فاضيين يحذف */
export async function save(s, a, { text = '', color = null }) {
  const m = await load();
  const id = key(s, a);
  text = text.trim();
  if (!text && !color) { m.delete(id); await db.del('notes', id); return null; }
  const n = { id, surah: s, ayah: a, text, color, updatedAt: Date.now() };
  m.set(id, n);
  await db.put('notes', n);
  return n;
}

/** تصدير نصي قابل للقراءة */
export async function exportText() {
  const all = await list();
  const lines = ['ملاحظاتي على القرآن الكريم', `تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`, ''];
  for (const n of all) {
    const m = getSurahMeta(n.surah);
    const ayah = (await getSurahText(n.surah))[n.ayah - 1];
    lines.push(`■ سورة ${m.nameAr} – الآية ${n.ayah}${n.color ? ` [${COLORS.find((c) => c.id === n.color)?.name || n.color}]` : ''}`);
    lines.push(`﴿${ayah}﴾`);
    if (n.text) lines.push(n.text);
    lines.push('');
  }
  return lines.join('\n');
}

export async function exportJSON() {
  return JSON.stringify({ app: 'quran-app', version: 1, exportedAt: new Date().toISOString(), notes: await list() }, null, 2);
}

export async function importJSON(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.notes)) throw new Error('ملف غير صالح');
  let n = 0;
  for (const x of data.notes) {
    if (!Number.isInteger(x.surah) || !Number.isInteger(x.ayah)) continue;
    await save(x.surah, x.ayah, { text: String(x.text || ''), color: COLORS.some((c) => c.id === x.color) ? x.color : null });
    n++;
  }
  return n;
}

export function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
