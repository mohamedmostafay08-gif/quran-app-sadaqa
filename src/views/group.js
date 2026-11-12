// شاشات الختمة الجماعية والمُهداة
import { h, icon, ar } from '../lib/dom.js';
import * as G from '../features/group.js';
import * as settings from '../state.js';
import { juzStart, pageOf } from '../data.js';
import { mount, topbar, toast, sheet, empty } from '../ui.js';
import { navigate } from '../router.js';

// ---------- القائمة + الإنشاء ----------
export function renderGroups() {
  let kind = 'group';
  const title = h('input.note-input', { type: 'text', maxlength: '120', placeholder: 'مثال: ختمة العائلة في رمضان', 'aria-label': 'اسم الختمة', id: 'g-title' });
  const ded = h('input.note-input', { type: 'text', maxlength: '200', placeholder: 'مثال: صدقة جارية عن روح جدي محمد، رحمه الله', 'aria-label': 'الإهداء', id: 'g-ded' });
  const dedField = h('label.field', { hidden: true }, h('span', 'الإهداء'), ded);
  const seg = h('div.seg', { role: 'radiogroup' }, [['group', 'ختمة جماعية'], ['dedicated', 'ختمة مُهداة']].map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === kind),
    onclick: (e) => {
      kind = v;
      for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      dedField.hidden = v !== 'dedicated';
      title.placeholder = v === 'dedicated' ? 'مثال: ختمة لروح الوالدة' : 'مثال: ختمة العائلة في رمضان';
    },
  }, label)));
  const createBtn = h('button.btn.block', { type: 'button', onclick: async () => {
    if (!title.value.trim()) { title.focus(); return toast('اكتب اسمًا للختمة'); }
    if (kind === 'dedicated' && !ded.value.trim()) { ded.focus(); return toast('اكتب لمن تُهدى الختمة'); }
    createBtn.disabled = true;
    try {
      const id = await G.createGroup({ title: title.value.trim(), dedication: kind === 'dedicated' ? ded.value.trim() : '', kind });
      navigate(`/group/${id}?new=1`);
    } catch (e) { toast(e.message); createBtn.disabled = false; }
  } }, icon('check'), 'أنشئ الختمة واحصل على الرابط');

  const mine = G.myGroups();
  mount(h('div.groups',
    topbar({ title: 'الختمة الجماعية', back: '#/quran' }),
    h('section.card.g-intro',
      h('h2', 'اقرأوا القرآن معًا'),
      h('p', 'أنشئ ختمة وشارك رابطها مع العائلة أو الأصدقاء. كل واحد يختار جزءًا أو أكثر من الثلاثين، ويعلّمه «تم» بعد قراءته. لما تكتمل الأجزاء تبدأ دورة جديدة تلقائيًا.'),
      h('p.small-note', 'بدون حسابات: يُحفظ فقط اسم الختمة والإهداء والاسم الذي يكتبه كل مشارك (اختياري).'),
    ),
    h('section.card',
      h('h2', 'ختمة جديدة'),
      h('div.form', h('div.field', h('span', 'النوع'), seg), h('label.field', h('span', 'اسم الختمة'), title), dedField, createBtn),
    ),
    mine.length ? h('section.card',
      h('h2', 'ختماتي'),
      h('ul.choice-list', mine.map((g) => h('li', h('a.choice', { href: `#/group/${g.id}` },
        h('span', h('strong', g.title), h('small', `${g.kind === 'dedicated' ? 'مُهداة' : 'جماعية'}${g.admin ? '، أنشأتها أنت' : ''}`)), icon('forward'))))),
    ) : null,
  ));
}

// ---------- صفحة الختمة ----------
export async function renderGroup(params, query, isStale) {
  const id = params.id;
  const shell = h('div.group');
  mount(h('div', topbar({ title: 'الختمة الجماعية', back: '#/group' }), shell));
  shell.append(h('p.muted', 'جارٍ التحميل…'));
  let g;
  try { g = await G.getGroup(id); } catch (e) {
    if (isStale()) return;
    shell.replaceChildren(empty('wifiOff', 'تعذر فتح الختمة', e.message, h('button.btn', { type: 'button', onclick: () => dispatchEvent(new HashChangeEvent('hashchange')) }, 'إعادة المحاولة')));
    return;
  }
  if (isStale()) return;

  const draw = () => {
    const parts = new Map(g.parts.map((p) => [p.n, p]));
    const done = g.parts.filter((p) => p.status === 'done').length;
    const taken = g.parts.length;
    const grid = h('ol.g-grid', Array.from({ length: 30 }, (_, i) => {
      const n = i + 1, p = parts.get(n);
      const cls = !p ? 'free' : p.status === 'done' ? 'done' : 'taken';
      return h('li', h('button', {
        type: 'button', class: `g-part ${cls}${p?.mine ? ' mine' : ''}`,
        'aria-label': `الجزء ${n}: ${!p ? 'متاح' : p.status === 'done' ? 'تمت قراءته' : `مع ${p.name || 'مشارك'}`}`,
        onclick: () => partSheet(n, p),
      }, h('strong', ar(n)), h('small', !p ? 'متاح' : p.status === 'done' ? '✓ تم' : (p.mine ? 'معك' : (p.name || 'محجوز')))));
    }));
    shell.replaceChildren(...[
      g.kind === 'dedicated' && g.dedication ? h('section.g-dedication', h('span.hero-mark', { 'aria-hidden': 'true' }, '۞'), h('p', g.dedication), h('small', 'اللهم تقبّلها منّا، واجعل ثوابها كما نوينا')) : null,
      h('section.card.g-head',
        h('div', h('h1', g.title), h('p.muted', `الدورة ${ar(g.round)}${g.completed_rounds ? `، اكتمل ${ar(g.completed_rounds)} ختمة` : ''}`)),
        h('div.ring', { style: { '--p': done / 30 }, role: 'img', 'aria-label': `تم ${done} من 30 جزءًا` }, h('span', `${ar(done)}/${ar(30)}`)),
      ),
      query.new ? h('section.card.g-new', h('strong', 'تم إنشاء الختمة. شارك الرابط مع من تحب:'), shareRow()) : null,
      h('p.g-legend', h('span.dot.free'), 'متاح ', h('span.dot.taken'), 'محجوز ', h('span.dot.done'), 'تم ', h('span.g-count', `${ar(taken)} من ٣٠ محجوز`)),
      grid,
      query.new ? null : shareRow(),
      G.isAdmin(id) ? h('button.btn.ghost.danger.block', { type: 'button', onclick: () => sheet({ title: 'حذف الختمة؟', content: (close) => h('div',
        h('p', 'ستُحذف الختمة وكل الأجزاء المسجلة لكل المشاركين.'),
        h('div.btn-row', h('button.btn.danger', { type: 'button', onclick: async () => { try { await G.deleteGroup(id); close(); toast('تم الحذف'); navigate('/group', { replace: true }); } catch (e) { toast(e.message); } } }, icon('trash'), 'حذف'),
          h('button.btn.ghost', { type: 'button', onclick: () => close() }, 'تراجع'))) }) }, icon('trash'), 'حذف الختمة') : null,
    ].filter(Boolean));
  };

  const shareRow = () => {
    const url = G.shareUrl(id);
    const text = g.kind === 'dedicated' ? `شاركني ختمة القرآن المُهداة: ${g.dedication}\n${url}` : `شاركني ختمة «${g.title}» — اختر جزءًا واقرأه:\n${url}`;
    return h('div.g-share',
      h('input.note-input', { type: 'text', readonly: true, value: url, 'aria-label': 'رابط الختمة', onfocus: (e) => e.target.select() }),
      h('div.btn-row',
        navigator.share ? h('button.btn', { type: 'button', onclick: () => navigator.share({ text }).catch(() => {}) }, icon('share'), 'مشاركة') : null,
        h('button.btn.ghost', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } catch { toast('انسخ الرابط من الخانة'); } } }, icon('copy'), 'نسخ الرابط'),
      ),
    );
  };

  const run = async (fn) => {
    try { g = await fn(); draw(); } catch (e) { toast(e.message); g = await G.getGroup(id).catch(() => g); draw(); }
  };

  function partSheet(n, p) {
    const start = juzStart(n);
    const readLink = h('a.btn.ghost', { href: settings.get('readMode') === 'pages' ? `#/page/${pageOf(start.surah, start.ayah)}` : `#/surah/${start.surah}/${start.ayah}` }, icon('book'), 'اقرأ الجزء');
    if (!p) {
      const name = h('input.note-input', { type: 'text', maxlength: '40', placeholder: 'اسمك (اختياري)', value: settings.get('groupName') || '', 'aria-label': 'اسمك' });
      return sheet({ title: `الجزء ${ar(n)}`, content: (close) => h('div.form',
        h('p', 'خذ هذا الجزء لتقرأه، وعلّمه «تم» بعد الانتهاء.'),
        name,
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: () => { settings.set('groupName', name.value.trim()); close(); run(() => G.takePart(id, n, name.value.trim())).then(() => toast(`الجزء ${ar(n)} معك الآن`)); } }, icon('check'), 'خذ الجزء'),
          readLink),
      ) });
    }
    if (p.mine && p.status === 'taken') {
      return sheet({ title: `الجزء ${ar(n)} — معك`, content: (close) => h('div.form',
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: () => { close(); run(() => G.donePart(id, n)).then(() => toast('تقبّل الله منك')); } }, icon('check'), 'أتممت القراءة'),
          readLink),
        h('button.btn.ghost.danger.block', { type: 'button', onclick: () => { close(); run(() => G.releasePart(id, n)); } }, 'ترك الجزء لغيري'),
      ) });
    }
    sheet({ title: `الجزء ${ar(n)}`, content: () => h('div.form',
      h('p', p.status === 'done' ? `قرأه ${p.name || 'أحد المشاركين'}. تقبّل الله.` : `محجوز مع ${p.name || 'أحد المشاركين'}.`),
      readLink) });
  }

  draw();
  // تحديث دوري لمتابعة المشاركين
  const timer = setInterval(async () => { try { g = await G.getGroup(id); if (!document.querySelector('.sheet.open')) draw(); } catch { /* */ } }, 20000);
  return { cleanup: () => clearInterval(timer) };
}
