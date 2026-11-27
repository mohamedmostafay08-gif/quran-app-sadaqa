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
  // «الرقية كاملة»: كل المواضع بترتيب المصحف (تبدأ بالفاتحة وتُختم بالمعوذات)، أو «اختر المواضع» بقائمة اختيار
  const keyOf = (x) => `${x[0]}:${x[1]}-${x[2]}`;
  const byMushaf = (a, b) => a[0] - b[0] || a[1] - b[1];
  let mode = load('qa:ruqyahMode', 'full') === 'custom' ? 'custom' : 'full';
  let picked;
  try { picked = new Set(JSON.parse(load('qa:ruqyahPicked', 'null')) || all.map(keyOf)); } catch { picked = new Set(all.map(keyOf)); }
  const playlist = () => (mode === 'full' ? all : all.filter((x) => picked.has(keyOf(x)))).slice().sort(byMushaf);
  // تغيّرت المواضع: إن كانت الرقية تعمل تبدأ القائمة الجديدة فورًا
  const changed = () => {
    save('qa:ruqyahMode', mode);
    save('qa:ruqyahPicked', JSON.stringify([...picked]));
    if (RP.replaceQueue(playlist())) toast('بدأت الرقية بالمواضع الجديدة');
    paintListen();
  };
  const repeat = h('input', { type: 'checkbox', role: 'switch', checked: load('qa:ruqyahLoop') === '1' });
  repeat.addEventListener('change', () => { save('qa:ruqyahLoop', repeat.checked ? '1' : '0'); RP.setLoop(repeat.checked); });
  const now = h('small.rq-now', { 'aria-live': 'polite' });
  const playBtn = h('button.btn.rq-play', { type: 'button' });
  const reciterName = h('span');
  const fallbackNote = h('p.small-note.rq-fallback', { hidden: true });
  const sleepLabel = h('span');

  // قائمة الاختيار: لكل مجموعة زر «الكل» ومربعات للمواضع
  const boxes = [];
  const groupAll = [];
  const syncGroup = (g, btn) => { const n = g.items.filter((x) => picked.has(keyOf(x))).length; btn.textContent = n === g.items.length ? 'إلغاء الكل' : 'تحديد الكل'; };
  const picker = h('div.rq-picker', VERSE_GROUPS.map((g) => {
    const allBtn = h('button.btn.ghost.rq-all', { type: 'button' });
    const items = g.items.map((x) => {
      const cb = h('input', { type: 'checkbox', checked: picked.has(keyOf(x)) });
      cb.addEventListener('change', () => {
        if (!cb.checked && picked.size === 1) { cb.checked = true; return toast('اختر موضعًا واحدًا على الأقل'); }
        cb.checked ? picked.add(keyOf(x)) : picked.delete(keyOf(x));
        syncGroup(g, allBtn); changed();
      });
      boxes.push([x, cb]);
      return h('label.rq-pick', cb, h('span', x[3]), h('small', refText(x)));
    });
    allBtn.onclick = () => {
      const on = g.items.every((x) => picked.has(keyOf(x)));
      for (const x of g.items) on ? picked.delete(keyOf(x)) : picked.add(keyOf(x));
      if (!picked.size) { for (const x of g.items) picked.add(keyOf(x)); return toast('اختر موضعًا واحدًا على الأقل'); }
      for (const [y, cb] of boxes) cb.checked = picked.has(keyOf(y));
      syncGroup(g, allBtn); changed();
    };
    syncGroup(g, allBtn);
    groupAll.push(allBtn);
    return h('fieldset.rq-pgroup', h('legend', h('strong', g.title), allBtn), items);
  }));
  const modeSeg = h('div.seg', { role: 'radiogroup', 'aria-label': 'ما يُشغَّل' }, [['full', 'الرقية كاملة'], ['custom', 'اختر المواضع']].map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(mode === v),
    onclick: (e) => { if (mode === v) return; mode = v; for (const b of modeSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); picker.hidden = mode !== 'custom'; changed(); },
  }, label)));
  picker.hidden = mode !== 'custom';

  let btnKey = '';
  const paintListen = () => {
    const rs = RP.state(), st = player.state();
    const playing = rs.active && (st.status === 'playing' || st.status === 'loading');
    const k = playing ? 'pause' : rs.active ? 'resume' : 'start';
    if (k !== btnKey) { btnKey = k; playBtn.replaceChildren(icon(playing ? 'pause' : 'play'), h('span', playing ? 'إيقاف مؤقت' : rs.active ? 'متابعة' : 'استمع للرقية')); }
    const n = playlist().length;
    now.textContent = rs.active && rs.item ? `${ar(rs.idx + 1)} من ${ar(rs.total)}: ${rs.item[3]}` : mode === 'full' ? `الرقية كاملة: ${ar(n)} موضعًا بترتيب المصحف` : `${ar(n)} ${n === 1 ? 'موضع' : n <= 10 ? 'مواضع' : 'موضعًا'} مختارة`;
    const eff = getReciter(RP.effectiveReciter())?.nameAr || '';
    reciterName.textContent = eff;
    fallbackNote.hidden = !RP.usesFallback();
    if (RP.usesFallback()) fallbackNote.textContent = `تلاوة «${getReciter(settings.get('reciter'))?.nameAr || ''}» مسجّلة سورًا كاملة بلا توقيت للآيات، فتُشغَّل الرقية بصوت ${eff}. يمكنك اختيار قارئ آخر.`;
    sleepLabel.textContent = sleepState() ? `مؤقت النوم: ${sleepState()}` : 'مؤقت النوم';
  };
  playBtn.onclick = () => (RP.state().active ? RP.toggle() : RP.playRuqyah(playlist(), { repeat: repeat.checked }));
  const listenCard = h('section.card.rq-listen',
    h('div.rq-head', h('span.lib-icon', { 'aria-hidden': 'true' }, icon('shield')), h('span', h('strong', 'الاستماع المتواصل'), now)),
    playBtn,
    modeSeg,
    picker,
    h('label.toggle', h('span', h('strong', 'تكرار الرقية'), h('small', 'تُعاد من أولها بعد انتهائها')), repeat),
    h('div.rq-tools',
      h('button.btn.ghost', { type: 'button', 'aria-label': 'تغيير القارئ', onclick: () => reciterSheet() }, icon('user'), reciterName),
      h('button.btn.ghost', { type: 'button', onclick: () => sleepSheet() }, icon('timer'), sleepLabel)),
    fallbackNote);

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
  const un3 = settings.subscribe((k) => { if (k === 'reciter') paintListen(); });
  const timer = setInterval(paintListen, 15000);
  return { cleanup() { un1(); un2(); un3(); clearInterval(timer); } };
}
