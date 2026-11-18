// وضع الأطفال: حفظ جزء عمّ بخط كبير — الشيخ يقرأ الآية ثم وقت ليردّد الطفل، ونجوم لكل سورة
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { mount, topbar, toast } from '../ui.js';
import { player } from '../audio/player.js';

const SURAHS = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i)]; // الفاتحة ثم من الناس إلى النبأ
const COLORS = ['#e8f4ef', '#fff2d6', '#e7eefc', '#fde8ec', '#efe8fb', '#e6f6f9'];
const stars = (s) => (settings.get('kidsStars') || {})[s] || 0;
const starRow = (n) => h('span.kd-stars', { 'aria-label': `${ar(n)} من ${ar(3)} نجوم` }, [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : '' }, '★')));

async function addStar(s) {
  const all = { ...(settings.get('kidsStars') || {}) };
  all[s] = Math.min(3, (all[s] || 0) + 1);
  await settings.set('kidsStars', all);
  return all[s];
}

export function renderKids(params) {
  if (params.surah) return kidsSurah(+params.surah);
  const total = Object.values(settings.get('kidsStars') || {}).reduce((a, b) => a + b, 0);
  mount(h('div.kids-page',
    topbar({ title: 'وضع الأطفال', sub: 'احفظ جزء عمّ واجمع النجوم', back: '#/quran' }),
    h('section.card.kd-hero', total ? [h('strong', `★ ${ar(total)}`), h('span', total === 1 ? 'نجمة جمعتها' : 'نجوم جمعتها')] : h('span', 'اختر سورة وابدأ، واجمع النجوم ★')),
    h('div.kd-grid', SURAHS.map((s, i) => h('a.kd-card', { href: `#/kids/${s}`, style: { '--kd': COLORS[i % COLORS.length] } },
      h('span.kd-name', getSurahMeta(s).nameAr), h('small', `${ar(getSurahMeta(s).ayahCount)} آيات`), starRow(stars(s))))),
  ));
}

async function kidsSurah(s) {
  const meta = getSurahMeta(s);
  const ayahs = await getSurahText(s);
  let a = 1, auto = false, waitTimer = 0, startedAt = 0, playingAyah = 0;
  const text = h('p.kd-ayah', { lang: 'ar' });
  const counter = h('span.kd-count');
  const autoBtn = h('button.btn.kd-auto', { type: 'button' });
  const draw = () => {
    text.textContent = ayahs[a - 1];
    counter.textContent = `الآية ${ar(a)} من ${ar(ayahs.length)}`;
    autoBtn.replaceChildren(icon(auto ? 'pause' : 'repeat'), h('span', auto ? 'إيقاف' : 'استمع وردّد'));
    prev.disabled = a <= 1; next.disabled = a >= ayahs.length;
  };
  const play = () => { clearTimeout(waitTimer); playingAyah = a; startedAt = performance.now(); player.playFrom(s, a, { only: true, times: 1, noBasmala: true }); };
  const prev = h('button.icon-btn.kd-nav', { type: 'button', 'aria-label': 'الآية السابقة', onclick: () => { a--; draw(); if (auto) play(); } }, icon('forward'));
  const next = h('button.icon-btn.kd-nav', { type: 'button', 'aria-label': 'الآية التالية', onclick: () => { a++; draw(); if (auto) play(); } }, icon('back'));
  autoBtn.onclick = () => { auto = !auto; draw(); if (auto) play(); else { clearTimeout(waitTimer); player.pause(); } };

  // انتهت قراءة الشيخ للآية: نترك للطفل وقتًا مساويًا ليردّدها، ثم الآية التالية
  const unsub = player.subscribe((st) => {
    if (!auto || st.status !== 'idle' || st.surah !== s || playingAyah !== a) return;
    playingAyah = 0;
    const gap = Math.min(15000, Math.max(2500, performance.now() - startedAt));
    waitTimer = setTimeout(async () => {
      if (!auto) return;
      if (a < ayahs.length) { a++; draw(); play(); return; }
      auto = false; draw();
      const n = await addStar(s);
      starsEl.replaceChildren(starRow(n));
      toast(n >= 3 ? 'ما شاء الله! أتممت النجوم الثلاث ★★★' : 'أحسنت! حصلت على نجمة ★');
    }, gap);
  });
  const starsEl = h('div', starRow(stars(s)));
  mount(h('div.kids-page.kd-surah',
    topbar({ title: `سورة ${meta.nameAr}`, back: '#/kids' }),
    h('section.card.kd-reader', counter, text, h('div.kd-controls', prev, h('button.btn.ghost', { type: 'button', onclick: play }, icon('play'), 'استمع'), next)),
    autoBtn,
    h('section.card.kd-stars-card', h('span', 'نجومك في هذه السورة'), starsEl,
      h('button.btn.ghost', { type: 'button', onclick: async () => { const n = await addStar(s); starsEl.replaceChildren(starRow(n)); toast('أحسنت ★'); } }, 'حفظتها! أعطني نجمة')),
    h('p.small-note.kd-tip', 'اضغط «استمع وردّد»: يقرأ الشيخ الآية، ثم يسكت لتردّدها، ثم ينتقل للآية التالية. وعند إتمام السورة تحصل على نجمة.'),
  ));
  draw();
  return { cleanup() { unsub(); clearTimeout(waitTimer); auto = false; } };
}
