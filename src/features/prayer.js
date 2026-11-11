// مواقيت الصلاة والقبلة والتاريخ الهجري — كلها تُحسب على الجهاز (بدون إنترنت)
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Qibla, HighLatitudeRule } from '../../public/lib/adhan.esm.js';
import * as settings from '../state.js';
import { ar } from '../lib/dom.js';

export const PRAYERS = [
  { key: 'fajr', name: 'الفجر' },
  { key: 'sunrise', name: 'الشروق' },
  { key: 'dhuhr', name: 'الظهر' },
  { key: 'asr', name: 'العصر' },
  { key: 'maghrib', name: 'المغرب' },
  { key: 'isha', name: 'العشاء' },
];

export const METHODS = {
  Egyptian: 'الهيئة المصرية العامة للمساحة',
  UmmAlQura: 'أم القرى (مكة المكرمة)',
  MuslimWorldLeague: 'رابطة العالم الإسلامي',
  Karachi: 'جامعة العلوم الإسلامية بكراتشي',
  Dubai: 'دبي',
  Kuwait: 'الكويت',
  Qatar: 'قطر',
  Singapore: 'سنغافورة',
  Turkey: 'رئاسة الشؤون الدينية التركية',
  Tehran: 'معهد الجيوفيزياء بطهران',
  NorthAmerica: 'أمريكا الشمالية (ISNA)',
  MoonsightingCommittee: 'لجنة رؤية الهلال',
};

// مدن مدمجة (الإحداثيات، المنطقة الزمنية، طريقة الحساب المعتادة)
export const CITIES = [
  ['القاهرة', 'مصر', 30.0444, 31.2357, 'Africa/Cairo', 'Egyptian'],
  ['الإسكندرية', 'مصر', 31.2001, 29.9187, 'Africa/Cairo', 'Egyptian'],
  ['الجيزة', 'مصر', 30.0131, 31.2089, 'Africa/Cairo', 'Egyptian'],
  ['المنصورة', 'مصر', 31.0409, 31.3785, 'Africa/Cairo', 'Egyptian'],
  ['طنطا', 'مصر', 30.7865, 31.0004, 'Africa/Cairo', 'Egyptian'],
  ['الزقازيق', 'مصر', 30.5877, 31.502, 'Africa/Cairo', 'Egyptian'],
  ['أسيوط', 'مصر', 27.1783, 31.1859, 'Africa/Cairo', 'Egyptian'],
  ['سوهاج', 'مصر', 26.5591, 31.6957, 'Africa/Cairo', 'Egyptian'],
  ['المنيا', 'مصر', 28.1099, 30.7503, 'Africa/Cairo', 'Egyptian'],
  ['الأقصر', 'مصر', 25.6872, 32.6396, 'Africa/Cairo', 'Egyptian'],
  ['أسوان', 'مصر', 24.0889, 32.8998, 'Africa/Cairo', 'Egyptian'],
  ['بورسعيد', 'مصر', 31.2653, 32.3019, 'Africa/Cairo', 'Egyptian'],
  ['السويس', 'مصر', 29.9668, 32.5498, 'Africa/Cairo', 'Egyptian'],
  ['الإسماعيلية', 'مصر', 30.5965, 32.2715, 'Africa/Cairo', 'Egyptian'],
  ['دمياط', 'مصر', 31.4165, 31.8133, 'Africa/Cairo', 'Egyptian'],
  ['الفيوم', 'مصر', 29.3084, 30.8428, 'Africa/Cairo', 'Egyptian'],
  ['بني سويف', 'مصر', 29.0661, 31.0994, 'Africa/Cairo', 'Egyptian'],
  ['قنا', 'مصر', 26.1551, 32.716, 'Africa/Cairo', 'Egyptian'],
  ['الغردقة', 'مصر', 27.2579, 33.8116, 'Africa/Cairo', 'Egyptian'],
  ['مكة المكرمة', 'السعودية', 21.3891, 39.8579, 'Asia/Riyadh', 'UmmAlQura'],
  ['المدينة المنورة', 'السعودية', 24.4672, 39.6111, 'Asia/Riyadh', 'UmmAlQura'],
  ['الرياض', 'السعودية', 24.7136, 46.6753, 'Asia/Riyadh', 'UmmAlQura'],
  ['جدة', 'السعودية', 21.4858, 39.1925, 'Asia/Riyadh', 'UmmAlQura'],
  ['الدمام', 'السعودية', 26.4207, 50.0888, 'Asia/Riyadh', 'UmmAlQura'],
  ['أبها', 'السعودية', 18.2164, 42.5053, 'Asia/Riyadh', 'UmmAlQura'],
  ['تبوك', 'السعودية', 28.3835, 36.5662, 'Asia/Riyadh', 'UmmAlQura'],
  ['دبي', 'الإمارات', 25.2048, 55.2708, 'Asia/Dubai', 'Dubai'],
  ['أبوظبي', 'الإمارات', 24.4539, 54.3773, 'Asia/Dubai', 'Dubai'],
  ['الشارقة', 'الإمارات', 25.3463, 55.4209, 'Asia/Dubai', 'Dubai'],
  ['الدوحة', 'قطر', 25.2854, 51.531, 'Asia/Qatar', 'Qatar'],
  ['الكويت', 'الكويت', 29.3759, 47.9774, 'Asia/Kuwait', 'Kuwait'],
  ['المنامة', 'البحرين', 26.2285, 50.586, 'Asia/Bahrain', 'UmmAlQura'],
  ['مسقط', 'عُمان', 23.588, 58.3829, 'Asia/Muscat', 'UmmAlQura'],
  ['عمّان', 'الأردن', 31.9454, 35.9284, 'Asia/Amman', 'MuslimWorldLeague'],
  ['القدس', 'فلسطين', 31.7683, 35.2137, 'Asia/Jerusalem', 'MuslimWorldLeague'],
  ['غزة', 'فلسطين', 31.5017, 34.4668, 'Asia/Gaza', 'Egyptian'],
  ['بيروت', 'لبنان', 33.8938, 35.5018, 'Asia/Beirut', 'MuslimWorldLeague'],
  ['دمشق', 'سوريا', 33.5138, 36.2765, 'Asia/Damascus', 'MuslimWorldLeague'],
  ['حلب', 'سوريا', 36.2021, 37.1343, 'Asia/Damascus', 'MuslimWorldLeague'],
  ['بغداد', 'العراق', 33.3152, 44.3661, 'Asia/Baghdad', 'MuslimWorldLeague'],
  ['البصرة', 'العراق', 30.5085, 47.7804, 'Asia/Baghdad', 'MuslimWorldLeague'],
  ['أربيل', 'العراق', 36.1911, 44.0092, 'Asia/Baghdad', 'MuslimWorldLeague'],
  ['صنعاء', 'اليمن', 15.3694, 44.191, 'Asia/Aden', 'UmmAlQura'],
  ['عدن', 'اليمن', 12.7855, 45.0187, 'Asia/Aden', 'UmmAlQura'],
  ['الخرطوم', 'السودان', 15.5007, 32.5599, 'Africa/Khartoum', 'Egyptian'],
  ['طرابلس', 'ليبيا', 32.8872, 13.1913, 'Africa/Tripoli', 'Egyptian'],
  ['بنغازي', 'ليبيا', 32.1194, 20.0868, 'Africa/Tripoli', 'Egyptian'],
  ['تونس', 'تونس', 36.8065, 10.1815, 'Africa/Tunis', 'MuslimWorldLeague'],
  ['الجزائر', 'الجزائر', 36.7538, 3.0588, 'Africa/Algiers', 'MuslimWorldLeague'],
  ['وهران', 'الجزائر', 35.6971, -0.6308, 'Africa/Algiers', 'MuslimWorldLeague'],
  ['الرباط', 'المغرب', 34.0209, -6.8416, 'Africa/Casablanca', 'MuslimWorldLeague'],
  ['الدار البيضاء', 'المغرب', 33.5731, -7.5898, 'Africa/Casablanca', 'MuslimWorldLeague'],
  ['مراكش', 'المغرب', 31.6295, -7.9811, 'Africa/Casablanca', 'MuslimWorldLeague'],
  ['نواكشوط', 'موريتانيا', 18.0735, -15.9582, 'Africa/Nouakchott', 'MuslimWorldLeague'],
  ['مقديشو', 'الصومال', 2.0469, 45.3182, 'Africa/Mogadishu', 'MuslimWorldLeague'],
  ['جيبوتي', 'جيبوتي', 11.5721, 43.1456, 'Africa/Djibouti', 'MuslimWorldLeague'],
  ['إسطنبول', 'تركيا', 41.0082, 28.9784, 'Europe/Istanbul', 'Turkey'],
  ['أنقرة', 'تركيا', 39.9334, 32.8597, 'Europe/Istanbul', 'Turkey'],
  ['طهران', 'إيران', 35.6892, 51.389, 'Asia/Tehran', 'Tehran'],
  ['كراتشي', 'باكستان', 24.8607, 67.0011, 'Asia/Karachi', 'Karachi'],
  ['لاهور', 'باكستان', 31.5204, 74.3587, 'Asia/Karachi', 'Karachi'],
  ['إسلام آباد', 'باكستان', 33.6844, 73.0479, 'Asia/Karachi', 'Karachi'],
  ['دكا', 'بنغلاديش', 23.8103, 90.4125, 'Asia/Dhaka', 'Karachi'],
  ['نيودلهي', 'الهند', 28.6139, 77.209, 'Asia/Kolkata', 'Karachi'],
  ['جاكرتا', 'إندونيسيا', -6.2088, 106.8456, 'Asia/Jakarta', 'Singapore'],
  ['كوالالمبور', 'ماليزيا', 3.139, 101.6869, 'Asia/Kuala_Lumpur', 'Singapore'],
  ['سنغافورة', 'سنغافورة', 1.3521, 103.8198, 'Asia/Singapore', 'Singapore'],
  ['لندن', 'المملكة المتحدة', 51.5074, -0.1278, 'Europe/London', 'MoonsightingCommittee'],
  ['باريس', 'فرنسا', 48.8566, 2.3522, 'Europe/Paris', 'MuslimWorldLeague'],
  ['برلين', 'ألمانيا', 52.52, 13.405, 'Europe/Berlin', 'MuslimWorldLeague'],
  ['أمستردام', 'هولندا', 52.3676, 4.9041, 'Europe/Amsterdam', 'MuslimWorldLeague'],
  ['بروكسل', 'بلجيكا', 50.8503, 4.3517, 'Europe/Brussels', 'MuslimWorldLeague'],
  ['ستوكهولم', 'السويد', 59.3293, 18.0686, 'Europe/Stockholm', 'MuslimWorldLeague'],
  ['روما', 'إيطاليا', 41.9028, 12.4964, 'Europe/Rome', 'MuslimWorldLeague'],
  ['مدريد', 'إسبانيا', 40.4168, -3.7038, 'Europe/Madrid', 'MuslimWorldLeague'],
  ['نيويورك', 'الولايات المتحدة', 40.7128, -74.006, 'America/New_York', 'NorthAmerica'],
  ['شيكاغو', 'الولايات المتحدة', 41.8781, -87.6298, 'America/Chicago', 'NorthAmerica'],
  ['هيوستن', 'الولايات المتحدة', 29.7604, -95.3698, 'America/Chicago', 'NorthAmerica'],
  ['لوس أنجلوس', 'الولايات المتحدة', 34.0522, -118.2437, 'America/Los_Angeles', 'NorthAmerica'],
  ['تورنتو', 'كندا', 43.6532, -79.3832, 'America/Toronto', 'NorthAmerica'],
  ['مونتريال', 'كندا', 45.5017, -73.5673, 'America/Toronto', 'NorthAmerica'],
  ['سيدني', 'أستراليا', -33.8688, 151.2093, 'Australia/Sydney', 'MuslimWorldLeague'],
  ['جوهانسبرغ', 'جنوب أفريقيا', -26.2041, 28.0473, 'Africa/Johannesburg', 'MuslimWorldLeague'],
  ['لاغوس', 'نيجيريا', 6.5244, 3.3792, 'Africa/Lagos', 'MuslimWorldLeague'],
  ['داكار', 'السنغال', 14.7167, -17.4677, 'Africa/Dakar', 'MuslimWorldLeague'],
].map(([name, country, lat, lng, tz, method]) => ({ name, country, lat, lng, tz, method }));

/** الموقع المحفوظ: { name, lat, lng, tz, method, madhab } */
export const getLocation = () => settings.get('prayerLocation');

/** طريقة الحساب الافتراضية من المنطقة الزمنية للجهاز */
export function methodForTz(tz) {
  if (/Cairo|Khartoum|Tripoli|Gaza/.test(tz)) return 'Egyptian';
  if (/Riyadh|Aden|Bahrain|Muscat/.test(tz)) return 'UmmAlQura';
  if (/Dubai/.test(tz)) return 'Dubai';
  if (/Qatar/.test(tz)) return 'Qatar';
  if (/Kuwait/.test(tz)) return 'Kuwait';
  if (/Istanbul/.test(tz)) return 'Turkey';
  if (/Karachi|Kolkata|Dhaka/.test(tz)) return 'Karachi';
  if (/Jakarta|Kuala|Singapore/.test(tz)) return 'Singapore';
  if (/^America\//.test(tz)) return 'NorthAmerica';
  if (/Tehran/.test(tz)) return 'Tehran';
  return 'MuslimWorldLeague';
}

/** يحسب مواقيت يوم (افتراضيًا اليوم) */
export function computeTimes(loc, date = new Date()) {
  const params = CalculationMethod[loc.method || 'MuslimWorldLeague']();
  params.madhab = loc.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (Math.abs(loc.lat) > 48) params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
  // نحسب "اليوم" بتوقيت المدينة نفسها
  const ymd = dayInTz(date, loc.tz);
  const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lng), new Date(ymd.y, ymd.m - 1, ymd.d), params);
  return { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
}

function dayInTz(date, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day };
  } catch { return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }; }
}

export function fmtTime(date, tz) {
  try { return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: tz || undefined }).format(date); }
  catch { return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(date); }
}

/** الصلاة القادمة والوقت المتبقي */
export function nextPrayer(loc, now = new Date()) {
  const today = computeTimes(loc, now);
  for (const p of PRAYERS) if (p.key !== 'sunrise' && today[p.key] > now) return { ...p, time: today[p.key], today };
  const tomorrow = computeTimes(loc, new Date(now.getTime() + 86400000));
  return { ...PRAYERS[0], time: tomorrow.fajr, today };
}

export function currentPrayerKey(times, now = new Date()) {
  let cur = null;
  for (const p of PRAYERS) if (times[p.key] <= now) cur = p.key;
  return cur;
}

export function countdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${ar(h)} س ${ar(mm)} د` : `${ar(mm)} دقيقة`;
}

/** اتجاه القبلة بالدرجات من الشمال الجغرافي */
export const qiblaBearing = (lat, lng) => Qibla(new Coordinates(lat, lng));

/** المسافة إلى الكعبة بالكيلومتر */
export function distanceToKaaba(lat, lng) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (21.4225 - lat) * rad, dLng = (39.8262 - lng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(21.4225 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- التاريخ الهجري (تقويم أم القرى المدمج في المتصفح) ----------
const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
export function hijri(date = new Date()) {
  const adj = settings.get('hijriAdjust') || 0;
  const d = new Date(date.getTime() + adj * 86400000);
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d).map((x) => [x.type, x.value]));
    const day = +p.day, month = +p.month, year = parseInt(p.year, 10);
    return { day, month, year, text: `${ar(day)} ${HIJRI_MONTHS[month - 1]} ${ar(year)} هـ` };
  } catch { return null; }
}

export function gregorianText(date = new Date()) {
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** وقت اليوم للخلفية المحيطة (فجر/نهار/مغرب/ليل) */
export function timeOfDay(loc, now = new Date()) {
  if (!loc) return null;
  const t = computeTimes(loc, now);
  const M = 60000;
  if (now >= t.fajr && now < new Date(t.sunrise.getTime() + 30 * M)) return 'fajr';
  if (now >= new Date(t.maghrib.getTime() - 40 * M) && now < t.isha) return 'maghrib';
  if (now >= t.sunrise && now < t.maghrib) return 'day';
  return 'night';
}
