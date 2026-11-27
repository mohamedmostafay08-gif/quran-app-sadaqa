// الجسر مع تطبيق أندرويد (android/): يعمل فقط داخل التطبيق، حيث يوفّر window.RattilNative.
// - يرسل إعدادات الأذان والورد ليجدول التطبيق إشعارات أصلية تعمل والتطبيق مغلق وبلا إنترنت.
// - الـ WebView لا ينزّل روابط blob، فنحوّل أي تنزيل (النسخة الاحتياطية، الصور…) إلى حفظ عبر التطبيق.
import * as settings from '../state.js';
import { computeTimes } from './prayer.js';

const bridge = () => self.RattilNative;
export const isNativeApp = () => !!bridge();

const KEYS = ['prayerLocation', 'notifyPrayers', 'wirdTime', 'preAdhan'];
export const NATIVE_DAYS = 60;

/**
 * ما يحتاجه التطبيق للجدولة: المواقيت محسوبة هنا بنفس مكتبة الشاشة لـ ٦٠ يومًا (مطابقة تمامًا لما يراه المستخدم)،
 * ويُعاد إرسالها مع كل فتح للتطبيق وكل تغيير في الإعدادات.
 */
export function nativeSchedule(now = new Date()) {
  const loc = settings.get('prayerLocation');
  const days = [];
  if (loc) {
    for (let i = 0; i < NATIVE_DAYS; i++) {
      const t = computeTimes(loc, new Date(now.getTime() + i * 86400000));
      days.push({ fajr: +t.fajr, sunrise: +t.sunrise, dhuhr: +t.dhuhr, asr: +t.asr, maghrib: +t.maghrib, isha: +t.isha });
    }
  }
  return {
    city: loc?.name || '',
    tz: loc?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    days,
    prayers: loc ? settings.get('notifyPrayers') || [] : [],
    preAdhan: +settings.get('preAdhan') || 0,
    wirdTime: settings.get('wirdTime') || null,
  };
}

/** إشعار تجريبي من التطبيق نفسه */
export async function nativeTest() { bridge().testNotification(); }

const toBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

async function saveViaNative(a) {
  const blob = await (await fetch(a.href)).blob();
  bridge().saveFile(a.download || 'rattil', blob.type || 'application/octet-stream', await toBase64(blob));
}

export function initNative() {
  if (!bridge()) return;
  document.documentElement.classList.add('native-app');
  const push = () => { try { bridge().setSchedule(JSON.stringify(nativeSchedule())); } catch (e) { console.warn(e); } };
  push();
  settings.subscribe((k) => { if (KEYS.includes(k)) push(); });
  // التطبيق مفتوح وضغط المستخدم إشعارًا: ننتقل للمسار ونشغّل الأذان إن طُلب
  addEventListener('rattil-open', (e) => {
    const hash = String(e.detail || '');
    const adhan = /[?&]adhan=(\w+)/.exec(hash)?.[1];
    location.hash = hash.replace(/[?&]adhan=\w+/, '') || '#/';
    if (adhan) import('./adhan.js').then((m) => m.playAdhan(adhan));
  });

  // التنزيل: a.click() البرمجي (غالبًا لعنصر خارج الصفحة) والضغط المباشر على روابط download
  const isBlobDownload = (a) => a?.download != null && a.hasAttribute('download') && /^(blob|data):/.test(a.href);
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isBlobDownload(this)) { saveViaNative(this).catch((e) => console.warn(e)); return; }
    return click.call(this);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[download]');
    if (isBlobDownload(a)) { e.preventDefault(); saveViaNative(a).catch((err) => console.warn(err)); }
  }, true);
}
