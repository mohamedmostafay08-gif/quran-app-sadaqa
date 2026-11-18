// حاسبة الزكاة: المال والذهب والفضة وعروض التجارة، بنصاب الذهب (٨٥ جرامًا عيار ٢٤) أو الفضة (٥٩٥ جرامًا)
// الأسعار يكتبها المستخدم بعملته، وتُحفظ على جهازه فقط
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar } from '../ui.js';

const GOLD_NISAB = 85, SILVER_NISAB = 595, RATE = 0.025;
const FIELDS = [
  ['cash', 'النقود والمدخرات', 'في البيت والبنك والمحافظ'],
  ['trade', 'عروض التجارة', 'قيمة البضاعة المعدّة للبيع بسعر اليوم'],
  ['loans', 'ديون لك مرجوّة السداد', 'أموال أقرضتها لمن يُتوقع أن يردّها'],
  ['debts', 'ديون عليك حالّة', 'تُخصم من المال (المستحقة الآن فقط)'],
];
const GOLD = [['g24', 'ذهب عيار ٢٤', 24], ['g21', 'ذهب عيار ٢١', 21], ['g18', 'ذهب عيار ١٨', 18]];
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

export function renderZakat() {
  const v = { cur: 'جنيه', basis: 'gold', ...(settings.get('zakat') || {}) };
  const inputs = {};
  const out = h('section.card.zk-result', { 'aria-live': 'polite' });
  const num = (k) => Math.max(0, parseFloat(String(inputs[k]?.value || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.')) || 0);
  const field = (k, label, hint, unit) => {
    inputs[k] = h('input.note-input', { type: 'text', inputmode: 'decimal', value: v[k] ? String(v[k]) : '', placeholder: '٠', 'aria-label': label, oninput: calc });
    return h('label.zk-field', h('span.zk-l', h('strong', label), hint ? h('small', hint) : null), h('span.zk-in', inputs[k], unit === 'cur' ? h('small.zk-cur-u', v.cur) : h('small', unit)));
  };
  const curIn = h('input.note-input.zk-cur', { type: 'text', value: v.cur, maxlength: '12', 'aria-label': 'العملة', oninput: calc });
  const basis = h('div.seg', { role: 'radiogroup', 'aria-label': 'النصاب' }, [['gold', 'بنصاب الذهب'], ['silver', 'بنصاب الفضة']].map(([id, name]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v.basis === id), onclick: (e) => { v.basis = id; for (const b of basis.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); calc(); },
  }, name)));

  function calc() {
    const cur = curIn.value.trim() || 'جنيه';
    for (const e of document.querySelectorAll('.zk-cur-u')) e.textContent = cur;
    const gp = num('goldPrice'), sp = num('silverPrice');
    const gold24 = GOLD.reduce((s, [k, , kt]) => s + (num(k) * kt) / 24, 0);
    const goldVal = gold24 * gp, silverVal = num('silver') * sp;
    const total = num('cash') + num('trade') + num('loans') + goldVal + silverVal - num('debts');
    const nisab = v.basis === 'gold' ? GOLD_NISAB * gp : SILVER_NISAB * sp;
    const save = { cur, basis: v.basis };
    for (const k of Object.keys(inputs)) if (num(k)) save[k] = num(k);
    settings.set('zakat', save);
    const needPrice = v.basis === 'gold' ? !gp : !sp;
    const needItemPrice = (gold24 && !gp) || (num('silver') && !sp);
    if (needPrice || needItemPrice) {
      out.replaceChildren(h('p.muted', `اكتب سعر جرام ${needPrice ? (v.basis === 'gold' ? 'الذهب عيار ٢٤' : 'الفضة') : gold24 && !gp ? 'الذهب عيار ٢٤' : 'الفضة'} اليوم لنحسب النصاب.`));
      return;
    }
    const due = total >= nisab && total > 0;
    out.replaceChildren(
      h('div.zk-row', h('span', 'مجموع ما تملك'), h('strong', `${fmt(Math.max(0, total))} ${cur}`)),
      h('div.zk-row', h('span', `النصاب (${v.basis === 'gold' ? `${ar(GOLD_NISAB)} جرامًا ذهبًا` : `${ar(SILVER_NISAB)} جرامًا فضة`})`), h('strong', `${fmt(nisab)} ${cur}`)),
      due ? h('div.zk-due', h('small', 'الزكاة الواجبة (٢٫٥٪)'), h('strong', `${fmt(total * RATE)} ${cur}`))
        : h('div.zk-due.none', h('strong', total > 0 ? 'لم يبلغ مالك النصاب، فلا زكاة فيه' : 'اكتب أموالك لتُحسب الزكاة')),
      due ? h('p.small-note', 'تجب إذا بقي المال فوق النصاب سنة هجرية كاملة.') : null);
  }

  mount(h('div.zakat-page',
    topbar({ title: 'حاسبة الزكاة', back: '#/' }),
    h('section.card.form',
      h('h2', 'الأسعار اليوم'),
      h('div.zk-two', field('goldPrice', 'جرام الذهب عيار ٢٤', null, 'cur'), field('silverPrice', 'جرام الفضة', null, 'cur')),
      h('label.zk-field', h('span.zk-l', h('strong', 'العملة')), curIn),
      basis),
    h('section.card.form', h('h2', 'المال'), ...FIELDS.map(([k, l, hint]) => field(k, l, hint, 'cur'))),
    h('section.card.form', h('h2', 'الذهب والفضة'),
      ...GOLD.map(([k, l]) => field(k, l, null, 'جرام')),
      field('silver', 'الفضة', null, 'جرام'),
      h('p.small-note', 'حُليّ الزينة المستعملة فيها خلاف بين العلماء؛ أدخِلها احتياطًا أو اسأل من تثق بعلمه.')),
    out,
    h('p.small-note', 'تُحفظ الأرقام على جهازك فقط.'),
  ));
  calc();
}
