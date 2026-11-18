// دروس التجويد: درس لكل باب، فيه التعريف والحروف، وأمثلة من المصحف تُلوَّن فيها القاعدة وحدها مع صوت الآية
import { h, icon, ar } from '../lib/dom.js';
import { mount, topbar, toast } from '../ui.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { getTajweed } from '../features/extra.js';
import { player } from '../audio/player.js';
import { navigate } from '../router.js';

// [المعرّف، العنوان، المقدمة، الأقسام: [العنوان، الشرح، مفاتيح القاعدة في بيانات التلوين أو null]]
export const LESSONS = [
  ['nun', 'النون الساكنة والتنوين', 'للنون الساكنة والتنوين أربعة أحكام بحسب الحرف الذي بعدها.', [
    ['الإظهار الحلقي', 'إذا جاء بعدها أحد حروف الحلق الستة (ء هـ ع ح غ خ) تُنطق النون واضحة بلا غنة زائدة، مثل: ﴿مَنْ آمَنَ﴾ و﴿عَذَابٌ أَلِيمٌ﴾.', null],
    ['الإدغام بغنة', 'إذا جاء بعدها أحد حروف (ينمو) تُدغم النون في الحرف التالي مع غنة بمقدار حركتين، ولا يكون الإدغام إلا بين كلمتين.', ['idgham_ghunnah']],
    ['الإدغام بغير غنة', 'إذا جاء بعدها اللام أو الراء تُدغم النون إدغامًا كاملًا بلا غنة، إلا ﴿مَنْ رَاقٍ﴾ ففيها سكت لحفص.', ['idgham_wo_ghunnah']],
    ['الإقلاب', 'إذا جاء بعدها الباء تُقلب النون ميمًا مخفاة مع غنة، وتُرسم فوقها ميم صغيرة.', ['iqlab']],
    ['الإخفاء الحقيقي', 'إذا جاء بعدها أحد الحروف الخمسة عشر الباقية تُنطق النون بين الإظهار والإدغام مع غنة بمقدار حركتين.', ['ikhafa']],
  ]],
  ['mim', 'الميم الساكنة', 'للميم الساكنة ثلاثة أحكام.', [
    ['الإخفاء الشفوي', 'إذا جاء بعدها الباء تُخفى الميم مع غنة، مثل: ﴿تَرْمِيهِم بِحِجَارَةٍ﴾.', ['ikhafa_shafawi']],
    ['الإدغام الشفوي', 'إذا جاء بعدها ميم تُدغم فيها فتصيران ميمًا واحدة مشددة مع غنة.', ['idgham_shafawi']],
    ['الإظهار الشفوي', 'إذا جاء بعدها أي حرف غير الباء والميم تُنطق واضحة، ويشتد الإظهار عند الواو والفاء، مثل: ﴿عَلَيْهِمْ وَلَا﴾ و﴿هُمْ فِيهَا﴾.', null],
  ]],
  ['ghunnah', 'الغنة', 'الغنة صوت يخرج من الخيشوم، وتظهر بأكمل صورها في النون والميم المشددتين وتكون بمقدار حركتين، مثل: ﴿إِنَّ﴾ و﴿ثُمَّ﴾.', [
    ['النون والميم المشددتان', 'كل نون أو ميم مشددة تُنطق بغنة كاملة بمقدار حركتين.', ['ghunnah']],
  ]],
  ['madd', 'المدود', 'المد إطالة الصوت بحرف من حروف المد الثلاثة: الألف الساكنة المفتوح ما قبلها، والواو الساكنة المضموم ما قبلها، والياء الساكنة المكسور ما قبلها.', [
    ['المد الطبيعي', 'لا يأتي بعده همز ولا سكون، ويُمد حركتين، مثل: ﴿قَالَ﴾ و﴿يَقُولُ﴾ و﴿قِيلَ﴾.', ['madda_normal']],
    ['المد الواجب المتصل', 'حرف المد وبعده همزة في الكلمة نفسها، ويُمد أربع أو خمس حركات، وست عند الوقف على همزة متطرفة، مثل: ﴿جَاءَ﴾ و﴿السَّمَاءِ﴾.', ['madda_obligatory']],
    ['المد الجائز', 'المنفصل: حرف المد في آخر كلمة والهمزة في أول التي بعدها، ويُمد أربع أو خمس حركات لحفص من طريق الشاطبية، مثل: ﴿إِنَّا أَعْطَيْنَاكَ﴾. والعارض للسكون: حرف مد بعده حرف يُسكَّن للوقف، ويجوز فيه القصر حركتان والتوسط أربع والإشباع ست، مثل: ﴿الرَّحِيمِ﴾ عند الوقف عليها.', ['madda_permissible']],
    ['المد اللازم', 'حرف المد وبعده سكون أصلي في الكلمة نفسها، ويُمد ست حركات لزومًا، مثل: ﴿الضَّالِّينَ﴾ و﴿الْحَاقَّةُ﴾، ومنه بعض حروف فواتح السور مثل اللام والميم في ﴿الم﴾.', ['madda_necessary']],
  ]],
  ['qalqalah', 'القلقلة', 'اضطراب الصوت عند النطق بالحرف الساكن حتى تُسمع له نبرة قوية، وحروفها خمسة يجمعها قولك: «قطب جد». وتكون أوضح عند الوقف.', [
    ['حروف القلقلة الساكنة', 'مثل: ﴿يَدْخُلُونَ﴾ وصلًا ووقفًا، و﴿أَحَدٌ﴾ و﴿الْفَلَقِ﴾ عند الوقف.', ['qalaqah']],
  ]],
  ['lam', 'همزة الوصل واللام الشمسية', 'أحرف تُكتب في المصحف وتسقط في النطق في بعض المواضع.', [
    ['همزة الوصل', 'همزة تُنطق إذا بدأت بها، وتسقط إذا وصلتها بما قبلها، مثل همزة ﴿ٱللَّهِ﴾ و﴿ٱلرَّحْمَٰنِ﴾ في ﴿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ﴾، وتُنطق في ﴿ٱلْحَمْدُ﴾ إذا ابتدأت بها.', ['ham_wasl']],
    ['اللام الشمسية', 'لام «ال» تُكتب ولا تُنطق، ويُشدَّد الحرف الذي بعدها، مثل: ﴿الشَّمْسِ﴾ و﴿النَّاسِ﴾. أما اللام القمرية فتُنطق ساكنة مثل: ﴿الْقَمَرِ﴾.', ['laam_shamsiyah']],
    ['حروف لا تُنطق', 'حروف مكتوبة في الرسم العثماني لا تُقرأ، مثل الألف في ﴿قَالُوا۟﴾.', ['slnt']],
  ]],
  ['idgham', 'إدغام المتجانسين والمتقاربين', 'إذا التقى حرفان أولهما ساكن، واتفقا في المخرج أو تقاربا فيه، أُدغم الأول في الثاني في مواضع مخصوصة.', [
    ['المتجانسان', 'حرفان اتفقا في المخرج واختلفا في الصفة، مثل: ﴿قَد تَّبَيَّنَ﴾ و﴿إِذ ظَّلَمُوا﴾.', ['idgham_mutajanisayn']],
    ['المتقاربان', 'حرفان تقاربا في المخرج أو الصفة، مثل: ﴿أَلَمْ نَخْلُقكُّم﴾ و﴿قُل رَّبِّ﴾.', ['idgham_mutaqaribayn']],
  ]],
];

/** أمثلة لقاعدة: آيات قصيرة (من جزء عمّ أولًا) تحتوي القاعدة */
function examples(tj, keys, max = 3) {
  const ids = new Set(keys.map((k) => tj.rules.indexOf(k)).filter((i) => i >= 0));
  const hits = [];
  // نبدأ بجزء عمّ ثم بقية المصحف
  const order = Object.keys(tj.ayahs).sort((x, y) => {
    const [s1] = x.split(':').map(Number), [s2] = y.split(':').map(Number);
    return (s1 >= 78 ? 0 : 1) - (s2 >= 78 ? 0 : 1) || s2 - s1;
  });
  for (const key of order) {
    const r = tj.ayahs[key].filter((x) => ids.has(x[2]));
    if (r.length) hits.push([key, r]);
    if (hits.length >= max * 4) break;
  }
  // نوزّع الأمثلة على سور مختلفة
  const seen = new Set(), out = [];
  for (const x of hits) { const s = x[0].split(':')[0]; if (!seen.has(s)) { seen.add(s); out.push(x); } if (out.length >= max) break; }
  return out;
}

function exampleNode(text, ranges, rules) {
  const out = []; let cur = 0;
  for (const [a, b, r] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (a > cur) out.push(text.slice(cur, a));
    out.push(h('span', { class: `tj tj-${rules[r]}` }, text.slice(a, b)));
    cur = b;
  }
  out.push(text.slice(cur));
  return out;
}

export async function renderTajweed(params) {
  if (!params.id) {
    return mount(h('div.tajweed-page',
      topbar({ title: 'دروس التجويد', sub: 'برواية حفص عن عاصم', back: '#/quran' }),
      h('ol.nw-list', LESSONS.map(([id, title, intro], i) => h('li', h('a.card.nw-item', { href: `#/tajweed/${id}` },
        h('span.nw-num', ar(i + 1)), h('span.nw-title', title, h('small.tw-intro', intro))))))));
  }
  const i = LESSONS.findIndex((l) => l[0] === params.id);
  if (i < 0) return navigate('/tajweed', { replace: true });
  const [, title, intro, sections] = LESSONS[i];
  const next = LESSONS[i + 1];
  const body = h('div.tw-sections');
  mount(h('div.tajweed-page.tajweed',
    topbar({ title, sub: `الدرس ${ar(i + 1)} من ${ar(LESSONS.length)}`, back: '#/tajweed' }),
    h('p.tw-lead', intro),
    body,
    next ? h('a.btn.block', { href: `#/tajweed/${next[0]}` }, `الدرس التالي: ${next[1]}`, icon('back')) : h('a.btn.ghost.block', { href: '#/tajweed' }, 'كل الدروس')));
  let tj = null;
  try { tj = await getTajweed(); } catch { toast('الأمثلة تحتاج اتصالًا لأول مرة'); }
  for (const [name, text, keys] of sections) {
    const sec = h('section.card.tw-sec', h('h2', keys ? h('span', { class: `tj-dot tj-${keys[0]}` }) : null, name), h('p', text));
    body.append(sec);
    if (!tj || !keys) continue;
    for (const [key, ranges] of examples(tj, keys)) {
      const [s, a] = key.split(':').map(Number);
      const verse = (await getSurahText(s))[a - 1];
      sec.append(h('div.tw-ex',
        h('p.tw-ayah', { lang: 'ar' }, exampleNode(verse, ranges, tj.rules)),
        h('div.tw-foot', h('a', { href: `#/surah/${s}/${a}` }, `${getSurahMeta(s).nameAr} ${ar(a)}`),
          h('button.icon-btn', { type: 'button', 'aria-label': 'استمع للآية', onclick: () => player.playFrom(s, a, { only: true, times: 1 }) }, icon('play')))));
    }
  }
}
