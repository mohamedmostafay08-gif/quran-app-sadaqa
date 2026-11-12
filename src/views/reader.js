// شاشة القراءة
import { h, icon, ar, throttle } from '../lib/dom.js';
import { getSurahMeta, getSurahText, boundariesAt, juzOf, pageOf, quarterLabel } from '../data.js';
import * as settings from '../state.js';
import * as bookmarks from '../features/bookmarks.js';
import * as notes from '../features/notes.js';
import { mount, topbar, sheet, actionRow, toast } from '../ui.js';
import { player, getReciters } from '../audio/player.js';
import { getTajweed, getWords, getTafsir, getTranslation, getTranslations, isWordToken, TAJWEED_RULES, TAFSIRS } from '../features/extra.js';
import { navigate } from '../router.js';
import { shareCardSheet } from '../features/shareCard.js';
import { shareAudioSheet } from '../features/shareAudio.js';
import { track } from '../features/stats.js';
import { setupImmersive, gestureHintOnce } from '../features/immersive.js';

export async function renderReader(params, _q, isStale) {
  const n = Math.min(114, Math.max(1, parseInt(params.surah, 10) || 1));
  const target = params.ayah ? parseInt(params.ayah, 10) : null;
  if (settings.get('readMode') === 'pages') { navigate(`/page/${pageOf(n, target || 1)}`, { replace: true }); return; }
  const meta = getSurahMeta(n);
  const useTajweed = settings.get('tajweed');
  const transId = settings.get('translation');
  const [ayahs, marked, noted, tajweed, trans, transList] = await Promise.all([
    getSurahText(n), bookmarks.bookmarkedIn(n), notes.inSurah(n),
    useTajweed ? getTajweed().catch(() => null) : null,
    transId ? getTranslation(transId, n).catch(() => null) : null,
    transId ? getTranslations().catch(() => []) : [],
  ]);
  const transInfo = trans && transList.find((t) => t.id === transId);
  if (trans) track('translation');
  if (isStale()) return;
  const wordTap = settings.get('wordTap');

  // مع الترجمة: كل آية في سطر وتحتها معناها
  const layout = trans ? 'list' : settings.get('layout');
  const showMarks = settings.get('showPageMarks');
  let currentTop = target || 1;
  const sub = h('p.reader-sub', `الجزء ${ar(juzOf(n, 1))}، صفحة ${ar(pageOf(n, 1))}`);

  const playBtn = h('button.icon-btn.play-main', { type: 'button', 'aria-label': 'تشغيل السورة', onclick: () => togglePlaySurah(n) }, icon('play'));
  const head = topbar({
    title: `سورة ${meta.nameAr}`,
    back: '#/quran',
    actions: [playBtn,
      h('button.icon-btn', { type: 'button', 'aria-label': 'عرض الصفحات (مصحف المدينة)', title: 'عرض الصفحات', onclick: () => { settings.set('readMode', 'pages'); navigate(`/page/${pageOf(n, currentTop || 1)}`); } }, icon('pages')),
      h('button.icon-btn', { type: 'button', 'aria-label': 'خيارات العرض', onclick: () => displaySheet() }, icon('more'))],
  });
  head.querySelector('.topbar-title').append(sub);

  const container = h(`div.ayahs.${layout}`, { lang: 'ar', class: `ayahs ${layout}${useTajweed ? ' tajweed' : ''}${wordTap ? ' word-tap' : ''}` });
  const frag = document.createDocumentFragment();
  ayahs.forEach((text, i) => {
    const a = i + 1;
    if (showMarks) {
      const b = boundariesAt(n, a);
      if (a > 1 && b.page) frag.append(h('div.mark-page', { 'aria-label': `بداية الصفحة ${b.page}` }, h('span', `صفحة ${ar(b.page)}`)));
      if (b.juz || b.quarter) {
        frag.append(h('div.mark-juz', b.juz ? `الجزء ${ar(b.juz)}` : quarterLabel(b.quarter).replace(/\d+/g, ar)));
      }
    }
    const note = noted.get(a);
    const parts = ayahNodes(text, tajweed?.ayahs[`${n}:${a}`], tajweed?.rules);
    const last = parts.pop();
    const span = h('span.ayah', {
      dataset: { a },
      tabindex: '0',
      role: 'button',
      class: ayahClass(marked.has(a), note),
    },
    // آخر كلمة + رقم الآية في وحدة لا تنكسر (حتى لا يسقط الرقم وحده في سطر)
    parts, h('span.ayah-end', last, '\u00A0', h('span.ayah-num', { 'aria-hidden': 'true' }, '\u06DD' + ar(a)), h('span.sr-only', ` (الآية ${a})`)));
    frag.append(span);
    if (trans) frag.append(h('p.trans', { lang: transInfo?.lang, dir: transInfo?.dir || 'ltr' }, trans[i]));
    if (layout === 'flow') frag.append(' ');
  });
  container.append(frag);

  const onActivate = (e) => {
    const el = e.target.closest('.ayah');
    if (!el) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const w = e.type === 'click' && wordTap ? e.target.closest('.w[data-w]') : null;
    if (e.type === 'keydown') return ayahSheet(n, +el.dataset.a, el);
    // ضغطتان سريعتان على الآية = تشغيل منها؛ ضغطة واحدة = القائمة (أو معنى الكلمة)
    if (tapTimer && tapEl === el) {
      clearTimeout(tapTimer); tapTimer = null;
      player.playFrom(n, +el.dataset.a, { noBasmala: true });
      toast(`تشغيل من الآية ${ar(+el.dataset.a)}`);
      return;
    }
    clearTimeout(tapTimer);
    tapEl = el;
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (w) wordSheet(n, +el.dataset.a, +w.dataset.w, w);
      else ayahSheet(n, +el.dataset.a, el);
    }, 260);
  };
  let tapTimer = null, tapEl = null;
  container.addEventListener('click', onActivate);
  container.addEventListener('keydown', onActivate);

  const prev = n > 1 ? getSurahMeta(n - 1) : null;
  const next = n < 114 ? getSurahMeta(n + 1) : null;

  const el = h('article.reader',
    head,
    h('section.surah-head',
      h('div.surah-frame',
        h('h2', `سورة ${meta.nameAr}`),
        h('p', `${meta.revelation === 'Meccan' ? 'مكية' : 'مدنية'}، ${ar(meta.ayahCount)} آية، ترتيب النزول ${ar(meta.order)}`),
      ),
      meta.basmala ? h('p.basmala', { lang: 'ar' }, meta.basmala) : null,
    ),
    container,
    h('nav.surah-nav', { 'aria-label': 'السور المجاورة' },
      prev ? h('a.btn.ghost', { href: `#/surah/${n - 1}` }, icon('back'), `سورة ${prev.nameAr}`) : h('span'),
      next ? h('a.btn.ghost', { href: `#/surah/${n + 1}` }, `سورة ${next.nameAr}`, icon('forward')) : h('span'),
    ),
  );
  mount(el);

  // ---- الانتقال لآية محددة ----
  const scrollToAyah = (a, flash) => {
    const t = container.querySelector(`.ayah[data-a="${a}"]`);
    if (!t) return;
    t.scrollIntoView({ block: 'center', behavior: flash ? 'auto' : 'smooth' });
    if (flash) { t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2200); }
  };
  if (target) requestAnimationFrame(() => scrollToAyah(target, true));

  // ---- تتبع موضع القراءة (أعلى آية ظاهرة) ----
  const save = throttle((a) => bookmarks.saveLastRead(n, a), 800);
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const a = +en.target.dataset.a;
      if (en.isIntersecting) visible.add(a); else visible.delete(a);
    }
    if (!visible.size) return;
    const top = Math.min(...visible);
    currentTop = top;
    sub.textContent = `الجزء ${ar(juzOf(n, top))}، صفحة ${ar(pageOf(n, top))}`;
    save(top);
  }, { rootMargin: '-15% 0px -55% 0px' });
  container.querySelectorAll('.ayah').forEach((x) => io.observe(x));

  // ---- مزامنة مع المشغل ----
  let activeEl = null;
  const syncPlayer = () => {
    const st = player.state();
    const playingHere = st.surah === n && st.status !== 'idle';
    playBtn.replaceChildren(icon(playingHere && st.status === 'playing' ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', playingHere && st.status === 'playing' ? 'إيقاف مؤقت' : 'تشغيل السورة');
    const nextEl = !playingHere ? null : st.ayah === 0 ? el.querySelector('.basmala') : container.querySelector(`.ayah[data-a="${st.ayah}"]`);
    if (nextEl !== activeEl) {
      activeEl?.classList.remove('active');
      activeEl?.removeAttribute('aria-current');
      activeEl = nextEl;
      if (activeEl) {
        activeEl.classList.add('active');
        activeEl.setAttribute('aria-current', 'true');
        if (settings.get('autoScroll')) {
          const r = activeEl.getBoundingClientRect();
          const bottomLimit = innerHeight - 180;
          if (r.top < 70 || r.bottom > bottomLimit) activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
  };
  const unsub = player.subscribe(syncPlayer);
  syncPlayer();

  const stopImmersive = setupImmersive({ n, container });
  gestureHintOnce();

  return {
    cleanup() { io.disconnect(); unsub(); stopImmersive(); clearTimeout(tapTimer); },
  };
}

function togglePlaySurah(n) {
  const st = player.state();
  if (st.surah === n && st.status === 'playing') return player.pause();
  if (st.surah === n && st.status === 'paused') return player.resume();
  const last = settings.get('lastRead');
  const from = last && last.surah === n ? last.ayah : 1;
  player.playFrom(n, from);
}

export async function ayahSheet(n, a, el) {
  const meta = getSurahMeta(n);
  const text = (await getSurahText(n))[a - 1];
  const isMarked = await bookmarks.has(n, a);
  const note = await notes.get(n, a);
  const ref = `سورة ${meta.nameAr} – الآية ${ar(a)}`;
  const shareText = `﴿${text}﴾\n[${ref}]`;
  sheet({
    title: ref,
    content: (close) => [
      h('p.sheet-quote', { lang: 'ar' }, text),
      note?.text ? h('p.sheet-note', note.text) : null,
      h('div.action-list',
        actionRow('play', 'تشغيل من هذه الآية', () => { close(); player.playFrom(n, a); }),
        actionRow('repeat', 'تكرار هذه الآية', () => { close(); player.playFrom(n, a, { only: true }); }),
        actionRow('compare', 'مقارنة القراء', () => { close(); compareSheet(n, a); }),
        actionRow('book', 'التفسير (الميسر والسعدي)', () => { close(); tafsirSheet(n, a); }),
        actionRow('info', 'معاني الكلمات وجذورها', () => { close(); wordsListSheet(n, a); }),
        actionRow(isMarked ? 'bookmarkFill' : 'bookmark', isMarked ? 'إزالة العلامة' : 'إضافة علامة', async () => {
          const on = await bookmarks.toggle(n, a);
          if (el) el.className = ayahClass(on, await notes.get(n, a));
          toast(on ? 'تمت إضافة العلامة' : 'تمت إزالة العلامة');
          close();
        }),
        actionRow('note', note ? 'تعديل الملاحظة والتظليل' : 'ملاحظة وتظليل', () => { close(); noteSheet(n, a, el); }),
        actionRow('copy', 'نسخ الآية', async () => {
          try { await navigator.clipboard.writeText(shareText); toast('تم النسخ'); }
          catch { toast('تعذر النسخ'); }
          close();
        }),
        actionRow('share', 'بطاقة مشاركة (صورة)', () => { close(); shareCardSheet(n, a); }),
        actionRow('play', 'مقطع صوتي من الآية (مشاركة/تنزيل)', () => { close(); shareAudioSheet(n, a); }),
        navigator.share ? actionRow('share', 'مشاركة كنص', async () => {
          close();
          try { await navigator.share({ text: shareText }); } catch { /* أُلغيت */ }
        }) : null,
      ),
    ],
  });
}

function displaySheet() {
  sheet({
    title: 'خيارات العرض',
    content: () => {
      const scale = h('input', { type: 'range', min: '0.8', max: '2', step: '0.1', value: String(settings.get('fontScale')), 'aria-label': 'حجم الخط' });
      scale.addEventListener('input', () => settings.set('fontScale', +scale.value));
      const seg = (key, opts) => h('div.seg', { role: 'radiogroup' }, opts.map(([v, label]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(settings.get(key) === v),
        onclick: (e) => {
          settings.set(key, v);
          for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
          if (key === 'layout' || key === 'tajweed' || key === 'wordTap') dispatchEvent(new HashChangeEvent('hashchange'));
        },
      }, label)));
      return h('div.form',
        h('label.field', h('span', 'حجم الخط'), h('div.range-row', h('span.small', 'أ'), scale, h('span.large', 'أ'))),
        h('div.field', h('span', 'الثيم'), seg('theme', [['auto', 'تلقائي'], ['light', 'فاتح'], ['sepia', 'سيبيا'], ['dark', 'ليلي']])),
        h('div.field', h('span', 'طريقة العرض'), seg('layout', [['flow', 'متصل'], ['list', 'آية في سطر']])),
        h('div.field', h('span', 'ألوان التجويد'), seg('tajweed', [[false, 'بدون'], [true, 'ملوّن']])),
        h('div.field', h('span', 'الضغط على كلمة'), seg('wordTap', [[false, 'يفتح الآية'], [true, 'يعرض معناها وجذرها']])),
        translationPicker(),
        settings.get('tajweed') ? tajweedLegend() : null,
      );
    },
  });
}

/** اختيار ترجمة المعاني تحت الآيات */
export function translationPicker() {
  const sel = h('select', { 'aria-label': 'ترجمة المعاني' }, h('option', { value: '' }, 'بدون ترجمة'));
  getTranslations().then((list) => {
    for (const t of list) sel.append(h('option', { value: t.id, selected: settings.get('translation') === t.id }, t.name));
  }).catch(() => sel.append(h('option', { disabled: true }, 'القائمة تحتاج اتصالًا لأول مرة')));
  sel.addEventListener('change', () => { settings.set('translation', sel.value || null); if (location.hash.startsWith('#/surah/')) dispatchEvent(new HashChangeEvent('hashchange')); });
  return h('label.field', h('span', 'ترجمة المعاني تحت الآيات'), sel);
}

const DEFAULT_COMPARE = ['123', '118', '112', '53']; // العفاسي، الحصري، المنشاوي، عبدالباسط

function compareSheet(n, a) {
  const chosen = new Set(DEFAULT_COMPARE);
  sheet({
    title: `مقارنة القراء – الآية ${ar(a)}`,
    content: (close) => {
      const list = h('ul.choice-list', getReciters().filter((r) => !r.untimed).map((r) => {
        const b = h('button.choice', { type: 'button', 'aria-pressed': String(chosen.has(r.id)), onclick: () => {
          if (chosen.has(r.id)) chosen.delete(r.id); else chosen.add(r.id);
          b.setAttribute('aria-pressed', String(chosen.has(r.id)));
          b.querySelector('svg')?.remove();
          if (chosen.has(r.id)) b.append(icon('check'));
        } }, h('span', h('strong', r.nameAr), h('small', r.style)), chosen.has(r.id) ? icon('check') : null);
        return h('li', b);
      }));
      return h('div',
        h('p.muted', 'اختر القراء، وستُتلى الآية بصوت كل واحد منهم بالترتيب.'),
        list,
        h('button.btn.block', { type: 'button', onclick: () => {
          const ids = getReciters().map((r) => r.id).filter((id) => chosen.has(id));
          if (ids.length < 2) return toast('اختر قارئين على الأقل');
          close();
          player.compare(n, a, ids);
        } }, icon('play'), 'ابدأ المقارنة'),
      );
    },
  });
}

function ayahClass(bookmarked, note) {
  return 'ayah' + (bookmarked ? ' bookmarked' : '') + (note?.color ? ` hl-${note.color}` : '') + (note?.text ? ' has-note' : '');
}

async function noteSheet(n, a, el) {
  const current = await notes.get(n, a);
  let color = current?.color || null;
  const ta = h('textarea.note-input', { rows: 4, placeholder: 'اكتب ملاحظتك أو تدبرك…', 'aria-label': 'نص الملاحظة' });
  ta.value = current?.text || '';
  const swatches = h('div.swatches', { role: 'radiogroup', 'aria-label': 'لون التظليل' },
    [{ id: null, name: 'بدون' }, ...notes.COLORS].map((c) => h('button', {
      type: 'button', role: 'radio', class: `swatch sw-${c.id || 'none'}`, 'aria-checked': String(color === c.id), 'aria-label': c.name, title: c.name,
      onclick: (e) => {
        color = c.id;
        for (const b of swatches.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      },
    })));
  sheet({
    title: `ملاحظة – سورة ${getSurahMeta(n).nameAr} ${ar(a)}`,
    content: (close) => h('div.form',
      h('div.field', h('span', 'التظليل'), swatches),
      h('label.field', h('span', 'الملاحظة'), ta),
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: async () => {
          const saved = await notes.save(n, a, { text: ta.value, color });
          if (el) el.className = ayahClass(await bookmarks.has(n, a), saved);
          toast(saved ? 'تم الحفظ' : 'تم الحذف');
          close();
        } }, icon('check'), 'حفظ'),
        current ? h('button.btn.ghost.danger', { type: 'button', onclick: async () => {
          await notes.save(n, a, {});
          if (el) el.className = ayahClass(await bookmarks.has(n, a), null);
          toast('تم الحذف'); close();
        } }, icon('trash'), 'حذف') : null,
      ),
    ),
  });
}

/**
 * يبني عُقد نص الآية: كل كلمة span.w (data-w = رقمها الصرفي)، وداخلها مقاطع التجويد الملونة.
 * يرجع مصفوفة: [كلمة، ' '، كلمة، …] — آخر عنصر هو آخر كلمة (لتُلصق برقم الآية).
 */
function ayahNodes(text, ranges, rules) {
  const toks = [];
  let pos = 0, wi = 0;
  for (const t of text.split(' ')) {
    toks.push({ t, start: pos, end: pos + t.length, w: isWordToken(t) ? ++wi : 0 });
    pos += t.length + 1;
  }
  const out = [];
  toks.forEach((tok, i) => {
    let inner;
    if (ranges && ranges.length) {
      inner = [];
      let cur = tok.start;
      for (const [rs, re, r] of ranges) {
        if (re <= tok.start || rs >= tok.end) continue;
        const s0 = Math.max(rs, tok.start), e0 = Math.min(re, tok.end);
        if (s0 > cur) inner.push(text.slice(cur, s0));
        inner.push(h('span', { class: `tj tj-${rules[r]}` }, text.slice(s0, e0)));
        cur = e0;
      }
      if (cur < tok.end) inner.push(text.slice(cur, tok.end));
    } else inner = [tok.t];
    const node = tok.w ? h('span.w', { dataset: { w: tok.w } }, inner) : h('span.wm', inner);
    if (i < toks.length - 1) out.push(node, ' ');
    else out.push(node);
  });
  return out;
}

async function wordSheet(n, a, w, el) {
  const meta = getSurahMeta(n);
  let words = null;
  try { words = (await getWords(n))[a - 1]; } catch { /* أوفلاين ولم تُحمّل */ }
  const info = words?.[w - 1];
  const rulesHere = [...el.querySelectorAll('.tj')].map((x) => [...x.classList].find((c) => c.startsWith('tj-'))?.slice(3)).filter((r, i, arr) => r && arr.indexOf(r) === i);
  sheet({
    title: `سورة ${meta.nameAr}، ${ar(a)}، الكلمة ${ar(w)}`,
    content: (close) => h('div.word-info',
      h('p.word-big', { lang: 'ar' }, el.textContent),
      info ? h('dl.word-dl',
        info.gloss ? [h('dt', 'المعنى (إنجليزي)'), h('dd', { lang: 'en', dir: 'ltr' }, info.gloss)] : null,
        [h('dt', 'نوع الكلمة'), h('dd', info.pos + (info.extra ? ` (${info.extra})` : ''))],
        info.root ? [h('dt', 'الجذر'), h('dd', h('button.root-chip', { type: 'button', onclick: () => { close(); navigate('/search?root=' + encodeURIComponent(info.root)); } }, info.root.split('').join(' '), icon('search')))] : null,
        info.lemma ? [h('dt', 'الأصل (اللَّمّة)'), h('dd', { lang: 'ar', class: 'lemma' }, info.lemma)] : null,
      ) : h('p.muted', words === null ? 'بيانات الكلمات غير متاحة حاليًا (تحتاج اتصالًا لأول مرة).' : 'لا تتوفر بيانات لهذه الكلمة.'),
      rulesHere.length ? h('div.tj-rules', h('h3', 'أحكام التجويد في الكلمة'), rulesHere.map((r) => h('p', h('span', { class: `tj-dot tj-${r}` }), h('strong', TAJWEED_RULES[r]?.name || r), ' — ', TAJWEED_RULES[r]?.desc || ''))) : null,
      h('button.btn.ghost.block', { type: 'button', onclick: () => { close(); ayahSheet(n, a, el.closest('.ayah')); } }, 'خيارات الآية'),
    ),
  });
}

async function tafsirSheet(n, a) {
  const meta = getSurahMeta(n);
  track('tafsir');
  let which = settings.get('tafsir') in TAFSIRS ? settings.get('tafsir') : 'muyassar';
  const body = h('div.tafsir-body', { 'aria-live': 'polite' });
  const draw = async () => {
    body.replaceChildren(h('div.spinner', { 'aria-label': 'جارٍ التحميل' }));
    let t;
    try { t = await getTafsir(n, a, which); } catch { body.replaceChildren(h('p.muted', 'التفسير غير متاح بدون إنترنت قبل تحميله.')); return; }
    body.replaceChildren(...[
      t.groupFrom ? h('p.muted', `تفسير الآيات من ${ar(t.groupFrom)} مجتمعة:`) : null,
      h('p.tafsir-text', t.text || 'لا يوجد تفسير لهذه الآية.'),
      h('p.small-note', 'المصدر: ' + TAFSIRS[which].source),
    ].filter(Boolean));
  };
  const tabs = h('div.seg', { role: 'tablist', 'aria-label': 'التفسير' }, Object.entries(TAFSIRS).map(([k, v]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(k === which),
    onclick: (e) => { which = k; settings.set('tafsir', k); for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); draw(); },
  }, v.name)));
  draw();
  sheet({ title: `التفسير، سورة ${meta.nameAr} ${ar(a)}`, content: () => h('div', tabs, body) });
}

async function wordsListSheet(n, a) {
  const meta = getSurahMeta(n);
  let words;
  try { words = (await getWords(n))[a - 1]; } catch { return toast('بيانات الكلمات غير متاحة بدون إنترنت قبل تحميلها'); }
  const text = (await getSurahText(n))[a - 1].split(' ').filter(isWordToken);
  sheet({
    title: `كلمات الآية، سورة ${meta.nameAr} ${ar(a)}`,
    content: (close) => !words ? h('p.muted', 'لا تتوفر بيانات كلمات لهذه الآية.') : h('ol.words-list', words.map((w, i) => h('li',
      h('span.wl-word', { lang: 'ar' }, text[i]),
      h('span.wl-info', h('span', w.pos), w.gloss ? h('small', { lang: 'en', dir: 'ltr' }, w.gloss) : null),
      w.root ? h('button.root-chip', { type: 'button', onclick: () => { close(); navigate('/search?root=' + encodeURIComponent(w.root)); } }, w.root) : null,
    ))),
  });
}

export function tajweedLegend() {
  const shown = ['madda_necessary', 'madda_obligatory', 'madda_permissible', 'madda_normal', 'ghunnah', 'ikhafa', 'idgham_ghunnah', 'idgham_wo_ghunnah', 'iqlab', 'qalaqah', 'ham_wasl'];
  return h('details.tj-legend', h('summary', 'دليل الألوان'), h('ul', shown.map((r) => h('li', h('span', { class: `tj-dot tj-${r}` }), TAJWEED_RULES[r].name))));
}
