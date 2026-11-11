// الختمة والورد اليومي
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta } from '../data.js';
import * as K from '../features/khatma.js';
import { player } from '../audio/player.js';
import { mount, topbar, toast, sheet } from '../ui.js';
import { navigate } from '../router.js';

const PRESETS = [
  { days: 7, label: 'أسبوع' },
  { days: 10, label: '١٠ أيام' },
  { days: 15, label: '١٥ يومًا' },
  { days: 30, label: 'شهر' },
  { days: 60, label: 'شهران' },
  { days: 90, label: '٣ أشهر' },
  { days: 180, label: '٦ أشهر' },
  { days: 365, label: 'سنة' },
];

export const posLabel = ({ surah, ayah }) => `سورة ${getSurahMeta(surah).nameAr} ${ar(ayah)}`;

export async function renderKhatma(_p, _q, isStale) {
  const [read, listen, past] = await Promise.all([K.getActive('read'), K.getActive('listen'), K.history()]);
  if (isStale()) return;

  const body = h('div');
  for (const k of [read, listen].filter(Boolean)) body.append(khatmaCard(k));
  body.append(newKhatmaCard(read, listen));
  if (past.length) {
    body.append(h('h2.section-title', 'ختمات مكتملة'), h('ul.past-list', past.map((k) => h('li',
      h('strong', k.type === 'listen' ? 'ختمة استماع' : 'ختمة قراءة'),
      h('span.muted', `، ${ar(Math.max(1, Math.round((k.finishedAt - k.startDate) / 86400000)))} يومًا، انتهت ${new Date(k.finishedAt).toLocaleDateString('ar-EG')}`),
    ))));
  }
  body.append(h('a.quick', { href: '#/group' }, icon('user'), h('span', h('strong', 'ختمة جماعية أو مُهداة'), h('small', 'شارك رابطًا، وكل واحد يختار جزءًا'))));
  mount(h('div.khatma', topbar({ title: 'الختمة والورد', back: '#/' }), body));

}

function khatmaCard(k) {
  const p = K.plan(k);
  const range = K.rangeForPages(p.fromPage, Math.max(p.fromPage, p.toPage));
  const isListen = k.type === 'listen';
  const streak = K.streak(k);
  const pageInput = h('input.page-input', { type: 'number', min: String(k.donePage + 1), max: '604', inputmode: 'numeric', 'aria-label': 'وصلت حتى صفحة', placeholder: ar(p.toPage) });

  const start = () => {
    if (isListen) {
      player.playFrom(range.from.surah, range.from.ayah, { range: { from: range.from, to: range.to, khatmaId: k.id, toPage: p.toPage } });
      toast(`يبدأ الاستماع من ${posLabel(range.from)}`);
    } else {
      navigate(`/surah/${range.from.surah}/${range.from.ayah}`);
    }
  };

  return h('section.card.khatma-card',
    h('div.kc-head',
      h('div', h('span.eyebrow', isListen ? 'ختمة استماع' : 'ختمة قراءة'), h('h2', p.doneToday ? 'أتممت ورد اليوم ✓' : 'ورد اليوم')),
      h('div.ring', { style: { '--p': p.percent }, role: 'img', 'aria-label': `أُنجز ${Math.round(p.percent * 100)}٪` }, h('span', `${ar(Math.round(p.percent * 100))}٪`)),
    ),
    p.doneToday
      ? h('p.muted', `قرأت اليوم ${ar(p.readToday)} صفحة. ورد الغد يبدأ من صفحة ${ar(p.fromPage)}.`)
      : h('div.wird',
        h('div.wird-range',
          h('div', h('small', 'من'), h('strong', posLabel(range.from)), h('span.muted', `صفحة ${ar(p.fromPage)}`)),
          h('div.wird-arrow', icon('forward')),
          h('div', h('small', 'إلى'), h('strong', posLabel(range.to)), h('span.muted', `صفحة ${ar(p.toPage)}`)),
        ),
        h('p.muted', `${ar(p.leftToday)} صفحة اليوم، باقي ${ar(p.daysLeft)} يوم و${ar(p.remainingPages)} صفحة`),
        p.behind > 0 && p.dayIndex > 1 ? h('p.notice', `فاتك جزء من الخطة، فتم توزيع ${ar(p.behind)} صفحة على الأيام الباقية تلقائيًا.`) : null,
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: start }, icon(isListen ? 'play' : 'book'), isListen ? 'استمع لورد اليوم' : 'اقرأ ورد اليوم'),
          h('button.btn.ghost', { type: 'button', onclick: async () => { await K.markUntil(k, p.toPage); toast('بارك الله فيك! تم تسجيل الورد'); refresh(); } }, icon('check'), 'أتممت الورد'),
        ),
      ),
    h('details.kc-more',
      h('summary', 'تسجيل تقدم جزئي وتفاصيل'),
      h('div.inline-form',
        h('label', 'وصلت حتى صفحة ', pageInput),
        h('button.btn.ghost', { type: 'button', onclick: async () => {
          const v = parseInt(pageInput.value, 10);
          if (!v || v <= k.donePage || v > 604) return toast('أدخل رقم صفحة صحيحًا');
          await K.markUntil(k, v); toast('تم التسجيل'); refresh();
        } }, 'سجّل'),
      ),
      h('ul.stats',
        h('li', h('strong', ar(k.donePage)), h('span', 'صفحة منجزة')),
        h('li', h('strong', ar(streak)), h('span', 'أيام متتالية')),
        h('li', h('strong', `${ar(p.dayIndex)}/${ar(k.days)}`), h('span', 'اليوم')),
      ),
      h('button.btn.ghost.danger', { type: 'button', onclick: () => sheet({ title: 'إلغاء الختمة؟', content: (close) => h('div',
        h('p', 'سيُحذف التقدم المسجل لهذه الختمة.'),
        h('div.btn-row', h('button.btn.danger', { type: 'button', onclick: async () => { await K.remove(k.id); close(); refresh(); } }, 'إلغاء الختمة'), h('button.btn.ghost', { type: 'button', onclick: close }, 'تراجع'))) }) }, icon('trash'), 'إلغاء الختمة'),
    ),
  );
}

function newKhatmaCard(read, listen) {
  if (read && listen) return h('span');
  let type = read ? 'listen' : 'read';
  let days = 30;
  const preview = h('p.muted');
  const update = () => { preview.textContent = `≈ ${ar(Math.ceil(604 / days))} صفحة يوميًا (${ar(Math.round(604 / days / 20 * 10) / 10)} جزء)`; };
  const seg = (opts, getV, setV) => h('div.seg', { role: 'radiogroup' }, opts.map(([v, label, disabled]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(getV() === v), disabled: !!disabled,
    onclick: (e) => { setV(v); for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); update(); },
  }, label)));
  const ramadan = K.daysUntilRamadanEnd();
  const chips = h('div.chip-grid', [...PRESETS, { days: ramadan, label: 'رمضان' }].map((pr) => h('button.chip', {
    type: 'button', 'aria-pressed': String(pr.days === days && pr.label !== 'رمضان'),
    onclick: (e) => { days = pr.days; for (const b of chips.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); update(); },
  }, pr.label)));
  update();
  return h('section.card',
    h('h2', read || listen ? 'ختمة جديدة' : 'ابدأ ختمة'),
    h('div.form',
      h('div.field', h('span', 'نوع الختمة'), seg([['read', 'قراءة', !!read], ['listen', 'استماع', !!listen]], () => type, (v) => { type = v; })),
      h('div.field', h('span', 'المدة'), chips),
      preview,
      h('button.btn', { type: 'button', onclick: async () => { await K.create({ type, days }); toast('بدأت الختمة، وفقك الله'); refresh(); } }, icon('check'), 'ابدأ الختمة'),
    ),
  );
}

const refresh = () => dispatchEvent(new HashChangeEvent('hashchange'));

/** بطاقة صغيرة للرئيسية */
export async function homeWirdCard() {
  const k = (await K.getActive('read')) || (await K.getActive('listen'));
  if (!k) {
    return h('a.quick', { href: '#/khatma' }, icon('book'), h('span', h('strong', 'ابدأ ختمة'), h('small', 'ورد يومي يتعدّل تلقائيًا')));
  }
  const p = K.plan(k);
  return h('a.quick', { href: '#/khatma' }, h('div.ring.sm', { style: { '--p': p.percent }, 'aria-hidden': 'true' }),
    h('span', h('strong', p.doneToday ? 'أتممت ورد اليوم ✓' : `ورد اليوم: ${ar(p.leftToday)} صفحة`), h('small', `من صفحة ${ar(p.fromPage)}، ${k.type === 'listen' ? 'استماع' : 'قراءة'}`)));
}

/** تسجيل ورد الاستماع تلقائيًا عند اكتمال تشغيل النطاق (من أي شاشة) */
export function initKhatmaAutoRecord() {
  player.subscribe(async (st) => {
    const c = st.completed;
    if (!c || !c.khatmaId || c.recorded) return;
    c.recorded = true;
    const k = await K.getActive('listen');
    if (!k || k.id !== c.khatmaId) return;
    await K.markUntil(k, c.toPage);
    toast('أحسنت! تم تسجيل ورد الاستماع');
    if (location.hash.startsWith('#/khatma')) refresh();
  });
}
