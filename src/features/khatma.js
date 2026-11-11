// خطة الختمة الذكية: ورد يومي بالصفحات يتعدّل تلقائيًا لو فاتك يوم
import { db } from '../db.js';
import { pageStart, getSurahMeta } from '../data.js';

export const TOTAL_PAGES = 604;
const DAY = 86400000;

const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const today = () => dayKey();

/** الختمة النشطة (واحدة لكل نوع: قراءة / استماع) */
export async function getActive(type) {
  const all = await db.all('khatma');
  return all.filter((k) => !k.finishedAt && (!type || k.type === type)).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}
export async function history() {
  return (await db.all('khatma')).filter((k) => k.finishedAt).sort((a, b) => b.finishedAt - a.finishedAt);
}

export async function create({ type = 'read', days = 30, startPage = 1 }) {
  const k = {
    id: `k${Date.now()}`,
    type, days,
    startDate: startOfDay(),
    endDate: startOfDay() + (days - 1) * DAY,
    donePage: startPage - 1,    // آخر صفحة مكتملة
    log: {},                    // { 'YYYY-MM-DD': pagesRead }
    createdAt: Date.now(),
    finishedAt: null,
  };
  await db.put('khatma', k);
  return k;
}

export async function remove(id) { await db.del('khatma', id); }

/** حساب الخطة لليوم */
export function plan(k, now = Date.now()) {
  const todayStart = startOfDay(now);
  const remainingPages = TOTAL_PAGES - k.donePage;
  const readToday = k.log[dayKey(now)] || 0;
  // الأيام المتبقية بما فيها اليوم (على الأقل يوم)
  const daysLeft = Math.max(1, Math.round((k.endDate - todayStart) / DAY) + 1);
  // هدف اليوم = (المتبقي + ما قُرئ اليوم) ÷ الأيام المتبقية — حتى لا يتغير الهدف أثناء اليوم
  const target = Math.ceil((remainingPages + readToday) / daysLeft);
  const leftToday = Math.max(0, target - readToday);
  const fromPage = Math.min(TOTAL_PAGES, k.donePage + 1);
  const toPage = Math.min(TOTAL_PAGES, k.donePage + leftToday);
  const dayIndex = Math.floor((todayStart - k.startDate) / DAY) + 1;
  const expectedDone = Math.min(TOTAL_PAGES, Math.round((TOTAL_PAGES / k.days) * Math.min(k.days, dayIndex)));
  const overdue = now > k.endDate + DAY;
  return {
    remainingPages, daysLeft, target, readToday, leftToday, fromPage, toPage,
    dayIndex, behind: Math.max(0, expectedDone - k.donePage),
    percent: k.donePage / TOTAL_PAGES,
    doneToday: leftToday === 0,
    overdue,
  };
}

/** نطاق الآيات لصفحات: من بداية fromPage حتى آخر آية في toPage */
export function rangeForPages(fromPage, toPage) {
  const from = pageStart(fromPage);
  const to = toPage >= TOTAL_PAGES ? { surah: 114, ayah: 6 } : prevAyah(pageStart(toPage + 1));
  return { from, to };
}
function prevAyah({ surah, ayah }) {
  if (ayah > 1) return { surah, ayah: ayah - 1 };
  return { surah: surah - 1, ayah: getSurahMeta(surah - 1).ayahCount };
}

/** تسجيل التقدم حتى صفحة معينة */
export async function markUntil(k, page) {
  page = Math.min(TOTAL_PAGES, Math.max(k.donePage, page));
  const delta = page - k.donePage;
  if (delta <= 0) return k;
  const d = dayKey();
  k.log[d] = (k.log[d] || 0) + delta;
  k.donePage = page;
  if (page >= TOTAL_PAGES) k.finishedAt = Date.now();
  await db.put('khatma', k);
  return k;
}

/** أيام متتالية تم فيها الورد */
export function streak(k) {
  let n = 0;
  let d = new Date();
  if (!k.log[dayKey(d)]) d = new Date(Date.now() - DAY);
  while (k.log[dayKey(d)]) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}

/** أيام رمضان القادم (تقريبي حسب تقويم أم القرى المحسوب في المتصفح) */
export function daysUntilRamadanEnd() {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    if (+parts.month === 9) return Math.max(1, 30 - +parts.day + 1);
  } catch { /* غير مدعوم */ }
  return 30;
}
