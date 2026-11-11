// بيانات التعمق: كلمة بكلمة، الجذور، التجويد، التفسير الميسر (تُحمَّل عند الحاجة)
const BASE = new URL('../../public/data/', import.meta.url).href;
const cache = new Map();
function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch((e) => { cache.delete(name); throw e; }));
  }
  return cache.get(name);
}

/** كلمات السورة: لكل آية مصفوفة كلمات {root, lemma, pos, extra, gloss} أو null */
export async function getWords(s) {
  const [labels, data] = await Promise.all([load('words/labels.json'), load(`words/${s}.json`)]);
  return data.map((ayah) => ayah && ayah.map(([root, lemma, p, x, gloss]) => ({ root, lemma, pos: labels[p], extra: labels[x], gloss })));
}

export const TAFSIRS = {
  muyassar: { name: 'التفسير الميسر', dir: 'tafsir', source: 'التفسير الميسر — مجمع الملك فهد لطباعة المصحف الشريف.' },
  saadi: { name: 'تفسير السعدي', dir: 'tafsir-saadi', source: 'تيسير الكريم الرحمن في تفسير كلام المنان — الشيخ عبدالرحمن السعدي، عبر Quran.com.' },
};

/** تفسير آية (يتتبع الآيات المجمّعة) */
export async function getTafsir(s, a, which = 'muyassar') {
  const arr = await load(`${(TAFSIRS[which] || TAFSIRS.muyassar).dir}/${s}.json`);
  const v = arr[a - 1];
  if (typeof v === 'number') return { text: arr[v - 1], groupFrom: v };
  return { text: v || '', groupFrom: null };
}

export const getTajweed = () => load('tajweed.json');
/** قائمة ترجمات المعاني المتاحة */
export const getTranslations = () => load('trans/index.json');
/** ترجمة سورة: مصفوفة نصوص الآيات */
export const getTranslation = (id, s) => load(`trans/${id}/${s}.json`);
export const getRoots = () => load('roots.json');

export const decodeLoc = (n) => ({ surah: Math.floor(n / 1e6), ayah: Math.floor((n % 1e6) / 1e3), word: n % 1e3 });

// علامات الوقف التي تأتي ككلمة مستقلة في النص
const MARK_TOKEN = /^[ۖ-ۭ]+$/;
export const isWordToken = (tok) => !MARK_TOKEN.test(tok);

/** أحكام التجويد: الاسم والشرح المختصر */
export const TAJWEED_RULES = {
  ham_wasl: { name: 'همزة وصل', desc: 'همزة تُنطق عند الابتداء بها وتسقط في درج الكلام (الوصل).' },
  laam_shamsiyah: { name: 'لام شمسية', desc: 'لام "ال" التعريف تُكتب ولا تُنطق، وتُدغم في الحرف الشمسي بعدها فيُشدَّد.' },
  slnt: { name: 'حرف لا يُنطق', desc: 'حرف مكتوب في الرسم العثماني لا يُقرأ وصلًا أو وقفًا.' },
  madda_normal: { name: 'مد طبيعي', desc: 'يُمد بمقدار حركتين، ولا يتوقف على همز أو سكون بعده.' },
  madda_permissible: { name: 'مد جائز', desc: 'مد منفصل أو عارض للسكون: يجوز مده حركتين أو أربعًا أو ستًا.' },
  madda_obligatory: { name: 'مد واجب متصل', desc: 'حرف مد بعده همزة في نفس الكلمة: يُمد وجوبًا أربع أو خمس حركات.' },
  madda_necessary: { name: 'مد لازم', desc: 'حرف مد بعده سكون أصلي: يُمد لزومًا ست حركات.' },
  qalaqah: { name: 'قلقلة', desc: 'اضطراب الصوت عند النطق بأحد حروف (قطب جد) ساكنًا حتى يُسمع له نبرة قوية.' },
  ghunnah: { name: 'غنة', desc: 'صوت يخرج من الخيشوم مع النون والميم المشددتين بمقدار حركتين.' },
  ikhafa: { name: 'إخفاء', desc: 'النون الساكنة أو التنوين قبل أحد حروف الإخفاء الخمسة عشر: تُنطق بين الإظهار والإدغام مع غنة.' },
  ikhafa_shafawi: { name: 'إخفاء شفوي', desc: 'الميم الساكنة قبل الباء: تُخفى مع غنة.' },
  idgham_ghunnah: { name: 'إدغام بغنة', desc: 'النون الساكنة أو التنوين قبل (ي ن م و): تُدغم في الحرف التالي مع غنة.' },
  idgham_wo_ghunnah: { name: 'إدغام بغير غنة', desc: 'النون الساكنة أو التنوين قبل اللام أو الراء: تُدغم إدغامًا كاملًا بلا غنة.' },
  idgham_shafawi: { name: 'إدغام شفوي', desc: 'الميم الساكنة قبل ميم: تُدغم فيها مع غنة.' },
  idgham_mutajanisayn: { name: 'إدغام متجانسين', desc: 'حرفان اتفقا مخرجًا واختلفا صفة، والأول ساكن: يُدغم في الثاني.' },
  idgham_mutaqaribayn: { name: 'إدغام متقاربين', desc: 'حرفان تقاربا مخرجًا أو صفة، والأول ساكن: يُدغم في الثاني.' },
  iqlab: { name: 'إقلاب', desc: 'النون الساكنة أو التنوين قبل الباء: تُقلب ميمًا مخفاة مع غنة.' },
};
