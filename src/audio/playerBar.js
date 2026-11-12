// المشغّل: كبسولة زجاجية صغيرة + مشغّل كامل الشاشة
import { h, icon, ar } from '../lib/dom.js';
import { player, getReciters, getReciter, rateFor, setRate, substituteFor } from './player.js';
import { getSurahMeta, getSurahText } from '../data.js';
import * as settings from '../state.js';
import { sheet, toast } from '../ui.js';
import { normalize } from '../lib/arabic.js';
import { sleepSheet, sleepState } from './sleepTimer.js';

const RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const REPEATS = [1, 2, 3, 5, 10];

const fmt = (sec) => {
  if (!isFinite(sec)) return '٠:٠٠';
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return ar(h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`);
};

/** المشغّل الكبسولة (صغير، فوق شريط التبويب) + المشغّل الكامل */
export function mountPlayerBar() {
  const slot = document.getElementById('player-slot');
  const art = h('span.mp-art', { 'aria-hidden': 'true' });
  const t1 = h('strong'), t2 = h('small');
  const mpPlay = h('button.mp-play', { type: 'button', onclick: () => player.toggle() });
  const mpProgress = h('span');
  const mini = h('div.mini-player', { role: 'region', 'aria-label': 'مشغل التلاوة' },
    h('button.mp-open', { type: 'button', 'aria-label': 'فتح المشغل', onclick: () => openFull() }, art, h('span.mp-text', t1, t2)),
    mpPlay,
    h('button.icon-btn', { type: 'button', 'aria-label': 'إغلاق المشغل', onclick: () => player.stop() }, icon('close')),
    h('div.mp-progress', { 'aria-hidden': 'true' }, mpProgress),
  );
  slot.append(mini);

  // ---- المشغّل الكامل ----
  const fpTitle = h('h2'), fpSub = h('p');
  const fpAyah = h('div.fp-ayah', { lang: 'ar', 'aria-live': 'polite' });
  const seek = h('input', { type: 'range', min: '0', max: '1000', value: '0', step: '1', 'aria-label': 'موضع التلاوة' });
  const tNow = h('span'), tAll = h('span');
  const fpPlay = h('button.fp-play', { type: 'button', onclick: () => player.toggle() });
  const rateBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'سرعة التشغيل', onclick: () => {
    rateSheet();
  } });
  const repBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'تكرار كل آية', onclick: () => {
    const i = REPEATS.indexOf(settings.get('repeat'));
    const v = REPEATS[(i + 1) % REPEATS.length];
    settings.set('repeat', v);
    toast(v === 1 ? 'بدون تكرار' : `تكرار كل آية ${ar(v)} مرات`);
    render();
  } });
  const sleepBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'مؤقت النوم', onclick: () => sleepSheet() }, icon('timer'), h('span', 'النوم'));
  const goBtn = h('a.pb-chip', { href: '#/quran', onclick: () => closeFull() }, icon('book'), h('span', 'في المصحف'));
  const recBtn = h('button.fp-reciter', { type: 'button', onclick: () => reciterSheet() });
  const full = h('div.full-player', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'المشغل' },
    h('div.fp-handle', { 'aria-hidden': 'true' }),
    h('div.fp-head',
      h('button.icon-btn', { type: 'button', 'aria-label': 'تصغير المشغل', onclick: () => closeFull() }, icon('down')),
      recBtn,
      h('button.icon-btn', { type: 'button', 'aria-label': 'إيقاف وإغلاق', onclick: () => { player.stop(); closeFull(); } }, icon('close')),
    ),
    h('div.fp-title', fpTitle, fpSub),
    fpAyah,
    h('div.fp-seek', seek, h('div.fp-times', tNow, tAll)),
    h('div.fp-controls',
      h('button.icon-btn', { type: 'button', 'aria-label': 'الآية السابقة', onclick: () => player.prev() }, icon('back')),
      fpPlay,
      h('button.icon-btn', { type: 'button', 'aria-label': 'الآية التالية', onclick: () => player.next() }, icon('forward')),
    ),
    h('div.fp-extra', rateBtn, repBtn, sleepBtn, goBtn),
  );
  const scrim = h('div.fp-scrim', { onclick: () => closeFull() });
  const wrap = h('div.fp-wrap', { hidden: true }, scrim, full);
  document.body.append(wrap);

  let isOpen = false;
  function openFull() {
    if (!player.state().surah && !player.state().radio) return;
    wrap.hidden = false;
    isOpen = true;
    requestAnimationFrame(() => wrap.classList.add('open'));
    render();
    full.querySelector('.fp-play').focus({ preventScroll: true });
  }
  function closeFull() {
    if (!isOpen) return;
    isOpen = false;
    wrap.classList.remove('open');
    setTimeout(() => { if (!isOpen) wrap.hidden = true; }, 380);
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) closeFull(); });
  addEventListener('hashchange', closeFull);
  // سحب المشغّل لأسفل لتصغيره
  let y0 = null;
  full.addEventListener('touchstart', (e) => { if (!e.target.closest('input, .fp-ayah')) y0 = e.touches[0].clientY; }, { passive: true });
  full.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) closeFull(); y0 = null; }, { passive: true });

  let seeking = false;
  seek.addEventListener('input', () => { seeking = true; const a = player.audio; tNow.textContent = fmt((seek.value / 1000) * (a.duration || 0)); });
  seek.addEventListener('change', () => { const a = player.audio; if (a.duration) a.currentTime = (seek.value / 1000) * a.duration; seeking = false; });

  player.audio.addEventListener('timeupdate', () => {
    const a = player.audio;
    const f = a.duration ? a.currentTime / a.duration : 0;
    mpProgress.style.transform = `scaleX(${f})`;
    if (isOpen && !seeking) { seek.value = String(Math.round(f * 1000)); tNow.textContent = fmt(a.currentTime); tAll.textContent = fmt(a.duration); }
  });

  function renderRadio(st) {
    const sl = sleepState();
    const live = st.status === 'playing';
    art.replaceChildren(icon('radio'));
    t1.textContent = st.radio.name;
    t2.textContent = st.error ? st.error : (st.status === 'loading' ? 'جارٍ الاتصال…' : live ? 'بث مباشر' : 'متوقف') + (sl ? `، نوم ${sl}` : '');
    t2.classList.toggle('err', !!st.error);
    mpProgress.style.transform = 'scaleX(0)';
    const playIcon = () => (st.status === 'loading' ? h('span.spinner', { 'aria-hidden': 'true' }) : icon(live ? 'pause' : 'play'));
    mpPlay.replaceChildren(playIcon());
    mpPlay.setAttribute('aria-label', live ? 'إيقاف مؤقت' : 'تشغيل');
    if (!isOpen) return;
    fpPlay.replaceChildren(playIcon());
    fpPlay.setAttribute('aria-label', live ? 'إيقاف مؤقت' : 'تشغيل');
    fpTitle.textContent = st.radio.name;
    fpSub.textContent = st.error || st.radio.sub || 'إذاعة';
    sleepBtn.classList.toggle('on', !!sl);
    shownAyah = 'radio:' + st.radio.id + ':' + live;
    fpAyah.replaceChildren(h('div.fp-radio', h('span', { class: `live-badge${live ? ' on' : ''}` }, h('i'), live ? 'بث مباشر' : 'متوقف'), icon('radio'),
      h('a.btn.ghost', { href: '#/radio', onclick: () => closeFull() }, 'كل الإذاعات')));
  }

  let shownAyah = null;
  let fellBackShown = false;
  async function showAyah(st) {
    const key = `${st.surah}:${st.ayah}`;
    if (key === shownAyah) return;
    shownAyah = key;
    if (st.ayah == null) {
      const sub = substituteFor(st.reciter, st.surah);
      fpAyah.replaceChildren(h('div.fp-untimed', h('p', `سورة ${getSurahMeta(st.surah).nameAr}`),
        h('small', sub ? `هذه السورة غير موجودة في تسجيل الإذاعة، فتُتلى من المصحف المرتّل المعروف (${sub.nameAr}). ولا تُظلَّل الآية المقروءة.` : 'تلاوة متصلة للسورة كاملة — هذا المصحف بلا توقيت للآيات، فلا تُظلَّل الآية المقروءة.')));
      return;
    }
    if (st.ayah === 0) { fpAyah.replaceChildren(h('p', getSurahMeta(st.surah).basmala || 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')); return; }
    const text = (await getSurahText(st.surah))[st.ayah - 1];
    if (shownAyah !== key) return;
    fpAyah.replaceChildren(h('p', text, ' ', h('span.ayah-num', { 'aria-hidden': 'true' }, '۝' + ar(st.ayah))));
    fpAyah.scrollTop = 0;
  }

  const surahOnly = [seek.parentElement, ...full.querySelectorAll('.fp-controls > .icon-btn'), rateBtn, repBtn, goBtn, recBtn];
  function render() {
    const st = player.state();
    const visible = !!st.surah || !!st.radio;
    mini.classList.toggle('show', visible);
    full.classList.toggle('radio', !!st.radio);
    for (const x of surahOnly) x.hidden = !!st.radio;
    if (!visible) { closeFull(); return; }
    if (st.radio) return renderRadio(st);
    const m = getSurahMeta(st.surah);
    const where = st.ayah == null ? 'السورة كاملة' : st.ayah === 0 ? 'البسملة' : 'الآية ' + ar(st.ayah);
    if (st.fellBack && !fellBackShown) { fellBackShown = true; toast(`التكرار يحتاج توقيت الآيات، فاستخدمنا صوت ${getReciter(st.reciter)?.nameAr || ''}`); }
    if (!st.fellBack) fellBackShown = false;
    const rid = st.compare ? st.compare.list[st.compare.idx] : st.reciter;
    const sl = sleepState();
    const recName = getReciter(rid)?.nameAr || '';
    art.textContent = m.nameAr.replace(/^ال/, '').slice(0, 2);
    if (shownAyah?.startsWith('radio:')) shownAyah = null;
    t1.textContent = `سورة ${m.nameAr}، ${where}`;
    t2.textContent = st.error ? st.error : recName + (st.compare ? ` (مقارنة ${ar(st.compare.idx + 1)}/${ar(st.compare.list.length)})` : '') + (sl ? `، نوم ${sl}` : '');
    t2.classList.toggle('err', !!st.error);
    const playing = st.status === 'playing';
    const playIcon = () => (st.status === 'loading' ? h('span.spinner', { 'aria-hidden': 'true' }) : icon(playing ? 'pause' : 'play'));
    mpPlay.replaceChildren(playIcon());
    mpPlay.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
    if (!isOpen) return;
    fpPlay.replaceChildren(playIcon());
    fpPlay.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
    fpTitle.textContent = `سورة ${m.nameAr}`;
    fpSub.textContent = st.error ? st.error : st.ayah == null ? `${ar(m.ayahCount)} آية` : `${where} من ${ar(m.ayahCount)}`;
    recBtn.replaceChildren(icon('user'), h('span', recName));
    goBtn.href = `#/surah/${st.surah}/${st.ayah || 1}`;
    rateBtn.replaceChildren(icon('speed'), h('span', `${ar(rateFor(rid))}×`));
    rateBtn.classList.toggle('on', rateFor(rid) !== 1);
    repBtn.replaceChildren(...[icon('repeat'), h('span', settings.get('repeat') > 1 ? `${ar(settings.get('repeat'))}×` : 'تكرار')]);
    repBtn.classList.toggle('on', settings.get('repeat') > 1);
    sleepBtn.classList.toggle('on', !!sl);
    showAyah(st);
  }
  player.subscribe(render);
  settings.subscribe((k) => { if (k === 'reciter' || k === 'rate' || k === 'rateByReciter') render(); });
  setInterval(() => { if (sleepState()) render(); }, 15000);
  render();
}

const STYLES = [
  ['مرتل', 'مرتّل', 'التلاوة المعتادة بسرعة متوسطة، مناسبة للقراءة اليومية والختمة'],
  ['مجوّد', 'مجوّد', 'تلاوة متأنية بأداء صوتي ومدود أطول، كتلاوات المحافل'],
  ['معلّم', 'معلّم', 'المصحف المعلّم: تلاوة بطيئة واضحة مناسبة للتعلّم والحفظ'],
];

export function reciterSheet() {
  const current = settings.get('reciter');
  const all = getReciters();
  let style = getReciter(current)?.style || 'مرتل';
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث باسم القارئ…', 'aria-label': 'ابحث باسم القارئ' });
  const hint = h('p.muted.rs-hint');
  const list = h('div');
  let closeFn;
  const item = (r) => h('li', h('button.choice', {
    type: 'button', 'aria-pressed': String(r.id === current),
    onclick: () => { player.setReciter(r.id); closeFn(); },
  }, h('span', h('strong', r.nameAr), h('small', r.isNew ? h('b.new-badge', 'جديد') : null, (r.style === 'مرتل' ? 'مرتّل' : r.style) + (r.note ? ' · ' + r.note : '') + (r.untimed ? ' · بدون تظليل الآيات' : ''))), r.id === current ? icon('check') : null));
  const tabs = h('div.seg', { role: 'tablist', 'aria-label': 'نوع التلاوة' }, STYLES.map(([v, label]) => {
    const n = all.filter((r) => r.style === v).length;
    return h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(v === style), hidden: !n,
      onclick: (e) => { style = v; for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); draw(); },
    }, `${label} (${ar(n)})`);
  }));
  const draw = () => {
    const q = normalize(input.value);
    hint.textContent = q ? '' : STYLES.find(([v]) => v === style)[2];
    const pool = q ? all.filter((r) => normalize(r.nameAr).includes(q)) : all.filter((r) => r.style === style);
    const featured = q ? [] : pool.filter((r) => r.featured);
    const others = q ? pool : pool.filter((r) => !r.featured);
    tabs.hidden = !!q;
    list.replaceChildren(...[
      featured.length ? h('h3.list-label', 'الأشهر') : null,
      featured.length ? h('ul.choice-list', featured.map(item)) : null,
      others.length && featured.length ? h('h3.list-label', `باقي القراء (${ar(others.length)})`) : null,
      others.length ? h('ul.choice-list', others.map(item)) : null,
      !pool.length ? h('p.muted', 'لا يوجد قارئ بهذا الاسم.') : null,
    ].filter(Boolean));
  };
  input.addEventListener('input', draw);
  draw();
  sheet({
    title: 'اختر القارئ',
    content: (close) => { closeFn = close; return h('div', tabs, hint, input, list); },
  });
}

/** اختيار سرعة التلاوة للقارئ الحالي */
export function rateSheet() {
  const st = player.state();
  const rid = (st.compare ? st.compare.list[st.compare.idx] : st.reciter) || settings.get('reciter');
  const cur = rateFor(rid);
  sheet({
    title: 'سرعة التلاوة',
    content: (close) => h('div',
      h('p.muted', `بعض التسجيلات متأنية بطبيعتها. السرعة التي تختارها تُحفظ لـ«${getReciter(rid)?.nameAr || ''}» وحده.`),
      h('div.chip-grid', RATES.map((r) => h('button.chip', {
        type: 'button', 'aria-pressed': String(r === cur),
        onclick: () => { setRate(r); close(); toast(`السرعة ${ar(r)}× لـ${getReciter(rid)?.nameAr || 'القارئ'}`); },
      }, `${ar(r)}×`))),
    ),
  });
}
