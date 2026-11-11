// شاشة القراءة
import { h, icon, ar, throttle } from '../lib/dom.js';
import { getSurahMeta, getSurahText, boundariesAt, juzOf, pageOf, quarterLabel } from '../data.js';
import * as settings from '../state.js';
import * as bookmarks from '../features/bookmarks.js';
import * as notes from '../features/notes.js';
import { mount, topbar, sheet, actionRow, toast } from '../ui.js';
import { player, getReciters } from '../audio/player.js';

export async function renderReader(params, _q, isStale) {
  const n = Math.min(114, Math.max(1, parseInt(params.surah, 10) || 1));
  const target = params.ayah ? parseInt(params.ayah, 10) : null;
  const meta = getSurahMeta(n);
  const [ayahs, marked, noted] = await Promise.all([getSurahText(n), bookmarks.bookmarkedIn(n), notes.inSurah(n)]);
  if (isStale()) return;

  const layout = settings.get('layout');
  const showMarks = settings.get('showPageMarks');
  const sub = h('p.reader-sub', `الجزء ${ar(juzOf(n, 1))} · صفحة ${ar(pageOf(n, 1))}`);

  const playBtn = h('button.icon-btn.play-main', { type: 'button', 'aria-label': 'تشغيل السورة', onclick: () => togglePlaySurah(n) }, icon('play'));
  const head = topbar({
    title: `سورة ${meta.nameAr}`,
    back: '#/',
    actions: [playBtn, h('button.icon-btn', { type: 'button', 'aria-label': 'خيارات العرض', onclick: () => displaySheet() }, icon('more'))],
  });
  head.querySelector('.topbar-title').append(sub);

  const container = h(`div.ayahs.${layout}`, { lang: 'ar' });
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
    const cut = text.lastIndexOf(' ');
    const body = cut > 0 ? text.slice(0, cut + 1) : '';
    const lastWord = cut > 0 ? text.slice(cut + 1) : text;
    const note = noted.get(a);
    const span = h('span.ayah', {
      dataset: { a },
      tabindex: '0',
      role: 'button',
      class: ayahClass(marked.has(a), note),
    },
    // آخر كلمة + رقم الآية في وحدة لا تنكسر (حتى لا يسقط الرقم وحده في سطر)
    body, h('span.ayah-end', lastWord, '\u00A0', h('span.ayah-num', { 'aria-hidden': 'true' }, '\u06DD' + ar(a)), h('span.sr-only', ` (الآية ${a})`)));
    frag.append(span);
    if (layout === 'flow') frag.append(' ');
  });
  container.append(frag);

  const onActivate = (e) => {
    const el = e.target.closest('.ayah');
    if (!el) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    ayahSheet(n, +el.dataset.a, el);
  };
  container.addEventListener('click', onActivate);
  container.addEventListener('keydown', onActivate);

  const prev = n > 1 ? getSurahMeta(n - 1) : null;
  const next = n < 114 ? getSurahMeta(n + 1) : null;

  const el = h('article.reader',
    head,
    h('section.surah-head',
      h('div.surah-frame',
        h('h2', `سورة ${meta.nameAr}`),
        h('p', `${meta.revelation === 'Meccan' ? 'مكية' : 'مدنية'} · ${ar(meta.ayahCount)} آية · ترتيب النزول ${ar(meta.order)}`),
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
    sub.textContent = `الجزء ${ar(juzOf(n, top))} · صفحة ${ar(pageOf(n, top))}`;
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

  return {
    cleanup() { io.disconnect(); unsub(); },
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

async function ayahSheet(n, a, el) {
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
        actionRow(isMarked ? 'bookmarkFill' : 'bookmark', isMarked ? 'إزالة العلامة' : 'إضافة علامة', async () => {
          const on = await bookmarks.toggle(n, a);
          el.className = ayahClass(on, await notes.get(n, a));
          toast(on ? 'تمت إضافة العلامة' : 'تمت إزالة العلامة');
          close();
        }),
        actionRow('note', note ? 'تعديل الملاحظة والتظليل' : 'ملاحظة وتظليل', () => { close(); noteSheet(n, a, el); }),
        actionRow('copy', 'نسخ الآية', async () => {
          try { await navigator.clipboard.writeText(shareText); toast('تم النسخ'); }
          catch { toast('تعذر النسخ'); }
          close();
        }),
        navigator.share ? actionRow('share', 'مشاركة', async () => {
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
          if (key === 'layout') dispatchEvent(new HashChangeEvent('hashchange'));
        },
      }, label)));
      return h('div.form',
        h('label.field', h('span', 'حجم الخط'), h('div.range-row', h('span.small', 'أ'), scale, h('span.large', 'أ'))),
        h('div.field', h('span', 'الثيم'), seg('theme', [['auto', 'تلقائي'], ['light', 'فاتح'], ['sepia', 'سيبيا'], ['dark', 'ليلي']])),
        h('div.field', h('span', 'طريقة العرض'), seg('layout', [['flow', 'متصل'], ['list', 'آية في سطر']])),
      );
    },
  });
}

const DEFAULT_COMPARE = ['Alafasy_128kbps', 'Husary_128kbps', 'Minshawy_Murattal_128kbps', 'Abdul_Basit_Murattal_192kbps'];

function compareSheet(n, a) {
  const chosen = new Set(DEFAULT_COMPARE);
  sheet({
    title: `مقارنة القراء – الآية ${ar(a)}`,
    content: (close) => {
      const list = h('ul.choice-list', getReciters().map((r) => {
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
          el.className = ayahClass(await bookmarks.has(n, a), saved);
          toast(saved ? 'تم الحفظ' : 'تم الحذف');
          close();
        } }, icon('check'), 'حفظ'),
        current ? h('button.btn.ghost.danger', { type: 'button', onclick: async () => {
          await notes.save(n, a, {});
          el.className = ayahClass(await bookmarks.has(n, a), null);
          toast('تم الحذف'); close();
        } }, icon('trash'), 'حذف') : null,
      ),
    ),
  });
}
