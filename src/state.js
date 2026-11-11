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
  stats: true,            // إحصائيات مجهولة مجمّعة (عدد يومي فقط)
};

const state = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  try {
    const rows = await db.all('settings');
    for (const r of rows) if (r.key in DEFAULTS) state[r.key] = r.value;
  } catch (e) { console.warn('settings load failed', e); }
  applyVisual();
  return state;
}

export const get = (k) => state[k];
export const all = () => ({ ...state });

export async function set(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  if (key === 'theme' || key === 'fontScale') applyVisual();
  for (const fn of listeners) fn(key, value);
  try { await db.put('settings', { key, value }); } catch (e) { console.warn(e); }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyVisual() {
  const root = document.documentElement;
  if (state.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = state.theme;
  root.style.setProperty('--quran-scale', state.fontScale);
  try { localStorage.setItem('qa:boot', JSON.stringify({ theme: state.theme === 'auto' ? undefined : state.theme, fontScale: state.fontScale })); } catch (e) { /* خاص/محظور */ }
}
