// الرقية الشرعية: آيات الرقية (من نص المصحف) والأدعية النبوية الصحيحة، مع الاستماع المتواصل بصوت القارئ المختار
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { mount, topbar, toast } from '../ui.js';
import { player, getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import { sleepSheet, sleepState } from '../audio/sleepTimer.js';
import * as settings from '../state.js';
import { VERSE_GROUPS, DUAS, GUIDE } from '../features/ruqyah.js';
import * as RP from '../features/ruqyahPlayer.js';

const TAB_KEY = 'qa:ruqyahTab';
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* التخزين محظور */ } };
const refText = ([s, f, t]) => `سورة ${getSurahMeta(s).nameAr}، ${f === t ? `الآية ${ar(f)}` : `الآيات ${ar(f)}–${ar(t)}`}`;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch { toast('تعذر النسخ'); }
}

export async function renderRuqyah(_p, query, isStale) {
  // نص الآيات من المصحف نفسه
  const surahs = [...new Set(VERSE_GROUPS.flatMap((g) => g.items.map((x) => x[0])))];
  const texts = Object.fromEntries(await Promise.all(surahs.map(async (s) => [s, await getSurahText(s)])));
  if (isStale()) return;
  const all = VERSE_GROUPS.flatMap((g) => g.items);
  const ayahs = ([s, f, t]) => texts[s].slice(f - 1, t).map((x, i) => `${x} ﴿${ar(f + i)}﴾`).join(' ');

  // ===== بطاقة الاستماع =====
  let chosen;
  try { chosen = new Set(JSON.parse(load('qa:ruqyahGroups', 'null')) || VERSE_GROUPS.map((g) => g.id)); } catch { chosen = new Set(VERSE_GROUPS.map((g) => g.id)); }
  const playlist = () => VERSE_GROUPS.filter((g) => chosen.has(g.id)).flatMap((g) => g.items);
  const repeat = h('input', { type: 'checkbox', role: 'switch', checked: load('qa:ruqyahLoop') === '1' });
  repeat.addEventListener('change', () => { save('qa:ruqyahLoop', repeat.checked ? '1' : '0'); RP.setLoop(repeat.checked); });
  const now = h('small.rq-now', { 'aria-live': 'polite' });
  const playBtn = h('button.btn.rq-play', { type: 'button' });
  const reciterName = h('span');
  const sleepLabel = h('span');
  const groupChips = h('div.notify-chips', VERSE_GROUPS.map((g) => h('button.pb-chip', {
    type: 'button', 'aria-pressed': String(chosen.has(g.id)),
    onclick: (e) => {
      if (chosen.has(g.id) && chosen.size === 1) return toast('اختر مجموعة واحدة على الأقل');
      chosen.has(g.id) ? chosen.delete(g.id) : chosen.add(g.id);
      e.currentTarget.setAttribute('aria-pressed', String(chosen.has(g.id)));
      save('qa:ruqyahGroups', JSON.stringify([...chosen]));
    },
  }, g.title)));
  let btnKey = '';
  const paintListen = () => {
    const rs = RP.state(), st = player.state();
    const playing = rs.active && (st.status === 'playing' || st.status === 'loading');
    const k = playing ? 'pause' : rs.active ? 'resume' : 'start';
    if (k !== btnKey) { btnKey = k; playBtn.replaceChildren(icon(playing ? 'pause' : 'play'), h('span', playing ? 'إيقاف مؤقت' : rs.active ? 'متابعة' : 'استمع للرقية')); }
    now.textContent = rs.active && rs.item ? `${ar(rs.idx + 1)} من ${ar(rs.total)}: ${rs.item[3]}` : `${ar(playlist().length)} موضعًا بصوت القارئ المختار`;
    reciterName.textContent = getReciter(settings.get('reciter'))?.nameAr || '';
    sleepLabel.textContent = sleepState() ? `مؤقت النوم: ${sleepState()}` : 'مؤقت النوم';
  };
  playBtn.onclick = () => {
    const rs = RP.state();
    if (rs.active) return player.toggle();
    RP.playRuqyah(playlist(), { repeat: repeat.checked });
  };
  const listenCard = h('section.card.rq-listen',
    h('div.rq-head', h('span.lib-icon', { 'aria-hidden': 'true' }, icon('shield')), h('span', h('strong', 'الاستماع المتواصل'), now)),
    playBtn,
    h('div.field', h('span', 'المواضع'), groupChips),
    h('label.toggle', h('span', h('strong', 'تكرار الرقية'), h('small', 'تُعاد من أولها بعد انتهائها')), repeat),
    h('div.rq-tools',
      h('button.btn.ghost', { type: 'button', onclick: () => reciterSheet() }, icon('user'), reciterName),
      h('button.btn.ghost', { type: 'button', onclick: () => sleepSheet() }, icon('timer'), sleepLabel)));

  // ===== الآيات =====
  const playOne = (x) => RP.playRuqyah([x]);
  const versesPane = h('div.rq-pane', VERSE_GROUPS.map((g) => h('section.rq-group',
    h('h2.lib-h', g.title),
    h('p.small-note', g.note),
    h('ol.dua-list', g.items.map((x) => h('li.card.dua-card',
      h('strong.dua-title', x[3]),
      h('p.dua-text', { lang: 'ar' }, ayahs(x)),
      x[4] ? h('p.rq-evidence', x[4]) : null,
      h('div.dua-foot',
        h('a.dua-ref', { href: `#/surah/${x[0]}/${x[1]}` }, refText(x)),
        h('span.dua-actions',
          h('button.icon-btn', { type: 'button', 'aria-label': `استماع: ${x[3]}`, onclick: () => playOne(x) }, icon('play')),
          h('button.icon-btn', { type: 'button', 'aria-label': 'نسخ', onclick: () => copy(`${ayahs(x)}\n[${refText(x)}]`) }, icon('copy'))))))))),
  h('p.small-note.rq-method', 'كان النبي ﷺ إذا اشتكى قرأ على نفسه بالمعوذات ونفث، ومسح بيده. ويُرقى المريض بالقراءة عليه مع النفث، ويضع يده على موضع الألم.'));

  // ===== الأدعية =====
  const counter = (d) => {
    let left = d.count;
    const b = h('button.btn.ghost.rq-count', { type: 'button' });
    const paint = () => { b.textContent = !left ? 'تم ✓' : left === d.count ? `${ar(d.count)} مرات` : `باقي ${ar(left)}`; b.setAttribute('aria-label', `عدّاد: ${b.textContent}`); };
    b.onclick = () => { left = left ? left - 1 : d.count; if (!left && navigator.vibrate) navigator.vibrate(30); paint(); };
    paint();
    return b;
  };
  const duasPane = h('div.rq-pane', h('ol.dua-list', DUAS.map((d) => h('li.card.dua-card',
    h('p.dua-text.rq-dua', { lang: 'ar' }, d.text),
    h('small.rq-when', d.when),
    h('div.dua-foot',
      h('span.dua-ref', d.source),
      h('span.dua-actions',
        d.count > 1 ? counter(d) : null,
        h('button.icon-btn', { type: 'button', 'aria-label': 'نسخ', onclick: () => copy(`${d.text}\n[${d.source}]`) }, icon('copy'))))))));

  // ===== الدليل =====
  const guidePane = h('div.rq-pane.rq-guide', GUIDE.map((g, i) => h('details.card.rq-sec', { open: i === 0 },
    h('summary', h('strong', g.title)),
    h('ul.rq-points', g.points.map((x) => h('li', h('p', x.t), x.s ? h('small.dua-ref', x.s) : null))))));

  // ===== التبويبات =====
  let tab = query.tab || load(TAB_KEY, 'verses');
  if (!['verses', 'duas', 'guide'].includes(tab)) tab = 'verses';
  const panes = { verses: versesPane, duas: duasPane, guide: guidePane };
  const tabs = h('div.seg', { role: 'tablist', 'aria-label': 'أقسام الرقية' }, [['verses', `الآيات (${ar(all.length)})`], ['duas', `الأدعية (${ar(DUAS.length)})`], ['guide', 'الدليل']].map(([id, label]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(tab === id),
    onclick: (e) => { tab = id; save(TAB_KEY, id); for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); show(); },
  }, label)));
  const show = () => { for (const [id, el] of Object.entries(panes)) el.hidden = id !== tab; };
  show();

  mount(h('div.ruqyah-page',
    topbar({ title: 'الرقية الشرعية', sub: 'من القرآن الكريم والسنة الصحيحة' }),
    listenCard, tabs, versesPane, duasPane, guidePane));
  paintListen();
  const un1 = RP.subscribe(paintListen), un2 = player.subscribe(paintListen);
  const timer = setInterval(paintListen, 15000);
  return { cleanup() { un1(); un2(); clearInterval(timer); } };
}
