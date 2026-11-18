// الأدعية: أدعية القرآن الكريم (نصها من المصحف نفسه بالمرجع) + رابط لأدعية السنة الصحيحة في المكتبة
// وأسماء الله الحسنى، وآية اليوم
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { mount, topbar, sheet, toast } from '../ui.js';
import { player } from '../audio/player.js';
import { getTafsir } from '../features/extra.js';
import { shareCardSheet } from '../features/shareCard.js';
import { dayIndex } from './library.js';

let selP = null;
export const getSelections = () => (selP ||= fetch(new URL('../../public/data/selections.json', import.meta.url)).then((r) => r.json()).catch((e) => { selP = null; throw e; }));
const parse = (ref) => ref.split(':').map(Number);
const refLabel = (s, a, to) => `سورة ${getSurahMeta(s).nameAr} ${to ? `${ar(a)}–${ar(to)}` : ar(a)}`;

async function ayahText(s, a, to) {
  const list = await getSurahText(s);
  return list.slice(a - 1, to || a).map((t, i) => `${t} ﴿${ar(a + i)}﴾`).join(' ');
}

const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch { toast('تعذر النسخ'); } };

// ================= الأدعية =================
export async function renderDuas(_p, _q, isStale) {
  let data;
  try { data = await getSelections(); } catch { return mount(h('div.duas-page', topbar({ title: 'الأدعية', back: '#/' }), h('p.muted', 'تحتاج اتصالًا بالإنترنت لأول مرة.'))); }
  const texts = await Promise.all(data.quranDuas.map((d) => { const [s, a] = parse(d.ref); return ayahText(s, a, d.to); }));
  if (isStale()) return;
  mount(h('div.duas-page',
    topbar({ title: 'الأدعية', sub: 'من القرآن الكريم والسنة الصحيحة', back: '#/' }),
    h('a.row-btn.dua-sunnah', { href: '#/library/dua' }, h('span', h('strong', 'أدعية من السنة'), h('small', 'أدعية النبي ﷺ الصحيحة مع شرحها')), icon('forward')),
    h('h2.lib-h', `أدعية من القرآن الكريم (${ar(data.quranDuas.length)})`),
    h('ol.dua-list', data.quranDuas.map((d, i) => {
      const [s, a] = parse(d.ref);
      const ref = refLabel(s, a, d.to);
      return h('li.card.dua-card',
        h('strong.dua-title', d.t),
        h('p.dua-text', { lang: 'ar' }, texts[i]),
        h('div.dua-foot',
          h('a.dua-ref', { href: `#/surah/${s}/${a}` }, ref),
          h('span.dua-actions',
            h('button.icon-btn', { type: 'button', 'aria-label': 'استماع', onclick: () => player.playFrom(s, a, d.to ? { range: { from: { surah: s, ayah: a }, to: { surah: s, ayah: d.to }, times: 1 } } : { only: true, times: 1 }) }, icon('play')),
            h('button.icon-btn', { type: 'button', 'aria-label': 'نسخ', onclick: () => copy(`﴿${texts[i]}﴾\n[${ref}]`) }, icon('copy')),
            h('button.icon-btn', { type: 'button', 'aria-label': 'بطاقة مشاركة', onclick: () => shareCardSheet(s, a) }, icon('share')))));
    })),
  ));
}

// ================= أسماء الله الحسنى =================
export async function renderAsma(_p, _q, isStale) {
  let data;
  try { data = await getSelections(); } catch { return mount(h('div.asma-page', topbar({ title: 'أسماء الله الحسنى', back: '#/' }), h('p.muted', 'تحتاج اتصالًا بالإنترنت لأول مرة.'))); }
  if (isStale()) return;
  const today = dayIndex(data.asma.length);
  const open = async (x, i) => {
    const [s, a] = x.ref ? parse(x.ref) : [];
    const verse = x.ref ? await ayahText(s, a) : null;
    sheet({ title: x.n, content: (close) => h('div.asma-sheet',
      h('p.asma-big', { lang: 'ar' }, x.n),
      h('p.asma-meaning', x.m),
      verse ? h('blockquote.sheet-quote', { lang: 'ar' }, verse) : null,
      verse ? h('a.btn.ghost.block', { href: `#/surah/${s}/${a}`, onclick: () => close() }, `اقرأ الآية: ${refLabel(s, a)}`) : null,
      h('p.small-note', `الاسم ${ar(i + 1)} من ${ar(data.asma.length)}`)) });
  };
  const card = (x, i) => h('button.asma-card', { type: 'button', class: i === today ? 'asma-card today' : 'asma-card', onclick: () => open(x, i) },
    h('span.asma-num', ar(i + 1)), h('strong.asma-name', { lang: 'ar' }, x.n), h('small', x.m));
  mount(h('div.asma-page',
    topbar({ title: 'أسماء الله الحسنى', back: '#/' }),
    h('section.card.asma-today', h('span.eyebrow', 'اسم اليوم'), h('strong.asma-big', { lang: 'ar' }, data.asma[today].n), h('p', data.asma[today].m),
      h('button.btn.ghost', { type: 'button', onclick: () => open(data.asma[today], today) }, 'المزيد')),
    h('div.asma-grid', data.asma.map(card)),
    h('p.small-note.asma-note', 'سرد هذه الأسماء ورد في رواية الترمذي، وأكثر أهل العلم على أنه مُدرَج من بعض الرواة لا من كلام النبي ﷺ، والثابت في الصحيحين: «إن لله تسعة وتسعين اسمًا من أحصاها دخل الجنة».'),
  ));
}

// ================= آية اليوم (بطاقة لشاشة «اليوم») =================
export function ayahOfDayCard() {
  const card = h('section.card.aod', { 'aria-label': 'آية اليوم' }, h('span.eyebrow', 'آية اليوم'), h('div.sk', { style: { height: '64px' } }));
  getSelections().then(async (data) => {
    const ref = data.dailyAyahs[dayIndex(data.dailyAyahs.length)];
    const [s, a] = parse(ref);
    const text = (await getSurahText(s))[a - 1];
    const tafsirBox = h('div.aod-tafsir', { hidden: true });
    const toggle = h('button.btn.ghost', { type: 'button', onclick: async () => {
      tafsirBox.hidden = !tafsirBox.hidden;
      toggle.textContent = tafsirBox.hidden ? 'التفسير' : 'إخفاء التفسير';
      if (!tafsirBox.hidden && !tafsirBox.childElementCount) {
        try { const t = await getTafsir(s, a); tafsirBox.append(h('p', t.text), h('small.muted', 'التفسير الميسر')); } catch { tafsirBox.append(h('p.muted', 'التفسير غير متاح بدون إنترنت.')); }
      }
    } }, 'التفسير');
    card.replaceChildren(
      h('span.eyebrow', 'آية اليوم'),
      h('p.aod-text', { lang: 'ar' }, `﴿${text}﴾`),
      h('a.aod-ref', { href: `#/surah/${s}/${a}` }, refLabel(s, a)),
      tafsirBox,
      h('div.aod-actions', toggle,
        h('button.btn', { type: 'button', onclick: () => shareCardSheet(s, a) }, icon('share'), 'شارك الآية')));
  }).catch(() => card.remove());
  return card;
}
