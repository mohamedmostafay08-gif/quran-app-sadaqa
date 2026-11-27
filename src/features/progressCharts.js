// رسوم التقدّم في «إحصائياتي»: الختمة مقابل خطتها، ونمو المحفوظ وقوته، وخريطة المداومة مع الشارة القادمة.
// الوقت يجري من اليمين إلى اليسار اتساقًا مع واجهة عربية. الألوان من متغيرات الثيم فتعمل في الفاتح والليلي.
import { h, ar } from '../lib/dom.js';
import * as K from './khatma.js';
import * as srs from './srs.js';
import { lastDays, streak, dayKey } from './activity.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };
const DAY = 86400000;
const fmtDay = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' });

/** تلميح واحد لكل رسم، يُملأ بـ textContent فقط */
function tooltip() {
  const tip = h('div.pc-tip', { role: 'status', hidden: true });
  return {
    el: tip,
    show(x, rows) {
      tip.replaceChildren(...rows.map(([value, label, key]) => h('div.pc-tip-row', key ? h('i', { class: `pc-key ${key}` }) : null, h('strong', value), h('span', label))));
      tip.hidden = false;
      tip.style.insetInlineStart = '';
      tip.style.left = `${x}px`;
    },
    hide() { tip.hidden = true; },
  };
}

/**
 * منحنى خطي لسلسلة أو اثنتين على محور زمني واحد (يمين ← يسار) مع خط تتبّع وتلميح.
 * series: [{ key, label, values: [number|null], dashed? }]، وlabels: نص كل نقطة للتلميح
 */
function lineChart({ series, labels, yMax, yTicks, ariaLabel, unit }) {
  const W = 320, H = 150, L = 8, R = 34, T = 10, B = 18; // R: هامش أرقام المحور (يمينًا)
  const n = labels.length;
  const x = (i) => (n === 1 ? W - R : W - R - (i / (n - 1)) * (W - R - L));
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pc-svg', role: 'img', 'aria-label': ariaLabel });
  for (const t of yTicks) {
    root.append(svg('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), class: 'pc-grid' }),
      svg('text', { x: W - R + 6, y: y(t) + 4, class: 'pc-axis', 'text-anchor': 'start' }, ar(t)));
  }
  for (const [i, lab] of [[0, labels[0]], [n - 1, labels[n - 1]]]) {
    if (n > 1 || i === 0) root.append(svg('text', { x: x(i), y: H - 3, class: 'pc-axis', 'text-anchor': i === 0 ? 'end' : 'start' }, lab));
  }
  for (const s of series) {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    if (s.area) root.append(svg('path', { d: `${d}L${pts[pts.length - 1][0].toFixed(1)} ${y(0)}L${pts[0][0].toFixed(1)} ${y(0)}Z`, class: `pc-area ${s.key}` }));
    root.append(svg('path', { d, class: `pc-line ${s.key}${s.dashed ? ' dashed' : ''}` }));
    const [ex, ey] = pts[pts.length - 1];
    root.append(svg('circle', { cx: ex, cy: ey, r: 4, class: `pc-dot ${s.key}` }));
  }
  const cross = svg('line', { y1: T, y2: H - B, class: 'pc-cross', visibility: 'hidden' });
  const hit = svg('rect', { x: L, y: 0, width: W - R - L, height: H, fill: 'transparent', tabindex: 0, 'aria-label': `${ariaLabel}: استخدم الأسهم للتنقل` });
  root.append(cross, hit);
  const tip = tooltip();
  const wrap = h('div.pc-chart', root, tip.el);
  let cur = n - 1;
  const show = (i) => {
    cur = Math.max(0, Math.min(n - 1, i));
    cross.setAttribute('x1', x(cur)); cross.setAttribute('x2', x(cur)); cross.setAttribute('visibility', 'visible');
    const box = root.getBoundingClientRect();
    tip.show(x(cur) / W * box.width, [[labels[cur], '', null], ...series.filter((s) => s.values[cur] != null).map((s) => [`${ar(s.values[cur])} ${unit}`, s.label, s.key])]);
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hide(); };
  hit.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    show(Math.round(((W - R - px) / (W - R - L)) * (n - 1)));
  });
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('focus', () => show(cur));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', (e) => {
    // RTL: السهم الأيسر يتقدم في الزمن
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur + 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur - 1); }
  });
  return wrap;
}

const legend = (items) => h('div.pc-legend', items.map(([key, label]) => h('span', h('i', { class: `pc-key ${key}` }), label)));
const table = (head, rows) => h('details.pc-table', h('summary', 'عرض كجدول'),
  h('div.pc-table-wrap', h('table', h('thead', h('tr', head.map((c) => h('th', c)))), h('tbody', rows.map((r) => h('tr', r.map((c) => h('td', c))))))));
const niceMax = (v) => { const steps = [10, 20, 50, 100, 150, 200, 300, 400, 604]; return steps.find((s) => s >= v) || Math.ceil(v / 100) * 100; };

/** الختمة النشطة: الصفحات المتراكمة يومًا بيوم مقابل الخطة */
export async function khatmaProgress() {
  const k = await K.getActive('read').catch(() => null) || await K.getActive().catch(() => null);
  if (!k) return h('section.card.pc-card', h('h3', 'تقدّم الختمة'), h('p.muted', 'لا توجد ختمة جارية.'), h('a.btn.ghost', { href: '#/khatma' }, 'ابدأ ختمة'));
  const p = K.plan(k);
  const logged = Object.values(k.log || {}).reduce((a, b) => a + b, 0);
  const start = Math.max(0, k.donePage - logged);
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const today = Math.round((midnight.getTime() - k.startDate) / DAY);
  const lastIdx = Math.max(k.days - 1, Math.min(today, k.days + 60));
  const labels = [], actual = [], planned = [];
  let cum = start;
  for (let i = 0; i <= lastIdx; i++) {
    const d = new Date(k.startDate + i * DAY);
    labels.push(fmtDay.format(d));
    if (i <= today) { cum += k.log[dayKey(d)] || 0; actual.push(cum); } else actual.push(null);
    planned.push(i < k.days ? Math.round(start + ((K.TOTAL_PAGES - start) * (i + 1)) / k.days) : null);
  }
  const status = p.behind > 0 ? `متأخر عن الخطة بـ ${ar(p.behind)} صفحة` : 'على الخطة أو أسبق، بارك الله فيك';
  return h('section.card.pc-card',
    h('div.pc-head', h('h3', k.type === 'listen' ? 'تقدّم ختمة الاستماع' : 'تقدّم الختمة'), h('strong.pc-big', `${ar(Math.round(p.percent * 100))}٪`)),
    h('p.pc-sub', `${ar(k.donePage)} من ${ar(K.TOTAL_PAGES)} صفحة · ${status}`),
    legend([['actual', 'ما قرأته'], ['plan', 'الخطة']]),
    lineChart({ series: [{ key: 'plan', label: 'الخطة', values: planned, dashed: true }, { key: 'actual', label: 'ما قرأته', values: actual, area: true }], labels, yMax: K.TOTAL_PAGES, yTicks: [0, 200, 400, 604], ariaLabel: 'تقدّم الختمة بالصفحات يومًا بيوم', unit: 'صفحة' }),
    table(['اليوم', 'ما قرأته', 'الخطة'], labels.map((l, i) => [l, actual[i] == null ? '—' : ar(actual[i]), planned[i] == null ? '—' : ar(planned[i])]).filter((r, i) => actual[i] != null)));
}

/** المحفوظ: نمو عدد الآيات أسبوعيًا (١٢ أسبوعًا) وقوة الحفظ */
export async function memorizeProgress() {
  const items = await srs.all().catch(() => []);
  if (!items.length) return h('section.card.pc-card', h('h3', 'الحفظ'), h('p.muted', 'لم تضف آيات للحفظ بعد.'), h('a.btn.ghost', { href: '#/memorize' }, 'ابدأ الحفظ'));
  const WEEKS = 12, now = Date.now();
  const labels = [], values = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const end = now - w * 7 * DAY;
    labels.push(fmtDay.format(new Date(end)));
    values.push(items.filter((x) => (x.addedAt || 0) <= end).length);
  }
  const strong = items.filter((x) => x.interval >= 21).length;
  const mid = items.filter((x) => x.interval >= 7 && x.interval < 21).length;
  const fresh = items.length - strong - mid;
  const due = items.filter((x) => x.due <= now).length;
  const seg = (key, n, label) => (n ? h('span', { class: `pc-seg ${key}`, style: { flexGrow: n }, tabindex: 0, title: `${label}: ${ar(n)} آية`, 'aria-label': `${label}: ${ar(n)} آية` }) : null);
  return h('section.card.pc-card',
    h('div.pc-head', h('h3', 'الآيات المحفوظة'), h('strong.pc-big', ar(items.length))),
    h('p.pc-sub', due ? `${ar(due)} آية للمراجعة اليوم` : 'لا مراجعات مستحقة اليوم'),
    lineChart({ series: [{ key: 'actual', label: 'آيات في محفوظاتك', values, area: true }], labels, yMax: niceMax(Math.max(...values)), yTicks: [0, Math.round(niceMax(Math.max(...values)) / 2), niceMax(Math.max(...values))], ariaLabel: 'عدد الآيات المحفوظة خلال ١٢ أسبوعًا', unit: 'آية' }),
    h('div.pc-strength', { role: 'img', 'aria-label': `قوة الحفظ: ${ar(strong)} راسخة، ${ar(mid)} قيد التثبيت، ${ar(fresh)} جديدة` },
      seg('s3', strong, 'راسخة'), seg('s2', mid, 'قيد التثبيت'), seg('s1', fresh, 'جديدة')),
    legend([['s3', `راسخة ${ar(strong)}`], ['s2', `قيد التثبيت ${ar(mid)}`], ['s1', `جديدة ${ar(fresh)}`]]),
    table(['الأسبوع المنتهي في', 'الآيات'], labels.map((l, i) => [l, ar(values[i])])));
}

// شارات المداومة بالترتيب (من badges.js) لعرض «الشارة القادمة»
const STREAK_GOALS = [[3, 'بداية طيبة'], [7, 'أسبوع كامل'], [30, 'شهر من المداومة']];

/** المداومة: آخر ٢٨ يومًا خريطةً، والأيام الباقية على الشارة القادمة */
export function streakProgress() {
  const days = lastDays(28);
  const s = streak();
  const level = (d) => { const v = d.pages + d.minutes / 5; return v === 0 ? 0 : v < 3 ? 1 : v < 10 ? 2 : 3; };
  const goal = STREAK_GOALS.find(([n]) => n > s);
  const tip = tooltip();
  const grid = h('div.pc-heat', { role: 'list', 'aria-label': 'نشاطك في آخر ٢٨ يومًا' }, days.map((d) => {
    const text = `${fmtDay.format(d.date)}: ${d.pages || d.minutes ? `${ar(d.pages)} صفحة، ${ar(d.minutes)} دقيقة` : 'بلا نشاط'}`;
    const cell = h('span', { class: `pc-cell l${level(d)}`, role: 'listitem', tabindex: 0, 'aria-label': text });
    const on = () => { const r = cell.getBoundingClientRect(), g = grid.getBoundingClientRect(); tip.show(r.left - g.left + r.width / 2, [[text, '', null]]); };
    cell.addEventListener('pointerenter', on); cell.addEventListener('focus', on);
    cell.addEventListener('pointerleave', tip.hide); cell.addEventListener('blur', tip.hide);
    return cell;
  }));
  return h('section.card.pc-card',
    h('div.pc-head', h('h3', 'المداومة'), h('strong.pc-big', ar(s))),
    h('p.pc-sub', goal ? `${ar(goal[0] - s)} ${goal[0] - s === 1 ? 'يوم' : goal[0] - s <= 10 ? 'أيام' : 'يومًا'} على شارة «${goal[1]}»` : 'أتممت كل شارات المداومة، ثبّتك الله'),
    goal ? h('div.pc-goal', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal[0], 'aria-valuenow': s }, h('span', { style: { width: `${Math.round((s / goal[0]) * 100)}%` } })) : null,
    h('div.pc-chart', grid, tip.el),
    legend([['l0', 'لا شيء'], ['l1', 'قليل'], ['l2', 'متوسط'], ['l3', 'كثير']]));
}
