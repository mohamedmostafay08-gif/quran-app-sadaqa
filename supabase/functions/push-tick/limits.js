// أدوات الحماية والسعة لدالة push-tick (JavaScript عادي ليُختبر بـ Node أيضًا)

/**
 * حدّ طلبات بنافذة زمنية داخل ذاكرة نسخة الدالة: لكل مفتاح (عنوان IP) وحدّ إجمالي.
 * تقريبي بطبيعته (كل نسخة لها ذاكرتها، وتُمسح عند إعادة التشغيل)، لكنه يوقف الإغراق من مصدر واحد.
 */
export function createRateLimiter({ perKey, total, windowMs }) {
  const hits = new Map();
  let all = [];
  return function allow(key, now = Date.now()) {
    const from = now - windowMs;
    all = all.filter((t) => t > from);
    const mine = (hits.get(key) || []).filter((t) => t > from);
    if (mine.length >= perKey || all.length >= total) { hits.set(key, mine); return false; }
    mine.push(now); all.push(now); hits.set(key, mine);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
    return true;
  };
}

/** أول عنوان في x-forwarded-for (عنوان العميل خلف بوابة Supabase) */
export const clientIp = (headers) => (headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown').split(',')[0].trim();

/**
 * يقرأ كل الصفوف على صفحات بدل حدّ ثابت يُسقط الزائد بصمت.
 * fetchPage(from, to) → { data, error }. يتوقف عند max ويبلغ عن ذلك بدل الإسقاط الخفي.
 */
export async function loadAll(fetchPage, { pageSize = 1000, max = 50000 } = {}) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await fetchPage(from, Math.min(from + pageSize, max) - 1);
    if (error) return { rows, error, truncated: false };
    rows.push(...data);
    if (data.length < pageSize) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** ينفّذ fn على العناصر بعدد محدود في نفس الوقت، ويتوقف عن بدء عناصر جديدة بعد deadline */
export async function pool(items, concurrency, fn, deadline = Infinity) {
  let i = 0, done = 0;
  const worker = async () => {
    while (i < items.length) {
      if (Date.now() > deadline) return;
      const item = items[i++];
      try { await fn(item); } catch (e) { console.error('job', String(e)); }
      done++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { done, skipped: items.length - done };
}
