// سجل النشاط اليومي على الجهاز فقط: الصفحات المقروءة، ودقائق الاستماع، والتسبيح
// { "2026-11-18": { p: [صفحات], l: ثوانٍ, t: تسبيحات } } — يُحتفظ بآخر ١٢٠ يومًا
import { player } from '../audio/player.js';

const KEY = 'qa:activity';
const KEEP_DAYS = 120;
export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA');

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  return cache;
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
}
function flush() {
  const data = load();
  const keys = Object.keys(data).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete data[k];
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* المساحة ممتلئة أو التخزين محظور */ }
}
addEventListener('pagehide', flush);

const today = () => (load()[dayKey()] ||= { p: [], l: 0, t: 0 });

/** صفحة مصحف ظهرت للقارئ */
export function recordPage(page) {
  if (!(page >= 1 && page <= 604)) return;
  const d = today();
  if (!d.p.includes(page)) { d.p.push(page); save(); }
}
export function recordTasbih(n = 1) { today().t += n; save(); }

/** نشاط الأيام الأخيرة (الأحدث آخرًا) */
export function lastDays(n) {
  const data = load();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const x = data[dayKey(d)] || { p: [], l: 0, t: 0 };
    out.push({ date: d, pages: x.p.length, minutes: Math.round(x.l / 60), tasbih: x.t || 0 });
  }
  return out;
}

/** عدد الأيام المتتالية بنشاط (قراءة أو استماع) حتى اليوم أو أمس */
export function streak() {
  const data = load();
  const active = (d) => { const x = data[dayKey(d)]; return !!x && (x.p.length > 0 || x.l >= 60); };
  const d = new Date();
  if (!active(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** تسجيل الاستماع: الثواني الفعلية أثناء التشغيل (التلاوة والتفسير، لا الإذاعة المباشرة) */
export function initActivity() {
  let last = 0;
  player.audio.addEventListener('timeupdate', () => {
    const st = player.state();
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    if (st.status !== 'playing' || (st.radio && !st.radio.ondemand) || dt <= 0 || dt > 3) return;
    today().l += dt;
    save();
  });
}

/** بعد المزامنة: نعيد القراءة من التخزين */
export function resetCache() { cache = null; }
