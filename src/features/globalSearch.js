// البحث الشامل: السور، وصفحات التطبيق، والأذكار، والأحاديث، والأدعية، وقصص الأنبياء، ودروس التجويد، وأسماء الله الحسنى
import { normalize } from '../lib/arabic.js';
import { getSurahs } from '../data.js';

const DATA = new URL('../../public/data/', import.meta.url).href;
const json = (p) => fetch(DATA + p).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// صفحات التطبيق مع كلمات مفتاحية
const PAGES = [
  ['#/prayer', 'مواقيت الصلاة', 'الصلاه الاذان المواقيت الفجر الظهر العصر المغرب العشاء'],
  ['#/prayer?tab=qibla', 'القبلة', 'القبله البوصله الكعبه الاتجاه'],
  ['#/prayer?tab=adhkar', 'الأذكار', 'اذكار الصباح المساء النوم'],
  ['#/tasbih', 'السبحة', 'سبحه تسبيح عداد استغفار'],
  ['#/calendar', 'التقويم الهجري', 'هجري مناسبات رمضان عيد الايام البيض'],
  ['#/khatma', 'الختمة والورد', 'ختمه ورد يومي'],
  ['#/memorize', 'الحفظ والمراجعة', 'حفظ مراجعه'],
  ['#/hifz', 'خطة الحفظ', 'خطه حفظ جدول'],
  ['#/quiz', 'اختبار الحفظ', 'اختبار مسابقه'],
  ['#/group', 'الختمة الجماعية', 'ختمه جماعيه مهداه ميت'],
  ['#/kids', 'وضع الأطفال', 'اطفال جزء عم'],
  ['#/focus', 'وضع التركيز', 'تركيز تشتيت'],
  ['#/lessons', 'دروس المشايخ', 'دروس محاضرات شيخ مشايخ الشعراوي ابن عثيمين ابن باز عمر عبد الكافي الحويني سمير مصطفى امجد سمير'],
  ['#/radio', 'إذاعة القرآن الكريم', 'اذاعه راديو بث مباشر'],
  ['#/listen', 'الاستماع والقراء', 'قارئ قراء استماع تلاوه'],
  ['#/downloads', 'التنزيلات', 'تنزيل بدون انترنت'],
  ['#/zakat', 'حاسبة الزكاة', 'زكاه ذهب فضه نصاب مال'],
  ['#/fasting', 'متابعة الصيام', 'صيام صوم الاثنين الخميس'],
  ['#/qada', 'قضاء الفوائت', 'قضاء فوائت صلاه صيام'],
  ['#/ramadan', 'رمضان', 'رمضان امساكيه سحور افطار'],
  ['#/sleep', 'روتين النوم', 'نوم الملك السجده'],
  ['#/duas', 'الأدعية', 'دعاء ادعيه'],
  ['#/asma', 'أسماء الله الحسنى', 'اسماء الله الحسني'],
  ['#/nawawi', 'الأربعون النووية', 'نوويه اربعين احاديث'],
  ['#/tajweed', 'دروس التجويد', 'تجويد احكام مد غنه قلقله'],
  ['#/prophets', 'قصص الأنبياء', 'انبياء قصص رسل'],
  ['#/library', 'المكتبة', 'احاديث صحابه'],
  ['#/stats', 'إحصائياتي', 'احصائيات شارات انجازات'],
  ['#/greetings', 'بطاقات التهنئة', 'تهنئه بطاقه عيد'],
  ['#/wallpaper', 'خلفيات للموبايل', 'خلفيه شاشه'],
  ['#/elder', 'وضع كبار السن', 'كبار السن تكبير'],
  ['#/settings', 'الإعدادات', 'اعدادات ثيم خط مزامنه نسخه احتياطيه تنبيهات'],
  ['#/help', 'طريقة الاستخدام', 'مساعده شرح'],
];

let cache = null;
const clip = (t, n = 90) => { t = t.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
async function load() {
  if (cache) return cache;
  const [adhkar, libIndex, nawawi, sel, lessons] = await Promise.all([json('adhkar.json'), json('library/index.json'), json('library/nawawi.json'), json('selections.json'), json('lessons.json')]);
  const topics = libIndex ? (await Promise.all(libIndex.filter((t) => t.id !== 'sahaba' && t.id !== 'qisas').map((t) => json(`library/${t.id}.json`).then((items) => (items || []).map((x) => ({ t, x })))))).flat() : [];
  const [{ PROPHETS }, { LESSONS }] = await Promise.all([import('../views/prophets.js'), import('../views/tajweed.js')]);
  const n = normalize;
  cache = {
    surahs: getSurahs().map((s) => ({ key: n(s.nameAr), href: `#/surah/${s.id}`, title: `سورة ${s.nameAr}`, sub: `${String(s.ayahCount).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])} آية` })),
    pages: PAGES.map(([href, title, kw]) => ({ key: n(`${title} ${kw}`), href, title })),
    adhkar: (adhkar?.chapters || []).flatMap((c) => [{ key: n(c.title), href: `#/adhkar/${c.id}`, title: c.title, sub: 'باب من الأذكار' },
      ...c.items.map((it) => ({ key: n(it.text), href: `#/adhkar/${c.id}`, title: clip(it.text), sub: c.title }))]),
    hadith: [...(nawawi?.items || []).map((x) => ({ key: n(`${x.title} ${x.text}`), href: `#/nawawi/${x.n}`, title: x.title, sub: `الأربعون النووية ${x.n}` })),
      ...topics.map(({ t, x }) => ({ key: n(`${x.title} ${x.text}`), href: `#/hadith/${t.id}/${x.id}`, title: clip(x.title.split('\n')[0]), sub: t.title }))],
    duas: (sel?.quranDuas || []).map((d) => ({ key: n(d.t), href: `#/surah/${d.ref.replace(':', '/')}`, title: d.t, sub: 'دعاء من القرآن' })),
    asma: (sel?.asma || []).map((x) => ({ key: n(`${x.n} ${x.m}`), href: '#/asma', title: x.n, sub: x.m.slice(0, 80) })),
    learn: [...(lessons?.series || []).map((x) => ({ key: n(`${x.title} ${lessons.sheikhs[x.sheikh]?.name || ''}`), href: `#/lessons/${x.id}`, title: x.title, sub: `دروس ${lessons.sheikhs[x.sheikh]?.short || ''}` })),
      ...PROPHETS.map(([id, name]) => ({ key: n(name), href: `#/prophets/${id}`, title: name, sub: 'قصص الأنبياء' })),
      ...LESSONS.flatMap(([id, title, , secs]) => [{ key: n(title), href: `#/tajweed/${id}`, title, sub: 'دروس التجويد' },
        ...secs.map(([name]) => ({ key: n(name), href: `#/tajweed/${id}`, title: name, sub: `دروس التجويد — ${title}` }))])],
  };
  return cache;
}

export const GROUPS = [['surahs', 'السور'], ['pages', 'في التطبيق'], ['learn', 'الدروس والقصص والتجويد'], ['adhkar', 'الأذكار'], ['duas', 'أدعية القرآن'], ['hadith', 'الأحاديث'], ['asma', 'أسماء الله الحسنى']];

/** نتائج مجمّعة: { group: [{href, title, sub}] } */
export async function searchAll(q) {
  const c = await load();
  // «الصبر» تطابق «صبر» و«يصبر»: نحذف «ال» من أول الكلمة الطويلة
  const words = normalize(q).split(' ').filter(Boolean).map((w) => (w.length >= 5 ? w.replace(/^ال/, '') : w));
  if (!words.length) return {};
  const out = {};
  for (const [g] of GROUPS) {
    const seen = new Set();
    out[g] = c[g].filter((x) => words.every((w) => x.key.includes(w))).filter((x) => { const k = x.href + x.title; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  return out;
}
