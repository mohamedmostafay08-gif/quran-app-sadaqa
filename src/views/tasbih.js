// السبحة: عدّاد تسبيح بضغطة على المساحة الكبيرة، مع أذكار جاهزة وهدف لكل ذكر
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';
import { recordTasbih, lastDays, dayKey } from '../features/activity.js';

export const DHIKR = [
  { id: 'subhan', text: 'سُبْحَانَ اللَّهِ', goal: 33 },
  { id: 'hamd', text: 'الْحَمْدُ لِلَّهِ', goal: 33 },
  { id: 'akbar', text: 'اللَّهُ أَكْبَرُ', goal: 34 },
  { id: 'tahlil', text: 'لَا إِلَهَ إِلَّا اللَّهُ', goal: 100 },
  { id: 'istighfar', text: 'أَسْتَغْفِرُ اللَّهَ', goal: 100 },
  { id: 'salat', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', goal: 100 },
  { id: 'hawqala', text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', goal: 100 },
  { id: 'bihamdihi', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', goal: 100 },
];

// ورد يومي: الاستغفار والصلاة على النبي ﷺ
export const WIRD = [['istighfar', 'الاستغفار'], ['salat', 'الصلاة على النبي ﷺ']];
export const wirdToday = () => (settings.get('dhikrLog') || {})[dayKey()] || {};
function addWird(id) {
  const log = { ...(settings.get('dhikrLog') || {}) };
  const k = dayKey();
  log[k] = { ...(log[k] || {}), [id]: ((log[k] || {})[id] || 0) + 1 };
  for (const d of Object.keys(log).sort().slice(0, -60)) delete log[d]; // آخر ٦٠ يومًا
  settings.set('dhikrLog', log);
  return log[k][id];
}
/** بطاقة صغيرة بتقدّم الورد اليوم */
export function wirdCard() {
  const goals = settings.get('dhikrWird') || {};
  const t = wirdToday();
  const rows = WIRD.filter(([id]) => goals[id] > 0);
  if (!rows.length) return null;
  return h('a.card.wird-card', { href: '#/tasbih?d=' + (rows.find(([id]) => (t[id] || 0) < goals[id]) || rows[0])[0] },
    h('strong', 'وردك اليوم'),
    ...rows.map(([id, name]) => {
      const n = Math.min(t[id] || 0, goals[id]);
      return h('div.wird-row', h('span', name), h('div.bar', h('span', { style: { width: `${Math.round((n / goals[id]) * 100)}%` } })), h('small', n >= goals[id] ? '✓' : `${ar(n)}/${ar(goals[id])}`));
    }));
}

const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* */ } };

export function renderTasbih(_p, query = {}) {
  const saved = settings.get('tasbih') || {};
  let cur = DHIKR.find((d) => d.id === (query.d || saved.id)) || DHIKR[0];
  let count = saved.id === cur.id ? saved.count || 0 : 0;
  const wirdBox = h('div.wird-slot');

  const num = h('strong.tb-count', { 'aria-live': 'polite' });
  const goal = h('small.tb-goal');
  const ring = h('div.tb-ring', { 'aria-hidden': 'true' });
  const text = h('p.tb-text', { lang: 'ar' });
  const todayEl = h('small.tb-today');
  const persist = () => settings.set('tasbih', { id: cur.id, count });
  const draw = () => {
    num.textContent = ar(count);
    goal.textContent = count >= cur.goal ? `أتممت ${ar(cur.goal)} ✓` : `من ${ar(cur.goal)}`;
    ring.style.setProperty('--p', Math.min(1, count / cur.goal));
    text.textContent = cur.text;
    todayEl.textContent = `اليوم: ${ar(lastDays(1)[0].tasbih)} تسبيحة`;
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.id === cur.id));
    wirdBox.replaceChildren(wirdCard() || '');
  };
  const tap = () => {
    count++;
    recordTasbih(1);
    const g = (settings.get('dhikrWird') || {})[cur.id];
    if (g > 0) { const n = addWird(cur.id); if (n === g) { buzz([60, 60, 120]); toast('أتممت وردك اليوم، تقبّل الله'); } }
    if (count === cur.goal) { buzz([60, 60, 120]); toast(`أتممت ${ar(cur.goal)}، بارك الله فيك`); } else buzz(12);
    persist(); draw();
  };
  const pad = h('button.tb-pad', { type: 'button', 'aria-label': 'تسبيحة', onclick: tap }, ring, h('span.tb-mid', num, goal));
  const chips = h('div.tb-chips', DHIKR.map((d) => h('button.pb-chip', { type: 'button', dataset: { id: d.id }, onclick: () => { cur = d; count = 0; persist(); draw(); } }, d.text.split('،')[0])));
  const onKey = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('button, input')) { e.preventDefault(); tap(); } };
  addEventListener('keydown', onKey);

  mount(h('div.tasbih-page',
    topbar({ title: 'السبحة', back: '#/' }),
    text,
    pad,
    h('div.tb-actions',
      h('button.btn.ghost', { type: 'button', onclick: () => { count = 0; persist(); draw(); } }, icon('repeat'), 'تصفير'),
      todayEl),
    h('h2.lib-h', 'اختر الذكر'),
    chips,
    wirdBox,
    h('section.card.wird-goals', h('h2', 'الورد اليومي'),
      ...WIRD.map(([id, name]) => h('div.field', h('span', name), h('div.seg', { role: 'radiogroup', 'aria-label': name }, [0, 100, 300, 1000].map((n) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(((settings.get('dhikrWird') || {})[id] || 0) === n),
        onclick: (e) => { settings.set('dhikrWird', { ...(settings.get('dhikrWird') || {}), [id]: n }); for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
      }, n ? ar(n) : 'بدون')))))),
  ));
  draw();
  return { cleanup() { removeEventListener('keydown', onKey); } };
}
