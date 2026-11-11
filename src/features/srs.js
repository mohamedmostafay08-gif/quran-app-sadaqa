// جدولة المراجعة (Spaced Repetition) — نسخة مبسطة من SM-2 لكل آية
import { db } from '../db.js';

const DAY = 86400000;
export const GRADES = [
  { q: 0, label: 'نسيتها', cls: 'again' },
  { q: 3, label: 'صعبة', cls: 'hard' },
  { q: 4, label: 'جيدة', cls: 'good' },
  { q: 5, label: 'سهلة', cls: 'easy' },
];

const id = (s, a) => `${s}:${a}`;
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

export async function all() { return db.all('memorize'); }

export async function addRange(surah, from, to) {
  const existing = new Set((await all()).map((x) => x.id));
  const now = Date.now();
  const items = [];
  for (let a = from; a <= to; a++) {
    if (existing.has(id(surah, a))) continue;
    // أول مراجعة غدًا
    items.push({ id: id(surah, a), surah, ayah: a, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now + DAY / 2, addedAt: now, lastReview: null });
  }
  if (items.length) await db.putMany('memorize', items);
  return items.length;
}

export async function removeSurah(surah) {
  const items = (await all()).filter((x) => x.surah === surah);
  await Promise.all(items.map((x) => db.del('memorize', x.id)));
}

export async function due() {
  const limit = endOfToday();
  return (await all()).filter((x) => x.due <= limit).sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

/** يحسب الحالة التالية دون حفظ (لعرض الفاصل على الأزرار) */
export function next(item, q) {
  let { ease, interval, reps, lapses } = item;
  if (q < 3) {
    reps = 0;
    lapses++;
    interval = 0; // يعاد اليوم/قريبًا
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps++;
    if (reps === 1) interval = q === 5 ? 3 : 1;
    else if (reps === 2) interval = q === 3 ? 3 : 6;
    else interval = Math.round(interval * ease * (q === 3 ? 0.8 : q === 5 ? 1.3 : 1));
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  const dueAt = interval === 0 ? Date.now() + 10 * 60000 : Date.now() + interval * DAY;
  return { ...item, ease, interval, reps, lapses, due: dueAt, lastReview: Date.now() };
}

export async function grade(item, q) {
  const n = next(item, q);
  await db.put('memorize', n);
  return n;
}

export function intervalLabel(item, q) {
  const n = next(item, q);
  if (n.interval === 0) return 'بعد قليل';
  if (n.interval === 1) return 'غدًا';
  if (n.interval < 30) return `${n.interval} يوم`;
  if (n.interval < 365) return `${Math.round(n.interval / 30)} شهر`;
  return `${(n.interval / 365).toFixed(1)} سنة`;
}

/** ملخص لكل سورة: عدد الآيات المحفوظة ومتوسط القوة */
export async function summary() {
  const items = await all();
  const map = new Map();
  for (const x of items) {
    const s = map.get(x.surah) || { surah: x.surah, count: 0, mature: 0, due: 0 };
    s.count++;
    if (x.interval >= 21) s.mature++;
    if (x.due <= endOfToday()) s.due++;
    map.set(x.surah, s);
  }
  return [...map.values()].sort((a, b) => a.surah - b.surah);
}

/** إخفاء تدريجي: يحدد أي كلمات تختفي حسب المستوى (0..5) بشكل ثابت */
export function hiddenWords(words, level, seed = 0) {
  if (level <= 0) return new Set();
  if (level >= 5) return new Set(words.map((_, i) => i));
  const ratio = [0, 0.25, 0.5, 0.75, 1][level];
  const out = new Set();
  words.forEach((w, i) => {
    // تجزئة بسيطة ثابتة لكل كلمة
    let h = seed * 31 + i * 2654435761;
    h = ((h >>> 0) % 1000) / 1000;
    if (h < ratio) out.add(i);
  });
  return out;
}
