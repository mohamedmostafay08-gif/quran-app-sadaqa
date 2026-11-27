// البحث في نص التفسيرين المحليين (الميسر والسعدي): يُحمَّلان مرة (ويحفظهما الـ Service Worker للعمل بدون إنترنت)،
// ويُوحَّد النص كما يُوحَّد نص القرآن في البحث، ثم تُعرض مقتطفات من النص الأصلي مع تظليل الموضع.
import { normalize, DIACRITICS } from '../lib/arabic.js';
import { getSurahs } from '../data.js';

export const BOOKS = [['muyassar', 'التفسير الميسر', 'tafsir'], ['saadi', 'تفسير السعدي', 'tafsir-saadi']];
const url = (dir, s) => new URL(`../../public/data/${dir}/${s}.json`, import.meta.url);

let indexP = null;
const idle = () => new Promise((r) => setTimeout(r, 0));

/** { muyassar: { raw: [[نص الآية]...], norm: [[...]] }, saadi: {...} } */
export function loadIndex(onProgress) {
  if (indexP) return indexP;
  indexP = (async () => {
    const out = Object.fromEntries(BOOKS.map(([id]) => [id, { raw: new Array(114), norm: new Array(114) }]));
    const jobs = BOOKS.flatMap(([id, , dir]) => getSurahs().map((m) => [id, dir, m.id]));
    let i = 0, done = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const [id, dir, s] = jobs[i++];
        const res = await fetch(url(dir, s));
        if (!res.ok) throw new Error(res.status);
        const arr = await res.json();
        out[id].raw[s - 1] = arr;
        // الرقم بدل النص = تفسير مشترك مع آية سابقة (يُبحث فيه مرة واحدة عند أول آياته)
        out[id].norm[s - 1] = arr.map((t) => (typeof t === 'string' ? normalize(t) : ''));
        onProgress?.(++done, jobs.length);
        await idle(); // لا نحجز الواجهة أثناء التوحيد
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return out;
  })().catch((e) => { indexP = null; throw e; });
  return indexP;
}

// نفس قواعد normalize حرفًا بحرف، مع حفظ موضع كل حرف في النص الأصلي (للمقتطف والتظليل)
const DIAC = new RegExp(DIACRITICS.source);
const MAP = { '\u0623': '\u0627', '\u0625': '\u0627', '\u0622': '\u0627', '\u0671': '\u0627', '\u0649': '\u064A', '\u0629': '\u0647', '\u0624': '\u0648', '\u0626': '\u064A' };
export function normalizeWithMap(s) {
  let out = '';
  const map = [];
  let space = true; // لا مسافة في البداية
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (DIAC.test(c)) continue;
    c = MAP[c] || c;
    if (/\s/.test(c)) { if (space) continue; c = ' '; space = true; }
    else if (c < '\u0621' || c > '\u064A') continue;
    else space = false;
    out += c; map.push(i);
  }
  if (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
  return { out, map };
}

/** مقتطف حول الموضع: [قبل، المطابق، بعد] من النص الأصلي */
function snippet(raw, nq, re) {
  const { out, map } = normalizeWithMap(raw);
  let at = -1, len = nq.length;
  if (re) { const m = re.exec(out); if (m) { at = m.index + m[1].length; } } else at = out.indexOf(nq);
  if (at < 0) return [raw.slice(0, 160), '', ''];
  const from = map[at], to = map[at + len - 1] + 1;
  const RADIUS = 70;
  let a = Math.max(0, from - RADIUS), b = Math.min(raw.length, to + RADIUS);
  // لا نقطع الكلمات
  if (a > 0) { const sp = raw.indexOf(' ', a); if (sp > -1 && sp < from) a = sp + 1; }
  if (b < raw.length) { const sp = raw.lastIndexOf(' ', b); if (sp > to) b = sp; }
  return [(a > 0 ? '… ' : '') + raw.slice(a, from), raw.slice(from, to), raw.slice(to, b) + (b < raw.length ? ' …' : '')];
}

/** يرجع { total, hits: [{ book, name, s, a, parts }] } مرتبة بالمصحف، الميسر قبل السعدي في نفس الآية */
export async function searchTafsir(q, { exact = false, max = 200, onProgress } = {}) {
  const nq = normalize(q);
  const idx = await loadIndex(onProgress);
  const re = exact ? new RegExp(`(^| )${nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($| )`) : null;
  const hits = [];
  let total = 0;
  for (let s = 0; s < 114; s++) {
    const n = idx[BOOKS[0][0]].norm[s].length;
    for (let a = 0; a < n; a++) {
      for (const [id, name] of BOOKS) {
        const t = idx[id].norm[s][a];
        if (!t || !(re ? re.test(t) : t.includes(nq))) continue;
        total++;
        if (hits.length < max) hits.push({ book: id, name, s: s + 1, a: a + 1, parts: snippet(idx[id].raw[s][a], nq, re) });
      }
    }
  }
  return { total, hits };
}
