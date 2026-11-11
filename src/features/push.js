// إشعارات الأذان والورد (Web Push): تصل حتى والتطبيق مغلق.
// الخادم يحسب المواقيت بموقع مقرّب (~١ كم) وطريقة الحساب التي اخترتها، ولا يعرف عنك شيئًا غير ذلك.
import * as settings from '../state.js';
import { track } from './stats.js';

const SUPABASE_URL = 'https://lskfbmkesxxgqytjsftk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4yIAdvDsyTja323tcEVUvQ_KLxQYg7P';
const VAPID_PUBLIC = 'BNioSzMUi23zBJoSMOTqcb7peyQ27p2qKq_YkostI4gINzNPcKJdB3TtPWELM2kbr-1E2JeM2JcG5XHcXoZ83Xo';
export const PUSH_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** 'ok' | 'unsupported' | 'ios-install' (آيفون: يلزم التثبيت على الشاشة الرئيسية) | 'denied' */
export function pushStatus() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in self) || !('Notification' in self)) return isIOS() && !standalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error('push ' + res.status);
}

const b64ToBytes = (s) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function subscription(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  return sub;
}

function prefs() {
  const loc = settings.get('prayerLocation');
  return {
    prayers: loc ? settings.get('notifyPrayers') || [] : [],
    wird_time: settings.get('wirdTime') || '',
    lat: loc?.lat ?? null, lng: loc?.lng ?? null,
    tz: loc?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    method: loc?.method || 'Egyptian', madhab: loc?.madhab || 'shafi',
  };
}
const wanted = () => (settings.get('notifyPrayers') || []).length > 0 || !!settings.get('wirdTime');

/** يطلب إذن الإشعارات فورًا (لازم يُستدعى مباشرة داخل ضغطة المستخدم — شرط في iOS) */
export function askPermission() {
  if (!('Notification' in self) || Notification.permission !== 'default') return Promise.resolve(self.Notification?.permission);
  return Notification.requestPermission();
}

/** إشعار تجريبي لهذا الجهاز من الخادم (يمر بنفس طريق تنبيهات الأذان) */
export async function testPush() {
  const sub = await subscription(false);
  if (!sub) throw new Error('not subscribed');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/push-tick`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test_endpoint: sub.endpoint }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || String(res.status));
  return d;
}

/** عند فتح التطبيق: تحديث الاشتراك على الخادم (المتصفح قد يغيّر نقطة الإرسال) */
export function refreshPush() {
  if (!wanted() || pushStatus() !== 'ok' || Notification.permission !== 'granted') return;
  syncPush().catch(() => {});
}

/** يحفظ التفضيلات الحالية على الخادم (يطلب الإذن عند أول تفعيل). يرجع true لو نجح */
export async function syncPush({ ask = false } = {}) {
  if (pushStatus() !== 'ok') return false;
  if (!wanted()) {
    const sub = await subscription(false).catch(() => null);
    if (sub) { await rpc('push_delete', { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    return true;
  }
  if (Notification.permission !== 'granted') {
    if (!ask) return false;
    if ((await Notification.requestPermission()) !== 'granted') return false;
  }
  const sub = await subscription(true);
  await rpc('push_save', { p_sub: sub.toJSON(), p_prefs: prefs() });
  track('push_on');
  return true;
}

// تحديث الخادم تلقائيًا عند تغيير الموقع أو طريقة الحساب
let t = 0;
settings.subscribe((k) => {
  if (k !== 'prayerLocation' || !wanted()) return;
  clearTimeout(t); t = setTimeout(() => syncPush().catch(() => {}), 1500);
});
