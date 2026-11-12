// البحث في نص القرآن (بدون تشكيل)
import { h, icon, ar, debounce } from '../lib/dom.js';
import { normalize, latinDigits } from '../lib/arabic.js';
import { getSimpleText, getSurahText, getSurahMeta, getSurahs } from '../data.js';
import { mount, topbar, empty } from '../ui.js';
import { getRoots, decodeLoc, isWordToken } from '../features/extra.js';

const MAX = 200;
let normCache = null;

async function index() {
  if (normCache) return normCache;
  const simple = await getSimpleText();
  normCache = simple.map((ayahs) => ayahs.map(normalize));
  return normCache;
}

let mode = 'text';

export function renderSearch(_p, query) {
  if (query.root) mode = 'root';
  else if (query.q) mode = 'text';
  const input = h('input.search-input', {
    type: 'search', placeholder: '', 'aria-label': 'نص البحث',
    enterkeyhint: 'search', autocomplete: 'off', value: query.root || query.q || '',
  });
  const exact = h('input', { type: 'checkbox', id: 'exact' });
  const status = h('p.search-status', { role: 'status', 'aria-live': 'polite' });
  const results = h('ol.results');

  const run = async () => {
    const q = input.value.trim();
    history.replaceState(null, '', '#/search' + (q ? `?${mode === 'root' ? 'root' : 'q'}=` + encodeURIComponent(q) : ''));
    results.replaceChildren();
    if (!q) { status.textContent = ''; return; }
    if (mode === 'root') return runRoot(q, status, results, input);

    // مرجع مباشر 2:255
    const ref = latinDigits(q).match(/^(\d{1,3})\s*[:：/.\-]\s*(\d{1,3})$/);
    if (ref) {
      const s = +ref[1], a = +ref[2];
      const m = getSurahs()[s - 1];
      if (m && a >= 1 && a <= m.ayahCount) {
        const t = (await getSurahText(s))[a - 1];
        status.textContent = 'انتقال مباشر';
        results.append(resultItem(s, a, t, []));
        return;
      }
    }

    const nq = normalize(q);
    if (nq.length < 2) { status.textContent = 'اكتب حرفين على الأقل'; return; }
    status.textContent = 'جارٍ البحث…';
    const idx = await index();
    const re = exact.checked ? new RegExp(`(^| )${nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($| )`) : null;
    const hits = [];
    let total = 0;
    for (let s = 0; s < 114; s++) {
      const arr = idx[s];
      for (let a = 0; a < arr.length; a++) {
        const t = arr[a];
        const found = re ? re.test(t) : t.includes(nq);
        if (found) { total++; if (hits.length < MAX) hits.push([s + 1, a + 1]); }
      }
    }
    if (input.value.trim() !== q) return; // تغير النص أثناء البحث
    if (!total) {
      status.textContent = '';
      results.append(h('li.no-hover', empty('search', 'لا توجد نتائج', 'جرّب كلمة أقصر أو بدون "ال" التعريف.')));
      return;
    }
    status.textContent = total > MAX ? `${ar(total)} نتيجة — يُعرض أول ${ar(MAX)}` : `${ar(total)} نتيجة`;
    const frag = document.createDocumentFragment();
    for (const [s, a] of hits) {
      const text = (await getSurahText(s))[a - 1];
      frag.append(resultItem(s, a, text, matchWords(idx[s - 1][a - 1], nq, text)));
    }
    results.append(frag);
  };
  const debounced = debounce(run, 250);
  input.addEventListener('input', debounced);
  exact.addEventListener('change', run);

  const exactLabel = h('label.check', exact, h('span', 'كلمة كاملة فقط'));
  const applyMode = () => {
    input.placeholder = mode === 'root' ? 'اكتب الجذر، مثل: رحم أو علم' : 'اكتب كلمة أو جزءًا من آية، أو رقم مثل ٢:٢٥٥';
    exactLabel.hidden = mode === 'root';
  };
  const modeSeg = h('div.seg', { role: 'tablist', 'aria-label': 'نوع البحث' }, [['text', 'في النص'], ['root', 'بالجذر']].map(([m, label]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(mode === m),
    onclick: (e) => { mode = m; for (const b of modeSeg.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); applyMode(); run(); input.focus(); },
  }, label)));
  applyMode();
  const el = h('div.search-page',
    topbar({ title: 'البحث', back: '#/quran' }),
    modeSeg,
    h('form.search-bar', { role: 'search', onsubmit: (e) => { e.preventDefault(); run(); } }, icon('search'), input),
    exactLabel,
    status,
    results,
  );
  mount(el);
  if (input.value) run();
  else setTimeout(() => input.focus(), 50);
}

/** أرقام الكلمات المطابقة (لتظليلها في النص العثماني إن تطابق عدد الكلمات) */
function matchWords(norm, nq, uthmani) {
  const words = norm.split(' ');
  // مواضع الكلمات الحقيقية في النص العثماني (بدون علامات الوقف المستقلة)
  const wordPos = [];
  uthmani.split(' ').forEach((t, i) => { if (isWordToken(t)) wordPos.push(i); });
  if (words.length !== wordPos.length) return [];
  const out = [];
  let from = 0;
  while (true) {
    const i = norm.indexOf(nq, from);
    if (i < 0) break;
    const end = i + nq.length;
    let pos = 0;
    words.forEach((w, k) => {
      const ws = pos, we = pos + w.length;
      if (we > i && ws < end) out.push(wordPos[k]);
      pos = we + 1;
    });
    from = end;
  }
  return out;
}

function resultItem(s, a, text, wordIdx) {
  const m = getSurahMeta(s);
  const set = new Set(wordIdx);
  const body = set.size
    ? text.split(' ').flatMap((w, k) => [k ? ' ' : '', set.has(k) ? h('mark', w) : w])
    : [text];
  return h('li', h('a.result', { href: `#/surah/${s}/${a}` },
    h('span.result-ref', `سورة ${m.nameAr}، الآية ${ar(a)}`),
    h('p.result-text', { lang: 'ar' }, body),
  ));
}

// ---------- البحث بالجذر ----------
const normRoot = (r) => normalize(r).replace(/\s/g, '').replace(/[اأإآ]/g, 'ا');

async function runRoot(q, status, results, input) {
  status.textContent = 'جارٍ البحث…';
  let roots;
  try { roots = await getRoots(); } catch { status.textContent = 'فهرس الجذور غير متاح بدون إنترنت قبل تحميله'; return; }
  const nq = normRoot(q);
  const keys = Object.keys(roots);
  let root = keys.find((k) => k === q) || keys.find((k) => normRoot(k) === nq);
  if (input.value.trim() !== q) return;
  if (!root) {
    const sugg = keys.filter((k) => normRoot(k).startsWith(nq)).sort((a, b) => roots[b].length - roots[a].length).slice(0, 12);
    status.textContent = sugg.length ? 'لم أجد الجذر بالضبط. هل تقصد:' : '';
    if (sugg.length) results.append(h('li.no-hover', h('div.chip-grid', sugg.map((k) => h('button.chip', { type: 'button', onclick: () => { input.value = k; input.dispatchEvent(new Event('input')); } }, `${k} (${ar(roots[k].length)})`)))));
    else results.append(h('li.no-hover', empty('search', 'لا يوجد جذر مطابق', 'اكتب الجذر بحروفه الأصلية الثلاثية غالبًا، مثل: كتب، قول، رحم.')));
    return;
  }
  // تجميع المواضع حسب الآية
  const byAyah = new Map();
  for (const n of roots[root]) {
    const { surah, ayah, word } = decodeLoc(n);
    const k = surah * 1000 + ayah;
    if (!byAyah.has(k)) byAyah.set(k, { surah, ayah, words: [] });
    byAyah.get(k).words.push(word);
  }
  const list = [...byAyah.values()];
  status.textContent = `الجذر «${root}»: ${ar(roots[root].length)} موضعًا في ${ar(list.length)} آية` + (list.length > MAX ? ` — يُعرض أول ${ar(MAX)}` : '');
  const frag = document.createDocumentFragment();
  for (const x of list.slice(0, MAX)) {
    const text = (await getSurahText(x.surah))[x.ayah - 1];
    // تحويل رقم الكلمة الصرفي إلى رقم الكلمة في النص (مع تجاوز علامات الوقف)
    const toks = text.split(' ');
    const idx = [];
    let w = 0;
    toks.forEach((t, i) => { if (isWordToken(t)) { w++; if (x.words.includes(w)) idx.push(i); } });
    frag.append(resultItem(x.surah, x.ayah, text, idx));
  }
  results.append(frag);
}
