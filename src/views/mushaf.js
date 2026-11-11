// وضع الصفحات: مصحف المدينة (604 صفحة × 15 سطرًا) بنص مجمع الملك فهد وخطه
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, juzOf, pageOf } from '../data.js';
import * as settings from '../state.js';
import * as bookmarks from '../features/bookmarks.js';
import { player } from '../audio/player.js';
import { mount, topbar, toast } from '../ui.js';
import { navigate } from '../router.js';
import { ayahSheet } from './reader.js';

const BASE = new URL('../../public/data/mushaf/', import.meta.url).href;
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

export async function renderMushaf(params, _q, isStale) {
  const n = Math.min(604, Math.max(1, parseInt(params.page, 10) || 1));
  let lines;
  try { lines = await getPage(n); } catch { if (!isStale()) { toast('صفحات المصحف غير متاحة بدون إنترنت قبل تحميلها'); navigate('/', { replace: true }); } return; }
  if (isStale()) return;
  getPage(Math.min(604, n + 1)).catch(() => {}); // تحميل مسبق

  const rows = buildLines(lines);
  const firstAyah = lines[0][1][0];
  const surahsOnPage = [...new Set(lines.flatMap(([, t]) => t.map((x) => x[1])))];
  const juz = juzOf(firstAyah[1], firstAyah[2]);

  const page = h('div.m-page', { lang: 'ar', class: `m-page${n <= 2 ? ' m-opening' : ''}` });
  for (const r of rows) {
    if (r.type === 'header') {
      page.append(h('div.m-line.m-header', h('span', `سورة ${getSurahMeta(r.surah).nameAr}`)));
    } else if (r.type === 'basmala') {
      page.append(h('div.m-line.m-basmala', BASMALA));
    } else {
      page.append(h('div.m-line', { class: r.tokens.length <= 4 ? 'm-line m-short' : 'm-line' }, r.tokens.map(([text, s, a, end]) => h(end ? 'span.m-end' : 'span.m-w', { dataset: { s, a } }, text))));
    }
  }

  // ---- التفاعل: ضغطة = خيارات الآية، ضغطتان = تشغيل ----
  let tapTimer = null;
  page.addEventListener('click', (e) => {
    const w = e.target.closest('[data-a]');
    if (!w) { document.body.classList.toggle('immersive'); return; }
    const s = +w.dataset.s, a = +w.dataset.a;
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; player.playFrom(s, a, { noBasmala: true }); toast(`تشغيل من الآية ${ar(a)}`); return; }
    tapTimer = setTimeout(() => { tapTimer = null; ayahSheet(s, a, null); }, 260);
  });

  // ---- السحب بين الصفحات (كتقليب المصحف: لليمين = التالية) ----
  let sx = 0, sy = 0, t0 = 0;
  page.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  page.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - t0 > 600 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    go(dx > 0 ? n + 1 : n - 1);
  }, { passive: true });
  const go = (p) => { if (p >= 1 && p <= 604) navigate(`/page/${p}`, { replace: true }); };
  const onKey = (e) => {
    if (e.target.closest('input, textarea, .sheet')) return;
    if (e.key === 'ArrowLeft') go(n + 1);
    if (e.key === 'ArrowRight') go(n - 1);
  };
  addEventListener('keydown', onKey);

  const pageInput = h('input.page-jump', { type: 'number', min: '1', max: '604', inputmode: 'numeric', value: String(n), 'aria-label': 'رقم الصفحة' });
  pageInput.addEventListener('change', () => go(parseInt(pageInput.value, 10)));

  mount(h('article.mushaf',
    topbar({
      title: surahsOnPage.map((s) => getSurahMeta(s).nameAr).join('، '),
      sub: `الجزء ${ar(juz)}`,
      back: '#/',
      actions: [h('button.icon-btn', { type: 'button', 'aria-label': 'العرض المتصل', title: 'العرض المتصل', onclick: () => { settings.set('readMode', 'scroll'); navigate(`/surah/${firstAyah[1]}/${firstAyah[2]}`); } }, icon('scroll'))],
    }),
    h('div.m-wrap', page),
    h('nav.m-nav', { 'aria-label': 'التنقل بين الصفحات' },
      h('button.icon-btn', { type: 'button', 'aria-label': 'الصفحة السابقة', disabled: n === 1, onclick: () => go(n - 1) }, icon('back')),
      h('label.m-pageno', 'صفحة ', pageInput, ` من ${ar(604)}`),
      h('button.icon-btn', { type: 'button', 'aria-label': 'الصفحة التالية', disabled: n === 604, onclick: () => go(n + 1) }, icon('forward')),
    ),
  ));
  bookmarks.saveLastRead(firstAyah[1], firstAyah[2]);

  // ---- تظليل الآية المقروءة ----
  let active = [];
  const sync = () => {
    const st = player.state();
    active.forEach((x) => x.classList.remove('active'));
    active = st.surah && st.ayah ? [...page.querySelectorAll(`[data-s="${st.surah}"][data-a="${st.ayah}"]`)] : [];
    active.forEach((x) => x.classList.add('active'));
    // متابعة التلاوة للصفحة التالية
    if (st.status === 'playing' && st.surah && st.ayah && settings.get('autoScroll') && !active.length) {
      const p = pageOf(st.surah, st.ayah);
      if (p === n + 1) go(p);
    }
  };
  const unsub = player.subscribe(sync);
  sync();

  return { cleanup() { unsub(); removeEventListener('keydown', onKey); clearTimeout(tapTimer); document.body.classList.remove('immersive'); } };
}
