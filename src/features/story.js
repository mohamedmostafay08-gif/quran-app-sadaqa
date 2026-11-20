// عرض القصص السردية (الصحابة والأنبياء): فقرات وعناوين، وآيات تُدرج من نص المصحف نفسه، وأحاديث بتخريجها
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { player } from '../audio/player.js';

const cache = new Map();
/** يحمّل ملف قصص (sahaba | prophets) مرة واحدة */
export function loadStories(kind) {
  if (!cache.has(kind)) cache.set(kind, fetch(new URL(`../../public/data/library/stories-${kind}.json`, import.meta.url).href)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { cache.delete(kind); throw e; }));
  return cache.get(kind);
}

const parseRef = (ref) => { const [s, r] = ref.split(':'); const [a, b] = r.split('-').map(Number); return [+s, a, b || a]; };

async function ayahBlock(ref) {
  const [s, a, b] = parseRef(ref);
  const texts = (await getSurahText(s)).slice(a - 1, b);
  const label = `${getSurahMeta(s).nameAr} ${a === b ? ar(a) : `${ar(a)}–${ar(b)}`}`;
  return h('figure.st-ayah',
    h('blockquote', { lang: 'ar' }, '﴿', ...texts.flatMap((t, k) => [t, k < texts.length - 1 ? h('span.st-an', ` ﴿${ar(a + k)}﴾ `) : null]), '﴾'),
    h('figcaption',
      h('a', { href: `#/surah/${s}/${a}` }, label),
      h('button.icon-btn', { type: 'button', 'aria-label': `استمع: ${label}`, onclick: () => player.playFrom(s, a, b > a ? { range: { from: { surah: s, ayah: a }, to: { surah: s, ayah: b }, times: 1 } } : { only: true, times: 1 }) }, icon('play'))));
}

/** يبني عقد القصة (async لأن الآيات تُقرأ من بيانات المصحف) */
export async function storyNodes(story) {
  const out = [];
  for (const b of story.blocks || []) {
    if (b.t === 'p') out.push(h('p.st-p', b.text));
    else if (b.t === 'h') out.push(h('h2.st-h', b.text));
    else if (b.t === 'ayah') { try { out.push(await ayahBlock(b.ref)); } catch { /* مرجع غير صالح */ } }
    else if (b.t === 'hadith') out.push(h('figure.st-hadith', h('span.st-q', { 'aria-hidden': 'true' }, 'من السنة'), h('blockquote', { lang: 'ar' }, b.text), h('figcaption', h('span.hd-badge', b.by), b.grade ? h('span.hd-badge.hd-grade', b.grade) : null)));
  }
  if (story.lessons?.length) out.push(h('section.st-lessons', h('h2.st-h', 'من دروس القصة'), h('ul', story.lessons.map((x) => h('li', x)))));
  return out;
}

/** وقت القراءة التقريبي بالدقائق */
export const readMinutes = (story) => Math.max(1, Math.round((story.blocks || []).reduce((n, b) => n + (b.text || '').split(/\s+/).length, 0) / 180));

export const readLabel = (story) => { const n = readMinutes(story); return n === 1 ? 'دقيقة قراءة' : n === 2 ? 'دقيقتان للقراءة' : n <= 10 ? `${ar(n)} دقائق قراءة` : `${ar(n)} دقيقة قراءة`; };
