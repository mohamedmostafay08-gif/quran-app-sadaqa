// المكتبة: أحاديث صحيحة مختارة بشرحها، وفضائل الصحابة وقصصهم، وصحابي اليوم، ودليل الوضوء والصلاة
import { h, icon, ar } from '../lib/dom.js';
import { normalize } from '../lib/arabic.js';
import { mount, topbar, toast, sheet, empty } from '../ui.js';
import { navigate } from '../router.js';
import { track } from '../features/stats.js';

const BASE = new URL('../../public/data/library/', import.meta.url).href;
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, fetch(BASE + name + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { cache.delete(name); throw e; }));
  return cache.get(name);
};
const offlineEmpty = (title, back) => mount(h('div.library', topbar({ title, back }),
  h('section.card', empty('wifiOff', 'المكتبة تحتاج اتصالًا لأول مرة', 'بعد أول فتح تعمل بدون إنترنت، أو نزّلها كاملة من «التنزيلات».'))));

// صحابي اليوم: يتغيّر كل يوم بالتاريخ المحلي
export const dayIndex = (n) => {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)) % n;
};

const firstLine = (s) => (s || '').split('\n')[0].replace(/^الرواية الأولى:\s*/, '').replace(/^الحديث الأول:\s*/, '');
const byLabel = (x) => (x.agreed ? 'متفق عليه' : firstLine(x.by).replace(/\.$/, ''));
const badges = (x) => h('div.hd-badges',
  h('span', { class: `hd-badge${x.agreed ? ' agreed' : ''}` }, byLabel(x)),
  h('span.hd-badge.hd-grade', x.grade.split('\n')[0]));

// تمييز العدد: من ٣ إلى ١٠ جمع، ومن ١١ فما فوق مفرد منصوب
const countWord = (n, plural, singular) => `${ar(n)} ${n >= 3 && n <= 10 ? plural : singular}`;
const SECTIONS_ICON = { wudu: 'drop', nawaqid: 'info', shurut: 'check', salah: 'mosque', mubtilat: 'close' };

// ================= الصفحة الرئيسية للمكتبة =================
export async function renderLibrary() {
  track('library');
  let index, sahabi, fiqh;
  try { [index, sahabi, fiqh] = await Promise.all([load('index'), load('sahabi'), load('fiqh')]); } catch { return offlineEmpty('المكتبة', '#/'); }
  const today = sahabi[dayIndex(sahabi.length)];
  const hadithTopics = index.filter((t) => t.id !== 'sahaba' && t.id !== 'qisas');
  const topicCard = (t) => h('a.lib-card', { href: `#/library/${t.id}` },
    h('span.lib-icon', { 'aria-hidden': 'true' }, icon(t.icon)),
    h('span.lib-text', h('strong', t.title), h('small', `${countWord(t.count, 'أحاديث', 'حديثًا')}، منها ${ar(t.agreed)} متفق عليه`)));
  mount(h('div.library',
    topbar({ title: 'المكتبة', sub: 'أحاديث صحيحة، وسير الصحابة، وتعلّم الصلاة' }),
    h('a.sahabi-hero', { href: '#/sahabi' },
      h('span.eyebrow', 'صحابي اليوم'),
      h('strong', today.name),
      h('p', today.bio.split('\n')[0].slice(0, 190).replace(/\s+\S*$/, '') + '…'),
      h('span.sh-more', 'اقرأ سيرته', icon('back'))),
    h('h2.lib-h', 'أحاديث صحيحة مختارة'),
    h('div.lib-grid', hadithTopics.map(topicCard)),
    h('h2.lib-h', 'الصحابة رضي الله عنهم'),
    h('div.lib-grid',
      ...index.filter((t) => t.id === 'sahaba' || t.id === 'qisas').map(topicCard),
      h('a.lib-card', { href: '#/sahabi/list' }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon('user')),
        h('span.lib-text', h('strong', 'سِيَر الصحابة'), h('small', `${ar(sahabi.length)} صحابيًا وصحابية، صحابي كل يوم`)))),
    h('h2.lib-h', 'تعلّم الوضوء والصلاة'),
    h('div.lib-grid', fiqh.sections.map((s) => h('a.lib-card', { href: `#/guide/${s.id}` },
      h('span.lib-icon', { 'aria-hidden': 'true' }, icon(SECTIONS_ICON[s.id] || 'book')),
      h('span.lib-text', h('strong', s.title), h('small', (s.id === 'wudu' || s.id === 'salah' ? countWord(s.steps.length, 'خطوات', 'خطوة') : countWord(s.steps.length, 'نقاط', 'نقطة')) + ' بالدليل'))))),
    h('p.small-note.lib-src', 'الأحاديث ونصوصها وشروحها وتخريجها من ', h('a', { href: 'https://hadeethenc.com', target: '_blank', rel: 'noopener' }, 'موسوعة الأحاديث النبوية (HadeethEnc)'),
      '، ولا نعرض إلا ما حُكم عليه بالصحة. وسير الصحابة من ويكيبيديا العربية.'),
  ));
}

// ================= أحاديث موضوع =================
export async function renderTopic(params) {
  let index, items;
  try { [index, items] = await Promise.all([load('index'), load(params.topic)]); } catch { return offlineEmpty('المكتبة', '#/library'); }
  const t = index.find((x) => x.id === params.topic);
  if (!t) return navigate('/library', { replace: true });
  let onlyAgreed = false;
  const list = h('ol.hd-list');
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث في الأحاديث…', 'aria-label': 'ابحث في أحاديث الموضوع' });
  const count = h('p.muted.hd-count');
  const draw = () => {
    const q = normalize(input.value.trim());
    const shown = items.filter((x) => (!onlyAgreed || x.agreed) && (!q || normalize(x.text + ' ' + x.title).includes(q)));
    count.textContent = countWord(shown.length, 'أحاديث', 'حديثًا');
    list.replaceChildren(...shown.map((x) => h('li', h('a.hd-item', { href: `#/hadith/${t.id}/${x.id}` },
      h('p.hd-title', x.title),
      badges(x)))));
    if (!shown.length) list.append(h('li.muted', 'لا توجد نتائج.'));
  };
  const seg = h('div.seg', { role: 'radiogroup' }, [[false, 'كل الصحيح'], [true, 'المتفق عليه فقط']].map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === onlyAgreed),
    onclick: (e) => { onlyAgreed = v; for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
  }, label)));
  input.addEventListener('input', draw);
  draw();
  mount(h('div.library',
    topbar({ title: t.title, sub: countWord(t.count, 'أحاديث صحيحة', 'حديثًا صحيحًا'), back: '#/library' }),
    h('div.hd-tools', seg, input),
    count, list));
}

// ================= حديث واحد =================
function hadithBody(x, { full = true } = {}) {
  const copy = async () => {
    const txt = `${x.text}\n\n[${byLabel(x)}، ${x.grade.split('\n')[0]}]\nمن تطبيق «رتّل»`;
    try { await navigator.clipboard.writeText(txt); toast('تم نسخ الحديث'); } catch { toast('تعذر النسخ'); }
  };
  const share = async () => {
    const txt = `${x.text}\n\n[${byLabel(x)}]`;
    if (navigator.share) navigator.share({ text: txt + `\n${location.origin}${location.pathname}#/library` }).catch(() => {}); else copy();
  };
  return [
    h('article.hd-card',
      h('p.hd-text', { lang: 'ar' }, x.text),
      badges(x),
      h('div.hd-actions',
        h('button.pb-chip', { type: 'button', onclick: copy }, icon('copy'), h('span', 'نسخ')),
        h('button.pb-chip', { type: 'button', onclick: share }, icon('share'), h('span', 'مشاركة')))),
    full && x.explain ? h('section.card.hd-sec', h('h2', 'الشرح'), ...x.explain.split(/\n+/).filter((p) => p.trim()).map((p) => h('p', p))) : null,
    full && x.hints?.length ? h('section.card.hd-sec', h('h2', 'من فوائد الحديث'), h('ul.hd-hints', x.hints.map((p) => h('li', p)))) : null,
    full && x.words?.length ? h('section.card.hd-sec', h('h2', 'معاني الكلمات'), h('dl.hd-words', x.words.flatMap(([w, m]) => [h('dt', w), h('dd', m)]))) : null,
    full && x.ref ? h('details.card.hd-sec', h('summary', 'التخريج والمراجع'), h('p.hd-ref', x.ref)) : null,
  ].filter(Boolean);
}

export async function renderHadith(params) {
  let items, index;
  try { [index, items] = await Promise.all([load('index'), load(params.topic)]); } catch { return offlineEmpty('الحديث', '#/library'); }
  const t = index.find((x) => x.id === params.topic);
  const i = items.findIndex((x) => x.id === +params.id);
  if (!t || i < 0) return navigate('/library', { replace: true });
  const x = items[i];
  const prev = items[i - 1], next = items[i + 1];
  mount(h('div.library.hd-page',
    topbar({ title: t.title, sub: `حديث ${ar(i + 1)} من ${ar(items.length)}`, back: `#/library/${t.id}` }),
    ...hadithBody(x),
    h('nav.surah-nav', { 'aria-label': 'الأحاديث المجاورة' },
      prev ? h('a.btn.ghost', { href: `#/hadith/${t.id}/${prev.id}`, onclick: (e) => { e.preventDefault(); navigate(`/hadith/${t.id}/${prev.id}`, { replace: true }); } }, icon('back'), 'السابق') : h('span'),
      next ? h('a.btn.ghost', { href: `#/hadith/${t.id}/${next.id}`, onclick: (e) => { e.preventDefault(); navigate(`/hadith/${t.id}/${next.id}`, { replace: true }); } }, 'التالي', icon('forward')) : h('span')),
  ));
}

// ================= دليل الوضوء والصلاة =================
function evidenceSheet(ev) {
  sheet({ title: 'الدليل', content: () => h('div.hd-sheet', ...hadithBody(ev, { full: false }),
    ev.explain ? h('details.hd-sec', h('summary', 'الشرح'), ...ev.explain.split(/\n+/).filter(Boolean).map((p) => h('p', p))) : null) });
}

export async function renderGuide(params) {
  let fiqh;
  try { fiqh = await load('fiqh'); } catch { return offlineEmpty('تعلّم الصلاة', '#/library'); }
  const i = fiqh.sections.findIndex((s) => s.id === params.id);
  if (i < 0) return navigate('/library', { replace: true });
  const sec = fiqh.sections[i];
  const evBtns = (ids) => (ids?.length ? h('div.gd-ev', ids.map((id, k) => {
    const ev = fiqh.evidence[id];
    return h('button.pb-chip', { type: 'button', onclick: () => evidenceSheet(ev) }, icon('book'), h('span', ids.length > 1 ? `الدليل ${ar(k + 1)}: ${byLabel(ev)}` : `الدليل: ${byLabel(ev)}`));
  })) : null);
  const ordered = sec.id === 'wudu' || sec.id === 'salah';
  mount(h('div.library.guide',
    topbar({ title: sec.title, sub: 'بالأدلة الصحيحة', back: '#/library' }),
    h('section.card.gd-intro', h('p', sec.intro), evBtns(sec.evidence)),
    h(ordered ? 'ol.gd-steps' : 'ul.gd-steps.points', sec.steps.map((st, k) => h('li',
      h('span.gd-num', { 'aria-hidden': 'true' }, ordered ? ar(k + 1) : '•'),
      h('div.gd-body', h('h3', st.t), st.d ? h('p', st.d) : null, evBtns(st.e))))),
    h('p.small-note.gd-note', fiqh.note),
    h('nav.gd-more', h('h2.lib-h', 'أقسام أخرى'), h('div.lib-grid', fiqh.sections.filter((s) => s.id !== sec.id).map((s) => h('a.lib-card.small', { href: `#/guide/${s.id}` },
      h('span.lib-icon', { 'aria-hidden': 'true' }, icon(SECTIONS_ICON[s.id] || 'book')), h('span.lib-text', h('strong', s.title)))))),
  ));
}

// ================= صحابي اليوم =================
export async function renderSahabi(params) {
  let list, sahaba, qisas;
  try { [list, sahaba, qisas] = await Promise.all([load('sahabi'), load('sahaba'), load('qisas')]); } catch { return offlineEmpty('صحابي اليوم', '#/library'); }
  if (params.i === 'list') {
    const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن صحابي…', 'aria-label': 'ابحث عن صحابي' });
    const ul = h('ul.lib-grid.sh-list');
    const today = dayIndex(list.length);
    const draw = () => {
      const q = normalize(input.value.trim());
      ul.replaceChildren(...list.map((s, k) => [s, k]).filter(([s]) => !q || normalize(s.name).includes(q)).map(([s, k]) => h('li', h('a.lib-card', { href: `#/sahabi/${k}` },
        h('span.lib-icon', { 'aria-hidden': 'true' }, k === today ? icon('star') : icon('user')),
        h('span.lib-text', h('strong', s.name), h('small', k === today ? 'صحابي اليوم' : `${ar(s.bio.length > 1200 ? Math.round(s.bio.length / 900) + 1 : 1)} دقيقة قراءة`))))));
    };
    input.addEventListener('input', draw);
    draw();
    return mount(h('div.library', topbar({ title: 'سِيَر الصحابة', sub: `${ar(list.length)} صحابيًا وصحابية`, back: '#/library' }), h('div.hd-tools', input), ul));
  }
  const today = dayIndex(list.length);
  const k = params.i != null && params.i !== '' ? Math.min(list.length - 1, Math.max(0, parseInt(params.i, 10) || 0)) : today;
  const s = list[k];
  const byId = new Map([...sahaba.map((x) => [x.id, ['sahaba', x]]), ...qisas.map((x) => [x.id, ['qisas', x]])]);
  const related = s.hadith.map((id) => byId.get(id)).filter(Boolean);
  const go = (n) => navigate(`/sahabi/${(n + list.length) % list.length}`, { replace: true });
  mount(h('div.library.sahabi-page',
    topbar({ title: k === today ? 'صحابي اليوم' : 'سيرة صحابي', back: '#/library', actions: [h('a.icon-btn', { href: '#/sahabi/list', 'aria-label': 'كل الصحابة' }, icon('users'))] }),
    h('header.sh-head', h('span.eyebrow', k === today ? 'صحابي اليوم' : 'من سِيَر الصحابة'), h('h1', s.name), h('p.muted', 'رضي الله عنه وأرضاه')),
    h('section.card.sh-bio', ...s.bio.split(/\n\n+/).map((p) => h('p', p)),
      h('p.small-note', 'المصدر: ', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, 'ويكيبيديا العربية'), ' (رخصة المشاع الإبداعي CC BY-SA)')),
    related.length ? h('section.sh-related', h('h2.lib-h', 'أحاديث صحيحة ورد فيها ذكره'),
      h('ol.hd-list', related.map(([topic, x]) => h('li', h('a.hd-item', { href: `#/hadith/${topic}/${x.id}` }, h('p.hd-title', x.title), badges(x)))))) : null,
    h('nav.surah-nav', { 'aria-label': 'صحابة آخرون' },
      h('button.btn.ghost', { type: 'button', onclick: () => go(k - 1) }, icon('back'), list[(k - 1 + list.length) % list.length].name),
      h('button.btn.ghost', { type: 'button', onclick: () => go(k + 1) }, list[(k + 1) % list.length].name, icon('forward'))),
  ));
}

/** بطاقة صغيرة لصحابي اليوم (للرئيسية) */
export function sahabiTile() {
  const tile = h('a.quick', { href: '#/library' }, icon('library'), h('span', h('strong', 'المكتبة'), h('small', 'أحاديث صحيحة وسير الصحابة')));
  load('sahabi').then((list) => {
    const s = list[dayIndex(list.length)];
    tile.href = '#/sahabi';
    tile.replaceChildren(icon('star'), h('span', h('strong', 'صحابي اليوم'), h('small', s.name)));
  }).catch(() => {});
  return tile;
}
