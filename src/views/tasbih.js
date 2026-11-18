// السبحة: عدّاد تسبيح بضغطة على المساحة الكبيرة، مع أذكار جاهزة وهدف لكل ذكر
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';
import { recordTasbih, lastDays } from '../features/activity.js';

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

const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* */ } };

export function renderTasbih() {
  const saved = settings.get('tasbih') || {};
  let cur = DHIKR.find((d) => d.id === saved.id) || DHIKR[0];
  let count = saved.id === cur.id ? saved.count || 0 : 0;

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
  };
  const tap = () => {
    count++;
    recordTasbih(1);
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
  ));
  draw();
  return { cleanup() { removeEventListener('keydown', onKey); } };
}
