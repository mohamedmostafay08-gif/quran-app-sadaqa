// المزامنة بين أجهزتك: «رمز مزامنة» واحد تكتبه على كل جهاز.
// البيانات تُشفَّر على الجهاز (AES-GCM بمفتاح مشتق من الرمز) قبل رفعها، فلا يقرؤها الخادم،
// ويُخزَّن عنده معرّف مُجزّأ (SHA-256) فقط. الدمج يجمع بيانات الجهازين ولا يمسح شيئًا إلا ما حذفته أنت.
import { db } from '../db.js';
import * as settings from '../state.js';

const SUPABASE_URL = 'https://lskfbmkesxxgqytjsftk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4yIAdvDsyTja323tcEVUvQ_KLxQYg7P';
const STORES = ['bookmarks', 'notes', 'memorize', 'khatma'];
// إعدادات خاصة بكل جهاز لا تُنقل
const LOCAL_ONLY = new Set(['theme', 'fontScale', 'bigUI', 'keepAwake', 'wifiOnly', 'autoDownloadNext', 'adhanInApp', 'deviceToken',
  'onboarded', 'dataNotice', 'lastBackupAt', 'syncCode', 'prayersDefaultV2', 'fastingDefaultV1', 'preAdhanDefaultV1', 'stats', 'appBadge', 'prayerLocation']);
// سجلات تُدمج مفتاحًا بمفتاح بدل الاستبدال
const MAPS = new Set(['prayerLog', 'adhkarLog', 'badges', 'kidsStars', 'nawawi', 'rateByReciter', 'dhikrLog', 'fastLog', 'lessonProgress']);
const STAMPED = new Set(['lastRead', 'lastListen', 'lastLesson']); // الأحدث (بحقل at) يفوز
const K = { deleted: 'qa:sync:deleted', changed: 'qa:sync:changed', at: 'qa:sync:at', activity: 'qa:activity' };

const enc = new TextEncoder(), dec = new TextDecoder();
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* محظور */ } };
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

/* ---------- الرمز والمفاتيح ---------- */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا حروف متشابهة (O/0 وI/1)
export function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(16));
  return [...r].map((b) => ALPHA[b % 32]).join('').replace(/(.{4})(?=.)/g, '$1-');
}
export function normalizeCode(s) {
  const c = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 16 && [...c].every((ch) => ALPHA.includes(ch)) ? c.replace(/(.{4})(?=.)/g, '$1-') : null;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
let keyCache = null;
async function keys(code) {
  if (keyCache?.code === code) return keyCache;
  const raw = code.replace(/-/g, '');
  const id = hex(await crypto.subtle.digest('SHA-256', enc.encode('rattil-sync-id:' + raw)));
  const base = await crypto.subtle.importKey('raw', enc.encode(raw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('rattil-sync-key-v1'), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return (keyCache = { code, id, key });
}

const b64 = { enc: (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); },
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
async function seal(key, obj) {
  let bytes = enc.encode(JSON.stringify(obj)), tag = 'v1.';
  if (self.CompressionStream) { bytes = await pipe(bytes, new CompressionStream('gzip')); tag = 'v1g.'; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return tag + b64.enc(out);
}
async function open(key, text) {
  const [tag, body] = text.split('.');
  const all = b64.dec(body);
  let bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, key, all.subarray(12)));
  if (tag === 'v1g') bytes = await pipe(bytes, new DecompressionStream('gzip'));
  return JSON.parse(dec.decode(bytes));
}

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const data = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error(data?.message || 'sync failed'); e.conflict = /conflict/.test(data?.message || ''); throw e; }
  return data;
}

/* ---------- لقطة البيانات والدمج ---------- */
async function snapshot() {
  const stores = {};
  for (const s of STORES) stores[s] = await db.all(s);
  const changed = lsGet(K.changed, {});
  const st = {};
  for (const r of await db.all('settings')) if (!LOCAL_ONLY.has(r.key) && r.key in settings.DEFAULTS) st[r.key] = { v: r.value, t: changed[r.key] || 0 };
  return { v: 1, stores, settings: st, activity: lsGet(K.activity, {}), deleted: lsGet(K.deleted, {}) };
}

const num = (v) => (typeof v === 'number' ? v : v ? Date.parse(v) || 0 : 0);
// أحدث تعديل للسجل: تعديل صريح، أو آخر مراجعة حفظ، أو وقت الإنشاء
const stamp = (r) => Math.max(num(r?.updatedAt), num(r?.lastReview), num(r?.addedAt), num(r?.createdAt), num(r?.at));
/** دمج سجلين لنفس العنصر: الأحدث يفوز، والختمة تأخذ أكبر تقدّم وتجمع سجلها اليومي */
function pick(store, a, b) {
  if (store === 'khatma') {
    const [hi, lo] = (a.donePage || 0) >= (b.donePage || 0) ? [a, b] : [b, a];
    const log = { ...(lo.log || {}) };
    for (const [d, n] of Object.entries(hi.log || {})) log[d] = Math.max(n, log[d] || 0);
    return { ...hi, log, finishedAt: hi.finishedAt || lo.finishedAt || null, updatedAt: Math.max(num(a.updatedAt), num(b.updatedAt)) || null };
  }
  return stamp(a) >= stamp(b) ? a : b;
}
function deepMerge(a, b) { // a = المحلي (يفوز عند التعارض)، b = البعيد
  if (isObj(a) && isObj(b)) { const o = { ...b }; for (const k of Object.keys(a)) o[k] = k in b ? deepMerge(a[k], b[k]) : a[k]; return o; }
  if (Array.isArray(a) && Array.isArray(b)) return [...new Set([...b, ...a].map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
  return a === undefined ? b : a;
}

export function merge(local, remote) {
  const deleted = { ...remote.deleted };
  for (const [k, t] of Object.entries(local.deleted || {})) deleted[k] = Math.max(t, deleted[k] || 0);
  const cutoff = Date.now() - 180 * 864e5; // نحتفظ بسجل المحذوفات ستة أشهر
  for (const k of Object.keys(deleted)) if (deleted[k] < cutoff) delete deleted[k];

  const stores = {};
  for (const s of STORES) {
    const map = new Map((remote.stores?.[s] || []).map((r) => [String(r.id), r]));
    for (const r of local.stores?.[s] || []) { const o = map.get(String(r.id)); map.set(String(r.id), o ? pick(s, r, o) : r); }
    stores[s] = [...map.values()].filter((r) => { const t = deleted[`${s}|${r.id}`]; return !t || stamp(r) > t; });
  }

  const st = { ...(remote.settings || {}) };
  for (const [k, L] of Object.entries(local.settings || {})) {
    const R = st[k];
    if (!R) { st[k] = L; continue; }
    if (MAPS.has(k)) st[k] = { v: deepMerge(L.v || {}, R.v || {}), t: Math.max(L.t, R.t) };
    else if (STAMPED.has(k)) st[k] = (R.v?.at || 0) > (L.v?.at || 0) ? R : L;
    else st[k] = R.t > L.t ? R : L;
  }

  const activity = { ...(remote.activity || {}) };
  for (const [d, x] of Object.entries(local.activity || {})) {
    const o = activity[d];
    activity[d] = o ? { p: [...new Set([...(o.p || []), ...(x.p || [])])], l: Math.max(o.l || 0, x.l || 0), t: Math.max(o.t || 0, x.t || 0) } : x;
  }
  return { v: 1, stores, settings: st, activity, deleted };
}

/** يكتب ما تغيّر محليًا؛ يرجع true لو وصلت بيانات جديدة من جهاز آخر */
let applying = false;
async function apply(merged, local) {
  let changed = false;
  for (const s of STORES) {
    const mine = new Map((local.stores[s] || []).map((r) => [String(r.id), JSON.stringify(r)]));
    const put = merged.stores[s].filter((r) => mine.get(String(r.id)) !== JSON.stringify(r));
    const keep = new Set(merged.stores[s].map((r) => String(r.id)));
    const gone = (local.stores[s] || []).filter((r) => !keep.has(String(r.id)));
    if (put.length) { await db.putMany(s, put); changed = true; }
    for (const r of gone) { await db.del(s, r.id); changed = true; }
  }
  applying = true;
  try {
    for (const [k, x] of Object.entries(merged.settings)) {
      if (LOCAL_ONLY.has(k) || !(k in settings.DEFAULTS)) continue;
      if (JSON.stringify(local.settings[k]?.v) !== JSON.stringify(x.v)) { await settings.set(k, x.v); changed = true; }
    }
  } finally { applying = false; }
  const ch = lsGet(K.changed, {});
  for (const [k, x] of Object.entries(merged.settings)) if (x.t > (ch[k] || 0)) ch[k] = x.t;
  lsSet(K.changed, ch);
  if (JSON.stringify(local.activity) !== JSON.stringify(merged.activity)) { lsSet(K.activity, merged.activity); changed = true; }
  lsSet(K.deleted, merged.deleted);
  return changed;
}

/* ---------- التشغيل ---------- */
let running = null;
export const lastSync = () => lsGet(K.at, 0);

/** زامن الآن: يجلب، يدمج، يكتب، ثم يرفع. يرجع { changed } */
export function syncNow() {
  return (running ||= (async () => {
    const code = settings.get('syncCode');
    if (!code) return { changed: false };
    if (!navigator.onLine) throw new Error('المزامنة تحتاج اتصالًا بالإنترنت');
    const { id, key } = await keys(code);
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await rpc('sync_get', { p_id: id });
      let remoteData = null;
      if (remote?.data) { try { remoteData = await open(key, remote.data); } catch { throw new Error('تعذّر فتح البيانات بهذا الرمز'); } }
      const local = await snapshot();
      const merged = remoteData ? merge(local, remoteData) : merge(local, { stores: {}, settings: {}, activity: {}, deleted: {} });
      const changed = await apply(merged, local);
      if (remoteData && JSON.stringify(remoteData) === JSON.stringify(merged)) { lsSet(K.at, Date.now()); return { changed }; }
      try {
        await rpc('sync_put', { p_id: id, p_data: await seal(key, merged), p_base: remote?.updated_at || null });
        lsSet(K.at, Date.now());
        return { changed };
      } catch (e) { if (!e.conflict) throw e; } // جهاز آخر رفع للتو: نعيد الدمج
    }
    throw new Error('حاول مرة أخرى بعد قليل');
  })().finally(() => { running = null; }));
}

/** إيقاف المزامنة على هذا الجهاز (ومسح النسخة من الخادم إن طُلب) */
export async function stopSync({ wipe = false } = {}) {
  const code = settings.get('syncCode');
  if (wipe && code) { const { id } = await keys(code); await rpc('sync_delete', { p_id: id }); }
  await settings.set('syncCode', null);
  try { localStorage.removeItem(K.at); } catch { /* */ }
}

/** يمسح النسخ المحفوظة في الذاكرة ويعيد رسم الشاشة (بدون إعادة تحميل التطبيق) */
export async function refreshAfterSync() {
  const mods = await Promise.all([import('./bookmarks.js'), import('./notes.js'), import('./activity.js')]).catch(() => []);
  for (const m of mods) m.resetCache?.();
  // لا نقاطع القارئ أثناء القراءة أو الاستماع، ولا نعيد رسم شاشة اليوم فور الفتح
  const r = location.hash.split('/')[1] || '';
  if (!['surah', 'page', 'focus', ''].includes(r)) dispatchEvent(new HashChangeEvent('hashchange'));
}

/** مزامنة تلقائية: عند الفتح، وبعد التعديل بدقيقة، وعند الخروج من التطبيق */
export function initSync() {
  let timer = 0;
  const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), ms); };
  settings.subscribe((k) => {
    if (applying || LOCAL_ONLY.has(k)) return;
    const ch = lsGet(K.changed, {}); ch[k] = Date.now(); lsSet(K.changed, ch);
    if (settings.get('syncCode')) later(60_000);
  });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && settings.get('syncCode')) syncNow().catch(() => {}); });
  if (!settings.get('syncCode')) return;
  setTimeout(async () => {
    try {
      const { changed } = await syncNow();
      // بيانات جديدة من جهاز آخر: نحدّث الذاكرة ونعيد رسم الشاشة الحالية بدل إعادة تحميل التطبيق
      if (changed) await refreshAfterSync();
    } catch { /* نحاول في المرة القادمة */ }
  }, 2500);
}
