// البحث في نص القرآن (بدون تشكيل)
import { h, icon, ar, debounce } from '../lib/dom.js';
import { normalize, latinDigits } from '../lib/arabic.js';
import { getSimpleText, getSurahText, getSurahMeta, getSurahs } from '../data.js';
import { mount, topbar, empty } from '../ui.js';

const MAX = 200;
let normCache = null;

async function index() {
  if (normCache) return normCache;
  const simple = await getSimpleText();
  normCache = simple.map((ayahs) => ayahs.map(normalize));
  return normCache;
}

export function renderSearch(_p, query) {
  const input = h('input.search-input', {
    type: 'search', placeholder: 'اكتب كلمة أو جزءًا من آية، أو رقم مثل ٢:٢٥٥', 'aria-label': 'نص البحث',
    enterkeyhint: 'search', autocomplete: 'off', value: query.q || '',
  });
  const exact = h('input', { type: 'checkbox', id: 'exact' });
  const status = h('p.search-status', { role: 'status', 'aria-live': 'polite' });
  const results = h('ol.results');

  const run = async () => {
    const q = input.value.trim();
    history.replaceState(null, '', '#/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
    results.replaceChildren();
    if (!q) { status.textContent = ''; return; }

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

  const el = h('div.search-page',
    topbar({ title: 'البحث' }),
    h('form.search-bar', { role: 'search', onsubmit: (e) => { e.preventDefault(); run(); } }, icon('search'), input),
    h('label.check', exact, h('span', 'كلمة كاملة فقط')),
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
  const uw = uthmani.split(' ');
  if (words.length !== uw.length) return [];
  // نحدد مدى المطابقة بالحروف ثم الكلمات التي تقع فيه
  const out = [];
  let from = 0;
  while (true) {
    const i = norm.indexOf(nq, from);
    if (i < 0) break;
    const end = i + nq.length;
    let pos = 0;
    words.forEach((w, k) => {
      const ws = pos, we = pos + w.length;
      if (we > i && ws < end) out.push(k);
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
    h('span.result-ref', `سورة ${m.nameAr} · ${ar(a)}`),
    h('p.result-text', { lang: 'ar' }, body),
  ));
}
