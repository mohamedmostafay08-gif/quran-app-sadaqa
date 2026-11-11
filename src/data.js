// طبقة البيانات: فهرس السور، نص المصحف (IndexedDB)، وبيانات الصفحات/الأجزاء
import { db } from './db.js';

const BASE = new URL('../public/data/', import.meta.url).href;

let surahs = null;        // [{ id, nameAr, nameEn, ayahCount, revelation, basmala, ... }]
let meta = null;          // { juz, pages, quarters, sajdas } بالفهرس العام
let notice = null;        // معلومات المصدر والإصدار
let starts = null;        // فهرس أول آية لكل سورة في الترقيم العام (0..6235)
const surahCache = new Map();
let simplePromise = null;

async function getJSON(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`تعذر تحميل ${name} (${res.status})`);
  return res.json();
}

/** تجهيز البيانات عند بدء التشغيل. أول مرة: ينقل النص كله إلى IndexedDB. */
export async function initData(onProgress) {
  const [s, m] = await Promise.all([getJSON('surahs.json'), getJSON('quran-meta.json')]);
  surahs = s;
  starts = [];
  let acc = 0;
  for (const su of surahs) { starts.push(acc); acc += su.ayahCount; }
  const g = ([su, a]) => starts[su - 1] + a - 1;
  meta = {
    juz: m.juz.map(g),
    pages: m.pages.map(g),
    quarters: m.quarters.map(g),
    sajdas: new Map(m.sajdas.map(([su, a, t]) => [g([su, a]), t])),
    juzRaw: m.juz,
    pagesRaw: m.pages,
  };

  const stored = await db.get('settings', 'dataNotice').catch(() => null);
  const count = await db.count('ayahs').catch(() => 0);
  if (stored && count === 114) {
    notice = stored.value;
    return;
  }
  // أول تشغيل: نقل النص إلى IndexedDB في الخلفية دون تعطيل ظهور الواجهة
  importPromise = importText().catch((e) => { importPromise = null; console.warn('text import failed', e); });
}

let importPromise = null;
async function importText() {
  const q = await getJSON('quran-uthmani.json');
  q.ayahs.forEach((a, i) => surahCache.set(i + 1, a));
  notice = q.notice;
  await db.putMany('ayahs', q.ayahs.map((ayahs, i) => ({ id: i + 1, ayahs })));
  await db.put('settings', { key: 'dataNotice', value: q.notice });
}

export const getSurahs = () => surahs;
export const getSurahMeta = (n) => surahs[n - 1];
export const getNotice = () => notice;
export const TOTAL_AYAHS = 6236;

/** نص آيات سورة (مصفوفة نصوص) */
export async function getSurahText(n) {
  if (surahCache.has(n)) return surahCache.get(n);
  if (importPromise) { await importPromise; if (surahCache.has(n)) return surahCache.get(n); }
  let rec = await db.get('ayahs', n);
  if (!rec) {
    // احتياطي: لو التخزين اتمسح، نعيد التحميل
    const q = await getJSON('quran-uthmani.json');
    await db.putMany('ayahs', q.ayahs.map((ayahs, i) => ({ id: i + 1, ayahs })));
    rec = { ayahs: q.ayahs[n - 1] };
  }
  surahCache.set(n, rec.ayahs);
  if (!importPromise && surahCache.size > 12) surahCache.delete(surahCache.keys().next().value);
  return rec.ayahs;
}

/** النص الإملائي بدون تشكيل (للبحث) — يُحمَّل عند الحاجة */
export function getSimpleText() {
  if (!simplePromise) simplePromise = getJSON('quran-simple.json').then((d) => d.ayahs);
  return simplePromise;
}

// ---------- الترقيم العام وحساب الصفحة/الجزء ----------
export const globalIndex = (s, a) => starts[s - 1] + a - 1;
export function fromGlobal(i) {
  let lo = 0, hi = 113;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= i) lo = mid; else hi = mid - 1; }
  return { surah: lo + 1, ayah: i - starts[lo] + 1 };
}
function bucket(arr, i) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= i) lo = mid; else hi = mid - 1; }
  return lo + 1;
}
export const pageOf = (s, a) => bucket(meta.pages, globalIndex(s, a));
export const juzOf = (s, a) => bucket(meta.juz, globalIndex(s, a));
export const quarterOf = (s, a) => bucket(meta.quarters, globalIndex(s, a));
export const sajdaAt = (s, a) => meta.sajdas.get(globalIndex(s, a)) || null;

/** هل الآية بداية صفحة/جزء/ربع؟ */
export function boundariesAt(s, a) {
  const i = globalIndex(s, a);
  const out = {};
  const p = meta.pages.indexOf(i); if (p >= 0) out.page = p + 1;
  const j = meta.juz.indexOf(i); if (j >= 0) out.juz = j + 1;
  const q = meta.quarters.indexOf(i); if (q >= 0) out.quarter = q + 1;
  return out;
}

/** بداية الجزء n كـ {surah, ayah} */
export const juzStart = (n) => ({ surah: meta.juzRaw[n - 1][0], ayah: meta.juzRaw[n - 1][1] });
export const pageStart = (n) => ({ surah: meta.pagesRaw[n - 1][0], ayah: meta.pagesRaw[n - 1][1] });

/** وصف الربع: "الحزب ٣" أو "ربع الحزب ٣" … */
export function quarterLabel(q) {
  const hizb = Math.ceil(q / 4);
  const pos = (q - 1) % 4;
  return [`الحزب ${hizb}`, `ربع الحزب ${hizb}`, `نصف الحزب ${hizb}`, `ثلاثة أرباع الحزب ${hizb}`][pos];
}

/** اسم السورة مع البادئة */
export const surahTitle = (n) => `سورة ${surahs[n - 1].nameAr}`;
