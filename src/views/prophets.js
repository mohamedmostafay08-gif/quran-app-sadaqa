// قصص الأنبياء في القرآن: لكل نبي مواضع قصته في المصحف، تُقرأ أو تُسمع بصوت قارئك
import { h, icon, ar } from '../lib/dom.js';
import { mount, topbar } from '../ui.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { player } from '../audio/player.js';
import { navigate } from '../router.js';
import { loadStories, storyNodes, readLabel } from '../features/story.js';

// [المعرّف، الاسم، المواضع: [سورة، من، إلى]]
export const PROPHETS = [
  ['adam', 'آدم عليه السلام', [[2, 30, 39], [7, 11, 25], [15, 26, 44], [17, 61, 65], [20, 115, 123], [38, 71, 85]]],
  ['idris', 'إدريس عليه السلام', [[19, 56, 57], [21, 85, 86]]],
  ['nuh', 'نوح عليه السلام', [[7, 59, 64], [10, 71, 73], [11, 25, 49], [23, 23, 30], [26, 105, 122], [54, 9, 17], [71, 1, 28]]],
  ['hud', 'هود عليه السلام', [[7, 65, 72], [11, 50, 60], [26, 123, 140], [46, 21, 26]]],
  ['salih', 'صالح عليه السلام', [[7, 73, 79], [11, 61, 68], [26, 141, 159], [27, 45, 53], [91, 11, 15]]],
  ['ibrahim', 'إبراهيم عليه السلام', [[2, 124, 132], [2, 258, 260], [6, 74, 83], [11, 69, 76], [14, 35, 41], [19, 41, 50], [21, 51, 73], [26, 69, 104], [37, 83, 113], [51, 24, 37]]],
  ['lut', 'لوط عليه السلام', [[7, 80, 84], [11, 77, 83], [15, 57, 77], [26, 160, 175], [27, 54, 58], [29, 28, 35]]],
  ['ismail', 'إسماعيل عليه السلام', [[2, 125, 129], [19, 54, 55], [37, 101, 107]]],
  ['yaqub', 'إسحاق ويعقوب عليهما السلام', [[2, 132, 133], [11, 71, 73], [19, 49, 50], [38, 45, 47]]],
  ['yusuf', 'يوسف عليه السلام', [[12, 1, 111]]],
  ['shuayb', 'شعيب عليه السلام', [[7, 85, 93], [11, 84, 95], [26, 176, 191], [29, 36, 37]]],
  ['ayyub', 'أيوب عليه السلام', [[21, 83, 84], [38, 41, 44]]],
  ['yunus', 'يونس عليه السلام', [[10, 98, 98], [21, 87, 88], [37, 139, 148], [68, 48, 50]]],
  ['musa', 'موسى وهارون عليهما السلام', [[2, 49, 61], [7, 103, 162], [10, 75, 92], [18, 60, 82], [20, 9, 98], [26, 10, 68], [28, 3, 43], [40, 23, 46]]],
  ['dawud', 'داود عليه السلام', [[2, 249, 251], [21, 78, 80], [34, 10, 11], [38, 17, 26]]],
  ['sulayman', 'سليمان عليه السلام', [[21, 81, 82], [27, 15, 44], [34, 12, 14], [38, 30, 40]]],
  ['ilyas', 'إلياس عليه السلام', [[37, 123, 132]]],
  ['alyasa', 'اليسع وذو الكفل عليهما السلام', [[6, 86, 86], [21, 85, 86], [38, 48, 48]]],
  ['zakariya', 'زكريا ويحيى عليهما السلام', [[3, 37, 41], [19, 2, 15], [21, 89, 90]]],
  ['isa', 'عيسى ومريم عليهما السلام', [[3, 35, 37], [3, 42, 59], [4, 156, 159], [5, 110, 118], [19, 16, 36]]],
  ['muhammad', 'محمد ﷺ', [[17, 1, 1], [9, 40, 40], [53, 1, 18], [93, 1, 11], [94, 1, 8], [33, 40, 40], [48, 29, 29]]],
];

const refText = (s, a, b) => `${getSurahMeta(s).nameAr} ${a === b ? ar(a) : `${ar(a)}–${ar(b)}`}`;
const count = (list) => list.reduce((n, [, a, b]) => n + b - a + 1, 0);
const ayatWord = (n) => (n === 1 ? 'آية' : n === 2 ? 'آيتان' : n <= 10 ? `${ar(n)} آيات` : `${ar(n)} آية`);

export async function renderProphets(params) {
  if (!params.id) {
    return mount(h('div.prophets-page',
      topbar({ title: 'قصص الأنبياء', sub: 'كما جاءت في القرآن الكريم', back: '#/quran' }),
      h('ol.nw-list', PROPHETS.map(([id, name, list], i) => h('li', h('a.card.nw-item', { href: `#/prophets/${id}` },
        h('span.nw-num', ar(i + 1)), h('span.nw-title', name, h('small.tw-intro', `${ar(list.length)} ${list.length > 2 && list.length < 11 ? 'مواضع' : 'موضع'}، ${ayatWord(count(list))}`))))))));
  }
  const i = PROPHETS.findIndex((p) => p[0] === params.id);
  if (i < 0) return navigate('/prophets', { replace: true });
  const [, name, list] = PROPHETS[i];
  const next = PROPHETS[i + 1];
  const box = h('div.pr-passages');
  const stories = await loadStories('prophets').catch(() => null);
  const story = stories?.find((x) => x.id === params.id);
  const storyBody = story ? await storyNodes(story) : null;
  mount(h('div.prophets-page',
    topbar({ title: name, sub: story ? readLabel(story) : `${ar(list.length)} ${list.length > 2 && list.length < 11 ? 'مواضع' : 'موضع'} في القرآن`, back: '#/prophets' }),
    story ? h('header.sh-head', h('span.eyebrow', 'من قصص الأنبياء'), h('h1', name), h('p.muted', story.title)) : null,
    story ? h('article.card.st-body', ...storyBody) : null,
    story ? h('h2.lib-h', 'مواضع القصة في القرآن، قراءةً واستماعًا') : null,
    box,
    next ? h('a.btn.block', { href: `#/prophets/${next[0]}` }, next[1], icon('back')) : null));
  for (const [s, a, b] of list) {
    const ayahs = (await getSurahText(s)).slice(a - 1, b);
    const nodes = (n) => ayahs.slice(0, n).map((t, k) => [t, h('span.pr-n', ` ﴿${ar(a + k)}﴾ `)]).flat();
    const long = ayahs.length > 3;
    const text = h('p.pr-text', { lang: 'ar' }, nodes(long ? 3 : ayahs.length), long ? '…' : '');
    let open = false;
    box.append(h('section.card.pr-card',
      h('div.pr-head', h('strong', refText(s, a, b)), h('small', ayatWord(b - a + 1))),
      text,
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: () => player.playFrom(s, a, b > a ? { range: { from: { surah: s, ayah: a }, to: { surah: s, ayah: b }, times: 1 } } : { only: true, times: 1 }) }, icon('play'), 'استمع'),
        long ? h('button.btn.ghost', { type: 'button', onclick: (e) => { open = !open; text.replaceChildren(...nodes(open ? ayahs.length : 3), open ? '' : '…'); e.currentTarget.textContent = open ? 'أخفِ' : 'اقرأ كاملًا'; } }, 'اقرأ كاملًا') : null,
        h('a.btn.ghost', { href: `#/surah/${s}/${a}` }, 'في المصحف'))));
  }
}
