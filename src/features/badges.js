// الإنجازات والشارات: تُحسب من نشاطك على الجهاز، وتظهر رسالة عند كل شارة جديدة
import { h, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { toast } from '../ui.js';
import { lastDays, streak } from './activity.js';
import * as K from './khatma.js';
import * as srs from './srs.js';
import { doneCount } from './prayerLog.js';

const sum = (k) => lastDays(120).reduce((n, d) => n + d[k], 0);
const quizBest = () => { try { return +localStorage.getItem('qa:quizBest') || 0; } catch { return 0; } };
const kidsStars = () => Object.values(settings.get('kidsStars') || {}).reduce((a, b) => a + b, 0);
const fullPrayerDays = () => { let n = 0; for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (doneCount(d) === 5) n++; } return n; };

// [المعرّف، الرمز، الاسم، الشرط، الوصف]
export const BADGES = [
  ['streak3', '🌱', 'بداية طيبة', (x) => x.streak >= 3, '٣ أيام متتالية مع القرآن'],
  ['streak7', '🔥', 'أسبوع كامل', (x) => x.streak >= 7, '٧ أيام متتالية'],
  ['streak30', '🌙', 'شهر من المداومة', (x) => x.streak >= 30, '٣٠ يومًا متتالية'],
  ['pages100', '📖', 'مئة صفحة', (x) => x.pages >= 100, 'قرأت ١٠٠ صفحة'],
  ['pages604', '📚', 'المصحف كله', (x) => x.pages >= 604, 'قرأت ٦٠٤ صفحات'],
  ['listen300', '🎧', 'مستمع', (x) => x.minutes >= 300, '٥ ساعات استماع'],
  ['khatma1', '🏆', 'أول ختمة', (x) => x.khatmas >= 1, 'أتممت ختمة كاملة'],
  ['mem10', '💡', 'بداية الحفظ', (x) => x.memorized >= 10, 'أضفت ١٠ آيات للحفظ'],
  ['mem100', '⭐', 'حافظ', (x) => x.memorized >= 100, '١٠٠ آية في محفوظاتك'],
  ['quiz10', '✅', 'علامة كاملة', (x) => x.quiz >= 10, '١٠ من ١٠ في اختبار الحفظ'],
  ['tasbih1000', '📿', 'ذاكر', (x) => x.tasbih >= 1000, '١٠٠٠ تسبيحة'],
  ['prayers7', '🕌', 'محافظ على الصلاة', (x) => x.fullDays >= 7, '٧ أيام بالصلوات الخمس'],
  ['kids10', '🧒', 'نجم صغير', (x) => x.kids >= 10, '١٠ نجوم في وضع الأطفال'],
];

async function stats() {
  const [hist, mem] = await Promise.all([K.history().catch(() => []), srs.all().catch(() => [])]);
  return { streak: streak(), pages: sum('pages'), minutes: sum('minutes'), tasbih: sum('tasbih'), khatmas: hist.filter((k) => k.finishedAt).length, memorized: mem.length, quiz: quizBest(), kids: kidsStars(), fullDays: fullPrayerDays() };
}

/** يفحص الشارات ويحفظ الجديدة ويعرض رسالة بها */
let checking = false;
export async function checkBadges({ quiet = false } = {}) {
  if (checking) return;
  checking = true;
  try {
    const x = await stats();
    const earned = { ...(settings.get('badges') || {}) };
    const fresh = BADGES.filter(([id, , , ok]) => !earned[id] && ok(x));
    if (!fresh.length) return;
    for (const [id] of fresh) earned[id] = new Date().toISOString().slice(0, 10);
    await settings.set('badges', earned);
    if (!quiet) toast(`شارة جديدة ${fresh[0][1]} ${fresh[0][2]}`, 3500);
  } finally { checking = false; }
}

/** شبكة الشارات (المكتسبة ملوّنة، والباقية باهتة) */
export function badgesGrid() {
  const earned = settings.get('badges') || {};
  const n = Object.keys(earned).length;
  return h('section.badges',
    h('h2.lib-h', `إنجازاتي (${ar(n)} من ${ar(BADGES.length)})`),
    h('div.bd-grid', BADGES.map(([id, emoji, name, , desc]) => h('div', { class: earned[id] ? 'bd on' : 'bd', title: desc },
      h('span.bd-emoji', { 'aria-hidden': 'true' }, emoji), h('strong', name), h('small', earned[id] ? desc : `🔒 ${desc}`)))));
}
