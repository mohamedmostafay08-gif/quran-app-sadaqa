// الختمة الجماعية والمُهداة — خادم Supabase بدوال محددة فقط (لا وصول مباشر للجداول)
import * as settings from '../state.js';

// مفتاح عام (publishable) مخصص للاستخدام في المتصفح؛ الصلاحيات محصورة في دوال الختمة
const SUPABASE_URL = 'https://lskfbmkesxxgqytjsftk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4yIAdvDsyTja323tcEVUvQ_KLxQYg7P';

const ERRORS = {
  'part taken': 'هذا الجزء أخذه شخص آخر للتو',
  'not yours': 'هذا الجزء ليس مسجلًا باسمك على هذا الجهاز',
  'too many parts': 'الحد الأقصى ١٠ أجزاء لكل شخص في الدورة',
  'not found': 'الختمة غير موجودة أو حُذفت',
  'title required': 'اكتب اسمًا للختمة',
};

async function rpc(name, args) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error(navigator.onLine ? 'تعذر الاتصال بالخادم' : 'الختمة الجماعية تحتاج اتصالًا بالإنترنت');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || '';
    throw new Error(Object.entries(ERRORS).find(([k]) => msg.includes(k))?.[1] || 'حدث خطأ، حاول مرة أخرى');
  }
  return data;
}

/** معرّف سري لهذا الجهاز (يُخزَّن محليًا، ويُرسَل للخادم ليُحفظ مُجزّأً فقط) */
export function deviceToken() {
  let t = settings.get('deviceToken');
  if (!t) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    t = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    settings.set('deviceToken', t);
  }
  return t;
}

export const shareUrl = (id) => `${location.origin}${location.pathname}#/group/${id}`;

/** ختمات هذا الجهاز (أنشأها أو شارك فيها) */
export const myGroups = () => settings.get('myGroups') || [];
function remember(g) {
  const list = myGroups().filter((x) => x.id !== g.id);
  const old = myGroups().find((x) => x.id === g.id) || {};
  list.unshift({ ...old, ...g, at: Date.now() });
  settings.set('myGroups', list.slice(0, 30));
}
export function forget(id) { settings.set('myGroups', myGroups().filter((x) => x.id !== id)); }

export async function createGroup({ title, dedication, kind }) {
  const r = await rpc('khatma_create', { p_title: title, p_dedication: dedication || null, p_kind: kind });
  remember({ id: r.id, title, kind, admin: r.admin });
  return r.id;
}
export async function getGroup(id) {
  const g = await rpc('khatma_get', { p_id: id, p_device: deviceToken() });
  if (!g) throw new Error(ERRORS['not found']);
  remember({ id: g.id, title: g.title, kind: g.kind });
  return g;
}
export const takePart = (id, n, name) => rpc('khatma_take', { p_id: id, p_part: n, p_name: name || null, p_device: deviceToken() });
export const donePart = (id, n) => rpc('khatma_done', { p_id: id, p_part: n, p_device: deviceToken() });
export const releasePart = (id, n) => rpc('khatma_release', { p_id: id, p_part: n, p_device: deviceToken() });
export async function deleteGroup(id) {
  const admin = myGroups().find((x) => x.id === id)?.admin;
  if (!admin) throw new Error('حذف الختمة متاح لمن أنشأها فقط');
  const ok = await rpc('khatma_delete', { p_id: id, p_admin: admin });
  if (ok) forget(id);
  return ok;
}
export const isAdmin = (id) => !!myGroups().find((x) => x.id === id)?.admin;
