// مشترك بين النافذة والخلفية
export const APP = 'https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/';
const AR = '٠١٢٣٤٥٦٧٨٩';
export const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
export const latin = (s) => s.replace(/[٠-٩]/g, (d) => AR.indexOf(d));

let dataP = null;
export const getData = () => (dataP ||= fetch(chrome.runtime.getURL('data/quran.json')).then((r) => r.json()));

/** توحيد للبحث: بدون تشكيل، والألفات والياء والتاء المربوطة موحّدة */
export function normalize(s) {
  return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}

/** يحوّل ما يكتبه المستخدم إلى رابط في التطبيق: رقم آية، أو اسم سورة، أو بحث */
export function resolve(input, surahs) {
  const q = latin(input.trim());
  const ref = q.match(/^(\d{1,3})\s*[:：/.\-\s]\s*(\d{1,3})$/);
  if (ref) {
    const s = +ref[1], a = +ref[2];
    if (surahs[s - 1] && a >= 1 && a <= surahs[s - 1].ayahCount) return `${APP}#/surah/${s}/${a}`;
  }
  if (/^\d{1,3}$/.test(q) && +q >= 1 && +q <= 114) return `${APP}#/surah/${+q}`;
  const nq = normalize(q).replace(/^سوره\s+/, '').replace(/^ال/, '');
  const hit = surahs.find((s) => normalize(s.nameAr).replace(/^ال/, '') === nq || s.nameEn.toLowerCase().replace(/[^a-z]/g, '') === q.toLowerCase().replace(/[^a-z]/g, ''));
  if (hit) return `${APP}#/surah/${hit.id}`;
  return `${APP}#/search?q=${encodeURIComponent(input.trim())}`;
}

/** آية اليوم: ثابتة طوال اليوم، وتتغير يوميًا */
export function ayahOfDay(data, date = new Date()) {
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  let total = 0;
  for (const a of data.ayahs) total += a.length;
  let idx = (day * 2654435761) % total;
  idx = (idx + total) % total;
  for (let s = 0; s < data.ayahs.length; s++) {
    if (idx < data.ayahs[s].length) return { surah: s + 1, ayah: idx + 1, text: data.ayahs[s][idx] };
    idx -= data.ayahs[s].length;
  }
  return { surah: 1, ayah: 1, text: data.ayahs[0][0] };
}
