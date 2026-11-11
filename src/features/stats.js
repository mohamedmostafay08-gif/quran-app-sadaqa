// إحصائيات استخدام مجمّعة ومجهولة: كل حدث يُرسل مرة واحدة في اليوم على الأكثر من كل جهاز،
// بلا أي معرّف أو بيانات شخصية — الخادم يحفظ فقط «عدد مرات الحدث في هذا اليوم».
// يمكن إيقافها من الإعدادات، وتتوقف تلقائيًا لو المتصفح يطلب عدم التتبع (GPC / DNT).
import * as settings from '../state.js';

const URL_ = 'https://lskfbmkesxxgqytjsftk.supabase.co/rest/v1/rpc/stat_hit';
const KEY = 'sb_publishable_4yIAdvDsyTja323tcEVUvQ_KLxQYg7P';
const pending = new Set();
let timer = 0;

const today = () => new Date().toISOString().slice(0, 10);
const optedOut = () => !settings.get('stats') || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

function sentToday() {
  try {
    const v = JSON.parse(localStorage.getItem('qa:stats') || 'null');
    return v && v.day === today() ? new Set(v.events) : new Set();
  } catch { return new Set(); }
}

/** تسجيل حدث (يُجمع ويُرسل دفعة واحدة) */
export function track(event) {
  if (optedOut()) return;
  if (sentToday().has(event)) return;
  pending.add(event);
  clearTimeout(timer);
  timer = setTimeout(flush, 8000);
}

function flush() {
  clearTimeout(timer);
  if (!pending.size || optedOut() || !navigator.onLine) return;
  const done = sentToday();
  const events = [...pending].filter((e) => !done.has(e));
  pending.clear();
  if (!events.length) return;
  try { localStorage.setItem('qa:stats', JSON.stringify({ day: today(), events: [...done, ...events] })); } catch { /* */ }
  if (local) return; // لا نحسب التجارب المحلية
  fetch(URL_, {
    method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_events: events }),
  }).catch(() => {});
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
