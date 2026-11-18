// اختبار الحفظ: «أكمل الآية» و«ما الآية التالية؟» و«في أي سورة؟» من محفوظاتك أو من جزء تختاره
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText, juzStart } from '../data.js';
import { mount, topbar } from '../ui.js';
import { player } from '../audio/player.js';
import { isWordToken } from '../features/extra.js';
import * as srs from '../features/srs.js';

const COUNT = 10;
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const words = (t) => t.split(' ').filter(isWordToken);
const clip = (t, n = 9) => { const w = words(t); return w.length > n ? w.slice(0, n).join(' ') + ' …' : w.join(' '); };

/** آيات النطاق: [{s, a, text}] */
async function scopeAyahs(scope) {
  let refs = [];
  if (scope === 'mine') refs = (await srs.all()).map((x) => [x.surah, x.ayah]);
  else {
    const j = +scope;
    const st = juzStart(j), en = j < 30 ? juzStart(j + 1) : { surah: 115, ayah: 1 };
    for (let s = st.surah; s <= Math.min(114, en.surah); s++) {
      const count = getSurahMeta(s).ayahCount;
      for (let a = s === st.surah ? st.ayah : 1; a <= count; a++) { if (s === en.surah && a >= en.ayah) break; refs.push([s, a]); }
    }
  }
  const bySurah = new Map();
  for (const [s, a] of refs) (bySurah.get(s) || bySurah.set(s, []).get(s)).push(a);
  const out = [];
  for (const [s, list] of bySurah) { const t = await getSurahText(s); for (const a of list) out.push({ s, a, text: t[a - 1] }); }
  return out;
}

function makeQuestion(pool, all, surahs) {
  for (let tries = 0; tries < 40; tries++) {
    const qq = tryQuestion(pool, all, surahs);
    if (qq && new Set(qq.options).size === qq.options.length) return qq; // بلا اختيارات متطابقة
  }
  return null;
}

function tryQuestion(pool, all, surahs) {
  for (let tries = 0; tries < 30; tries++) {
    const q = pick(pool);
    const w = words(q.text);
    const kind = pick(['complete', 'next', 'surah']);
    if (kind === 'complete' && w.length >= 6) {
      const cut = Math.max(3, Math.floor(w.length / 2));
      const answer = w.slice(cut).join(' ');
      const others = shuffle(all.filter((x) => x !== q && words(x.text).length >= 6)).slice(0, 3).map((x) => { const ww = words(x.text); return ww.slice(Math.floor(ww.length / 2)).join(' '); });
      if (others.length < 3) continue;
      return { q, kind, prompt: 'أكمل الآية:', stem: w.slice(0, cut).join(' ') + ' …', options: shuffle([answer, ...others].map((t) => clip(t, 12))), answer: clip(answer, 12) };
    }
    if (kind === 'next') {
      const nx = all.find((x) => x.s === q.s && x.a === q.a + 1);
      if (!nx) continue;
      const others = shuffle(all.filter((x) => x !== nx && x !== q)).slice(0, 3).map((x) => clip(x.text));
      if (others.length < 3) continue;
      return { q, kind, prompt: 'ما الآية التالية؟', stem: q.text, options: shuffle([clip(nx.text), ...others]), answer: clip(nx.text), next: nx };
    }
    if (kind === 'surah' && surahs.length >= 4 && w.length >= 4) {
      const answer = `سورة ${getSurahMeta(q.s).nameAr}`;
      const others = shuffle(surahs.filter((s) => s !== q.s)).slice(0, 3).map((s) => `سورة ${getSurahMeta(s).nameAr}`);
      return { q, kind, prompt: 'في أي سورة هذه الآية؟', stem: q.text, options: shuffle([answer, ...others]), answer };
    }
  }
  return null;
}

let scope = '30';

export async function renderQuiz() {
  const mine = await srs.all();
  if (scope === 'mine' && !mine.length) scope = '30';
  const body = h('div.quiz-body');
  const scopeSel = h('select.note-input', { 'aria-label': 'نطاق الاختبار', onchange: () => { scope = scopeSel.value; start(); } },
    mine.length ? h('option', { value: 'mine' }, `محفوظاتي (${ar(mine.length)} آية)`) : null,
    ...Array.from({ length: 30 }, (_, i) => 30 - i).map((j) => h('option', { value: String(j) }, j === 30 ? 'جزء عمّ (٣٠)' : j === 29 ? 'جزء تبارك (٢٩)' : `الجزء ${ar(j)}`)));
  scopeSel.value = scope;

  async function start() {
    body.replaceChildren(h('div.sk', { style: { height: '220px' } }));
    let all;
    try { all = await scopeAyahs(scope); } catch { body.replaceChildren(h('p.muted', 'تعذر تحميل الآيات.')); return; }
    const surahs = [...new Set(all.map((x) => x.s))];
    const pool = scope === 'mine' ? all : all.filter((x) => words(x.text).length >= 4);
    let n = 0, score = 0;
    const mistakes = [];
    const next = () => {
      if (n >= COUNT) return finish();
      const qq = makeQuestion(pool, all, surahs);
      if (!qq) { body.replaceChildren(h('p.muted', 'النطاق صغير جدًا للاختبار؛ اختر جزءًا أو أضف آيات للحفظ.')); return; }
      n++;
      const opts = h('div.quiz-opts');
      const nextBtn = h('button.btn.block', { type: 'button', hidden: true, onclick: next }, n < COUNT ? 'السؤال التالي' : 'النتيجة');
      const fb = h('p.quiz-fb', { 'aria-live': 'polite' });
      for (const o of qq.options) {
        opts.append(h('button.quiz-opt', { type: 'button', lang: 'ar', onclick: (e) => {
          const ok = o === qq.answer;
          if (ok) score++; else mistakes.push(qq);
          for (const b of opts.children) { b.disabled = true; if (b.textContent === qq.answer) b.classList.add('right'); }
          if (!ok) e.currentTarget.classList.add('wrong');
          fb.textContent = ok ? 'أحسنت ✓' : `الإجابة الصحيحة: ${qq.kind === 'surah' ? qq.answer : 'المظلّلة بالأخضر'}`;
          nextBtn.hidden = false; nextBtn.focus();
        } }, o));
      }
      const ref = qq.q;
      body.replaceChildren(
        h('div.quiz-head', h('span', `السؤال ${ar(n)} من ${ar(COUNT)}`), h('span', `النتيجة: ${ar(score)}`)),
        h('div.quiz-bar', h('i', { style: { width: `${((n - 1) / COUNT) * 100}%` } })),
        h('section.card.quiz-q',
          h('p.quiz-prompt', qq.prompt),
          h('p.quiz-stem', { lang: 'ar' }, qq.kind === 'surah' ? clip(qq.stem, 16) : qq.stem),
          h('button.btn.ghost', { type: 'button', onclick: () => player.playFrom(ref.s, ref.a, { only: true, times: 1 }) }, icon('play'), 'استمع للآية')),
        opts, fb, nextBtn);
    };
    const finish = () => {
      try { if (score > (+localStorage.getItem('qa:quizBest') || 0)) localStorage.setItem('qa:quizBest', String(score)); } catch { /* */ }
      const pct = Math.round((score / COUNT) * 100);
      body.replaceChildren(
        h('section.card.quiz-result',
          h('strong', `${ar(score)} / ${ar(COUNT)}`),
          h('p', pct >= 90 ? 'ممتاز، بارك الله في حفظك' : pct >= 60 ? 'جيد جدًا، راجع الأخطاء وستتقنها' : 'تحتاج إلى مراجعة، وفقك الله'),
          h('button.btn', { type: 'button', onclick: start }, icon('repeat'), 'اختبار جديد')),
        mistakes.length ? h('h2.lib-h', 'راجع هذه الآيات') : null,
        mistakes.length ? h('ul.quiz-review', mistakes.map((m) => h('li', h('a.row-btn', { href: `#/surah/${m.q.s}/${m.q.a}` },
          h('span', h('strong', `سورة ${getSurahMeta(m.q.s).nameAr} ${ar(m.q.a)}`), h('small', { lang: 'ar' }, clip(m.q.text, 10))), icon('forward'))))) : null);
    };
    next();
  }

  mount(h('div.quiz-page',
    topbar({ title: 'اختبار الحفظ', back: '#/quran' }),
    h('div.field.quiz-scope', h('span', 'اختبر نفسك في'), scopeSel),
    body));
  start();
}
