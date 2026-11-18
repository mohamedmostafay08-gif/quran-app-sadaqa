// قضاء الفوائت: تُدخل عدد الصلوات والأيام الفائتة، وتسجّل ما تقضيه يومًا بيوم حتى تنتهي (على الجهاز فقط)
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';

const ITEMS = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء'], ['fast', 'أيام الصيام']];
const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));

export function renderQada() {
  const q = settings.get('qada');
  mount(h('div.qada-page', topbar({ title: 'قضاء الفوائت', back: '#/prayer' }), q ? tracker(q) : setup()));
}

function setup(prev) {
  const inputs = {};
  const num = (k, label) => {
    inputs[k] = h('input.note-input', { type: 'number', min: '0', max: '100000', inputmode: 'numeric', value: String(prev?.total?.[k] || ''), placeholder: '٠', 'aria-label': label });
    return h('label.qd-field', h('span', label), inputs[k]);
  };
  const days = h('input.note-input', { type: 'number', min: '0', inputmode: 'numeric', placeholder: 'مثلًا ٣٠', 'aria-label': 'عدد الأيام' });
  return h('div',
    h('section.card.form',
      h('h2', 'كم يومًا فاتتك صلواته؟'),
      h('p.muted', 'اكتب عدد الأيام فتُملأ الصلوات الخمس تلقائيًا، أو اكتب عدد كل صلاة وحدها.'),
      h('div.qd-days', days, h('button.btn', { type: 'button', onclick: () => { const n = Math.max(0, parseInt(days.value, 10) || 0); for (const [k] of ITEMS.slice(0, 5)) inputs[k].value = String(n); } }, 'املأ'))),
    h('section.card.form', h('h2', 'الصلوات'), h('div.qd-grid', ITEMS.slice(0, 5).map(([k, l]) => num(k, l)))),
    h('section.card.form', h('h2', 'الصيام'), h('div.qd-grid', num('fast', 'أيام الصيام'))),
    h('button.btn.block', { type: 'button', onclick: async () => {
      const total = Object.fromEntries(ITEMS.map(([k]) => [k, Math.max(0, Math.min(100000, parseInt(inputs[k].value, 10) || 0))]));
      if (!Object.values(total).some(Boolean)) { toast('اكتب عددًا واحدًا على الأقل'); return; }
      const left = prev ? Object.fromEntries(ITEMS.map(([k]) => [k, Math.max(0, total[k] - ((prev.total?.[k] || 0) - (prev.left?.[k] || 0)))])) : { ...total };
      await settings.set('qada', { total, left, startedAt: prev?.startedAt || Date.now() });
      rerender();
    } }, icon('check'), 'حفظ'));
}

function tracker(q) {
  const sum = (o) => ITEMS.reduce((n, [k]) => n + (o[k] || 0), 0);
  const total = sum(q.total), left = sum(q.left);
  const pct = total ? Math.round(((total - left) / total) * 100) : 0;
  const step = async (k, d) => {
    const nq = { ...q, left: { ...q.left, [k]: Math.min(q.total[k], Math.max(0, (q.left[k] || 0) + d)) } };
    await settings.set('qada', nq);
    if (d < 0 && nq.left[k] === 0) toast('أتممت قضاءها كلها، تقبّل الله');
    rerender();
  };
  return h('div',
    h('section.card.qd-hero', h('strong', `${ar(pct)}٪`), h('span', left ? `باقٍ ${ar(left)} من ${ar(total)}` : 'أتممت القضاء كله، تقبّل الله'), h('div.bar', h('span', { style: { width: `${pct}%` } }))),
    h('ul.qd-list', ITEMS.filter(([k]) => q.total[k]).map(([k, label]) => h('li.card.qd-row',
      h('span.qd-name', h('strong', label), h('small', `باقٍ ${ar(q.left[k] || 0)} من ${ar(q.total[k])}`)),
      h('div.qd-btns',
        h('button.icon-btn', { type: 'button', 'aria-label': 'تراجع', onclick: () => step(k, 1), disabled: (q.left[k] || 0) >= q.total[k] }, icon('repeat')),
        h('button.btn', { type: 'button', onclick: () => step(k, -1), disabled: !(q.left[k] || 0) }, icon('check'), k === 'fast' ? 'قضيت يومًا' : 'قضيت واحدة'))))),
    h('div.btn-row',
      h('button.btn.ghost', { type: 'button', onclick: () => mount(h('div.qada-page', topbar({ title: 'تعديل الأعداد', back: '#/qada' }), setup(q))) }, 'تعديل الأعداد'),
      h('button.btn.ghost.danger', { type: 'button', onclick: async () => { if (confirm('حذف بيانات القضاء؟')) { await settings.set('qada', null); rerender(); } } }, 'حذف')),
    h('p.small-note', 'تُحفظ على جهازك فقط.'));
}
