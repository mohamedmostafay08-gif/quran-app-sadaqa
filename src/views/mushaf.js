// وضع الصفحات: مصحف المدينة (604 صفحة × 15 سطرًا) بنص مجمع الملك فهد وخطه
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, juzOf, pageOf } from '../data.js';
import * as settings from '../state.js';
import * as bookmarks from '../features/bookmarks.js';
import * as notes from '../features/notes.js';
import { player } from '../audio/player.js';
import { mount, topbar, toast, sheet } from '../ui.js';
import { navigate } from '../router.js';
import { ayahSheet, tajweedLegend } from './reader.js';

const BASE = new URL('../../public/data/mushaf/', import.meta.url).href;
let qpcTajweedP = null;
const getQpcTajweed = () => (qpcTajweedP ||= fetch(new URL('../../public/data/tajweed-qpc.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { qpcTajweedP = null; throw e; }));
const files = new Map();
let indexP = null;
const getIndex = () => (indexP ||= fetch(BASE + 'index.json').then((r) => r.json()));
export async function getPage(n) {
  const idx = await getIndex();
  const j = idx[n];
  if (!files.has(j)) files.set(j, fetch(`${BASE}${j}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { files.delete(j); throw e; }));
  return (await files.get(j)).pages[n];
}

const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

/** يملأ الأسطر الناقصة بعناوين السور والبسملة */
export function buildLines(lines) {
  const byNo = new Map(lines);
  const lastTok = lines[lines.length - 1][1].slice(-1)[0];
  const out = [];
  for (let l = 1; l <= 15; l++) {
    if (byNo.has(l)) { out.push({ type: 'text', tokens: byNo.get(l) }); continue; }
    let k = l;
    while (k <= 15 && !byNo.has(k)) k++;
    const gap = k - l;
    const next = k <= 15 ? byNo.get(k)[0] : null;
    const s = next && next[2] === 1 ? next[1] : lastTok[1] + 1;
    // أسطر فارغة كثيرة في آخر الصفحة (الصفحتان ١ و٢) ليست عناوين
    if (!next && gap > 2) break;
    if (s <= 114) {
      const needsBas = s !== 1 && s !== 9;
      if (!needsBas) out.push({ type: 'header', surah: s });
      else if (gap >= 2) out.push({ type: 'header', surah: s }, { type: 'basmala' });
      else out.push(l === 1 && next ? { type: 'basmala' } : { type: 'header', surah: s });
    }
    l = k - 1;
  }
  return out;
}

// شاشة واسعة أفقية: صفحتان متقابلتان كالمصحف المفتوح (الفردية يمينًا والزوجية يسارًا)
const spreadMQ = matchMedia('(min-width: 1280px) and (min-aspect-ratio: 5/4)');

export async function renderMushaf(params, _q, isStale) {
  const n = Math.min(604, Math.max(1, parseInt(params.page, 10) || 1));
  const spread = spreadMQ.matches;
  const nums = spread ? (n % 2 ? [n, n + 1] : [n - 1, n]).filter((p) => p >= 1 && p <= 604) : [n];
  let pagesLines;
  try { pagesLines = await Promise.all(nums.map((p) => getPage(p))); } catch { if (!isStale()) { toast('صفحات المصحف غير متاحة بدون إنترنت قبل تحميلها'); navigate('/quran', { replace: true }); } return; }
  if (isStale()) return;
  const last = nums[nums.length - 1];
  getPage(Math.min(604, last + 1)).catch(() => {}); // تحميل مسبق
  if (spread) getPage(Math.min(604, last + 2)).catch(() => {});

  const allLines = pagesLines.flat();
  const surahIds = [...new Set(allLines.flatMap(([, t]) => t.map((x) => x[1])))];
  // التجويد (ملف إضافي يُحمَّل عند الحاجة) + العلامات والملاحظات للسور الظاهرة
  const useTajweed = settings.get('tajweed');
  const [tj, marks, noteMaps] = await Promise.all([
    useTajweed ? getQpcTajweed().catch(() => null) : null,
    Promise.all(surahIds.map((s) => bookmarks.bookmarkedIn(s))),
    Promise.all(surahIds.map((s) => notes.inSurah(s))),
  ]);
  if (isStale()) return;
  const isMarked = (s, a) => marks[surahIds.indexOf(s)]?.has(a);
  const noteOf = (s, a) => noteMaps[surahIds.indexOf(s)]?.get(a);
  const wordNode = (text, s, a, wi) => {
    const note = noteOf(s, a);
    const cls = 'm-w' + (note?.color ? ` hl-${note.color}` : '');
    const ranges = tj?.ayahs[`${s}:${a}`]?.filter((x) => x[0] === wi);
    if (!ranges?.length) return h('span', { class: cls, dataset: { s, a } }, text);
    const parts = [];
    let cur = 0;
    for (const [, st, en, rule] of ranges) {
      if (st > cur) parts.push(text.slice(cur, st));
      parts.push(h('span', { class: `tj tj-${tj.rules[rule]}` }, text.slice(st, en)));
      cur = en;
    }
    if (cur < text.length) parts.push(text.slice(cur));
    return h('span', { class: cls, dataset: { s, a } }, parts);
  };
  const endNode = (text, s, a) => {
    const note = noteOf(s, a);
    return h('span', { class: 'm-end' + (isMarked(s, a) ? ' bookmarked' : '') + (note?.text ? ' has-note' : ''), dataset: { s, a }, title: isMarked(s, a) ? 'عليها علامة' : null }, text);
  };
  const firstAyah = pagesLines[0][0][1][0];
  const juz = juzOf(firstAyah[1], firstAyah[2]);

  const buildPage = (p, lines) => {
    const page = h('div', { lang: 'ar', class: `m-page${p <= 2 ? ' m-opening' : ''}`, dataset: { page: p } });
    for (const r of buildLines(lines)) {
      if (r.type === 'header') {
        page.append(h('div.m-line.m-header', h('span', `سورة ${getSurahMeta(r.surah).nameAr}`)));
      } else if (r.type === 'basmala') {
        page.append(h('div.m-line.m-basmala', BASMALA));
      } else {
        page.append(h('div.m-line', { class: r.tokens.length <= 4 ? 'm-line m-short' : 'm-line' }, r.tokens.map(([text, s, a, end, wi]) => (end ? endNode(text, s, a) : wordNode(text, s, a, wi)))));
      }
    }
    if (spread) page.append(h('div.m-folio', ar(p)));
    return page;
  };
  const pages = nums.map((p, i) => buildPage(p, pagesLines[i]));
  const wrap = h('div', { class: `m-wrap${spread ? ' m-spread' : ''}` }, pages);

  // ---- التفاعل: ضغطة = خيارات الآية، ضغطتان = تشغيل ----
  let tapTimer = null;
  wrap.addEventListener('click', (e) => {
    if (!e.target.closest('.m-page')) return;
    const w = e.target.closest('[data-a]');
    if (!w) { if (!spread) document.body.classList.toggle('immersive'); return; }
    const s = +w.dataset.s, a = +w.dataset.a;
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; player.playFrom(s, a, { noBasmala: true }); toast(`تشغيل من الآية ${ar(a)}`); return; }
    tapTimer = setTimeout(() => { tapTimer = null; ayahSheet(s, a, null); }, 260);
  });

  // ---- السحب بين الصفحات (كتقليب المصحف: لليمين = التالية) ----
  const step = spread ? 2 : 1;
  let sx = 0, sy = 0, t0 = 0;
  wrap.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - t0 > 600 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    go(dx > 0 ? nums[0] + step : nums[0] - step);
  }, { passive: true });
  const go = (p) => { p = Math.min(604, Math.max(1, p)); if (!nums.includes(p) || !spread) navigate(`/page/${p}`, { replace: true }); };
  const onKey = (e) => {
    if (e.target.closest('input, textarea, .sheet')) return;
    if (e.key === 'ArrowLeft' && last < 604) go(last + 1);
    if (e.key === 'ArrowRight' && nums[0] > 1) go(nums[0] - 1);
  };
  addEventListener('keydown', onKey);
  // تغيّر حجم النافذة بين صفحة وصفحتين
  const onMQ = () => dispatchEvent(new HashChangeEvent('hashchange'));
  spreadMQ.addEventListener('change', onMQ);

  const pageInput = h('input.page-jump', { type: 'number', min: '1', max: '604', inputmode: 'numeric', value: String(n), 'aria-label': 'رقم الصفحة' });
  pageInput.addEventListener('change', () => { const v = parseInt(pageInput.value, 10); if (v >= 1 && v <= 604) navigate(`/page/${v}`, { replace: true }); });

  mount(h('article.mushaf',
    topbar({
      title: surahIds.map((s) => getSurahMeta(s).nameAr).join('، '),
      sub: `الجزء ${ar(juz)}${spread ? `، الصفحتان ${ar(nums[0])}–${ar(last)}` : ''}`,
      back: '#/quran',
      actions: [
        h('button.icon-btn', { type: 'button', 'aria-label': 'العرض المتصل', title: 'العرض المتصل', onclick: () => { settings.set('readMode', 'scroll'); navigate(`/surah/${firstAyah[1]}/${firstAyah[2]}`); } }, icon('scroll')),
        h('button.icon-btn', { type: 'button', 'aria-label': 'خيارات العرض', onclick: () => optionsSheet() }, icon('more')),
      ],
    }),
    wrap,
    h('nav.m-nav', { 'aria-label': 'التنقل بين الصفحات' },
      h('button.icon-btn', { type: 'button', 'aria-label': spread ? 'الصفحتان السابقتان' : 'الصفحة السابقة', disabled: nums[0] === 1, onclick: () => go(nums[0] - 1) }, icon('back')),
      h('label.m-pageno', 'صفحة ', pageInput, ` من ${ar(604)}`),
      h('button.icon-btn', { type: 'button', 'aria-label': spread ? 'الصفحتان التاليتان' : 'الصفحة التالية', disabled: last === 604, onclick: () => go(last + 1) }, icon('forward')),
    ),
  ));
  bookmarks.saveLastRead(firstAyah[1], firstAyah[2]);

  // ---- تظليل الآية المقروءة ----
  let active = [];
  const sync = () => {
    const st = player.state();
    active.forEach((x) => x.classList.remove('active'));
    active = st.surah && st.ayah ? [...wrap.querySelectorAll(`[data-s="${st.surah}"][data-a="${st.ayah}"]`)] : [];
    active.forEach((x) => x.classList.add('active'));
    // متابعة التلاوة للصفحة التالية
    if (st.status === 'playing' && st.surah && st.ayah && settings.get('autoScroll') && !active.length) {
      const p = pageOf(st.surah, st.ayah);
      if (p === last + 1) go(p);
    }
  };
  const unsub = player.subscribe(sync);
  sync();

  return { cleanup() { unsub(); removeEventListener('keydown', onKey); spreadMQ.removeEventListener('change', onMQ); clearTimeout(tapTimer); document.body.classList.remove('immersive'); } };
}

function optionsSheet() {
  const seg = (key, opts) => h('div.seg', { role: 'radiogroup' }, opts.map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(settings.get(key) === v),
    onclick: (e) => { settings.set(key, v); for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); dispatchEvent(new HashChangeEvent('hashchange')); },
  }, label)));
  sheet({
    title: 'خيارات الصفحات',
    content: () => h('div.form',
      h('div.field', h('span', 'ألوان التجويد'), seg('tajweed', [[false, 'بدون'], [true, 'ملوّن']])),
      settings.get('tajweed') ? tajweedLegend() : null,
      h('div.field', h('span', 'الثيم'), seg('theme', [['auto', 'تلقائي'], ['light', 'أبيض'], ['sepia', 'سيبيا'], ['dark', 'ليلي']])),
    ),
  });
}
