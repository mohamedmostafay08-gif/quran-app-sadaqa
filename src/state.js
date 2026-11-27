// الإعدادات والحالة العامة + نظام اشتراك بسيط
import { db } from './db.js';

export const DEFAULTS = {
  theme: 'auto',          // auto | light | dark | sepia
  fontScale: 1,           // 0.8 .. 2
  layout: 'flow',         // flow (متصل كالمصحف) | list (آية في سطر)
  readMode: 'scroll',     // scroll (عرض متصل) | pages (صفحات مصحف المدينة)
  reciter: '123',          // معرّف القارئ في mp3quran (123 = مشاري العفاسي)
  rate: 1,                // سرعة التشغيل الافتراضية
  rateByReciter: {},      // سرعة مخصصة لكل قارئ (بعض التسجيلات متأنية)
  repeat: 1,              // تكرار كل آية
  autoNext: true,         // متابعة السورة التالية
  autoScroll: true,       // تتبع الآية المقروءة
  autoDownloadNext: false,
  wifiOnly: true,
  showPageMarks: true,
  tajweed: false,         // ألوان التجويد
  wordTap: false,         // الضغط على الكلمة يعرض معناها
  tafsir: 'muyassar',     // muyassar | saadi
  translation: null,      // معرّف ترجمة المعاني تحت كل آية (en.sahih ...) أو null
  keepAwake: true,        // منع انطفاء الشاشة أثناء القراءة
  lastRead: null,         // { surah, ayah, at }
  lastListen: null,       // { surah, ayah, reciter, time, at } لاستكمال الاستماع
  onboarded: false,       // أكمل شاشة الترحيب
  prayerLocation: null,   // { name, lat, lng, tz, method, madhab }
  hijriAdjust: 0,         // تعديل التاريخ الهجري بالأيام
  deviceToken: null,      // معرّف سري للجهاز (الختمة الجماعية)
  myGroups: [],           // الختمات الجماعية على هذا الجهاز
  groupName: '',          // الاسم الظاهر في الختمة الجماعية
  lastBackupAt: null,     // آخر نسخة احتياطية
  notifyPrayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], // الأذان مفعّل افتراضيًا للصلوات الخمس
  prayersDefaultV2: false, // ترقية: تفعيل الأذان لمن لم يختر صلوات من قبل
  wirdTime: null,         // تذكير الورد اليومي HH:MM
  adhanInApp: true,       // تشغيل صوت الأذان عند دخول الوقت والتطبيق مفتوح
  adhanVoice: 'egypt',    // صوت الأذان: egypt | makkah | calm
  notifyKahf: true,       // يوم الجمعة: سورة الكهف وآخر ساعة
  preAdhan: 15,           // تنبيه قبل الأذان بالدقائق: 0 | 10 | 15 | 30
  preAdhanDefaultV1: false,
  adhkarReminder: true,   // تذكير بأذكار الصباح (بعد الفجر) والمساء (بعد العصر)
  adhkarLog: {},          // { 'YYYY-MM-DD': { sabah, masa, nawm } }
  autoNight: false,       // (يُستخدم مع theme = 'prayer')
  bigUI: 0,               // حجم خط التطبيق كله: 0 عادي، 1 كبير، 2 كبير جدًا (true القديمة = 1)
  wordHighlight: true,    // تظليل الكلمة المقروءة لأشهر القراء
  sleepMinutes: 20,       // مؤقت روتين النوم
  notifyAod: true,        // آية الصباح إشعارًا (٨ صباحًا)
  notifyQiyam: false,     // تذكير بقيام الليل والوتر (الثلث الأخير)
  nawawi: {},             // الأربعون النووية: { رقم: تاريخ الحفظ }
  syncCode: null,         // رمز المزامنة بين الأجهزة
  dhikrWird: { istighfar: 100, salat: 100 }, // ورد يومي من الاستغفار والصلاة على النبي ﷺ (٠ = متوقف)
  dhikrLog: {},           // { 'YYYY-MM-DD': { istighfar, salat } }
  fastLog: {},            // متابعة الصيام { 'YYYY-MM-DD': 'nafl' | 'qada' | 'fard' }
  zakat: null,            // آخر أرقام حاسبة الزكاة (على الجهاز)
  hifzPlan: null,         // خطة الحفظ { from: {s,a}, to: {s,a}, perDay, start, done: {'YYYY-MM-DD': true} }
  focusGoal: 5,           // وضع التركيز: عدد الصفحات
  lessonProgress: {},     // دروس المشايخ: { 'سلسلة:رقم': [ثانية، مدة، وقت] }
  lastLesson: null,       // آخر درس { series, i, at }
  appBadge: true,         // رقم على أيقونة التطبيق: الصلوات الباقية اليوم
  qada: null,             // حاسبة القضاء { prayers: {fajr: n…}, fasting: n, start: {...} }
  notifyAfter: false,     // إشعار بالأذكار بعد كل صلاة
  prayerLog: {},          // متابعة الصلوات { 'YYYY-MM-DD': { fajr: 'jamaah'|'ontime'|'late', sunnah: [...] } }
  kidsStars: {},          // وضع الأطفال: { surah: stars }
  badges: {},             // الشارات المكتسبة { id: تاريخ }
  notifyFasting: true,    // تذكير بصيام الاثنين والخميس والأيام البيض
  fastingDefaultV1: false, // ترقية: تفعيل تذكير الصيام مرة واحدة لمن سبق تثبيته
  tasbih: null,           // آخر ذكر في السبحة { id, count }
  stats: true,            // إحصائيات مجهولة مجمّعة (عدد يومي فقط)
};

const state = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  try {
    const rows = await db.all('settings');
    for (const r of rows) if (r.key in DEFAULTS) state[r.key] = r.value;
  } catch (e) { console.warn('settings load failed', e); }
  // مستخدمون قدامى لم يختاروا أي صلاة: نفعّل الأذان للصلوات الخمس مرة واحدة
  if (!state.prayersDefaultV2) {
    if (!(state.notifyPrayers || []).length) set('notifyPrayers', [...DEFAULTS.notifyPrayers]);
    set('prayersDefaultV2', true);
  }
  if (!state.fastingDefaultV1) { set('notifyFasting', true); set('fastingDefaultV1', true); }
  if (!state.preAdhanDefaultV1) { if (!state.preAdhan) set('preAdhan', 15); set('preAdhanDefaultV1', true); }
  applyVisual();
  return state;
}

export const get = (k) => state[k];
export const all = () => ({ ...state });

export async function set(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  if (key === 'theme' || key === 'fontScale' || key === 'bigUI') applyVisual();
  for (const fn of listeners) fn(key, value);
  try { await db.put('settings', { key, value }); } catch (e) { console.warn(e); }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** «حسب المغرب»: ليلي من المغرب إلى الفجر حسب مواقيت مدينتك (تحسبه main.js وتمرره هنا) */
let prayerNight = null;
export function setPrayerNight(isNight) { prayerNight = isNight; applyVisual(); }

/** مستوى حجم الواجهة 0..2 (يقبل القيمة القديمة true/false) */
export const uiLevel = () => (state.bigUI === true ? 1 : Math.max(0, Math.min(2, +state.bigUI || 0)));

function applyVisual() {
  const root = document.documentElement;
  // سمات إضافية مبنية على الفاتح أو الليلي: { المعرف: [الأساس، السمة] }
  const VARIANTS = { green: ['light', 'green'], paper: ['sepia', 'paper'], navy: ['dark', 'navy'], black: ['dark', 'black'] };
  const v = VARIANTS[state.theme];
  const th = v ? v[0] : state.theme === 'prayer' ? (prayerNight == null ? 'auto' : prayerNight ? 'dark' : 'light') : state.theme;
  if (th === 'auto') delete root.dataset.theme;
  else root.dataset.theme = th;
  if (v) root.dataset.variant = v[1]; else delete root.dataset.variant;
  const ui = uiLevel();
  root.classList.toggle('big-ui', ui >= 1);
  root.classList.toggle('huge-ui', ui >= 2);
  // لون شريط الحالة يتبع خلفية الثيم المختار
  // rAF مزدوج: يضمن أن المتصفح طبّق متغيرات CSS قبل القراءة
  requestAnimationFrame(() => requestAnimationFrame(() => { const bg = getComputedStyle(document.body || root).backgroundColor; if (bg) for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', bg); }));
  root.style.setProperty('--quran-scale', state.fontScale);
  try { localStorage.setItem('qa:boot', JSON.stringify({ theme: th === 'auto' ? undefined : th, variant: v?.[1], fontScale: state.fontScale, ui })); } catch (e) { /* خاص/محظور */ }
}
