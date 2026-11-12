// الصلاة: المواقيت + القبلة + الأذكار، والتاريخ الهجري — كلها تعمل بدون إنترنت
import { h, icon, ar } from '../lib/dom.js';
import { normalize } from '../lib/arabic.js';
import * as settings from '../state.js';
import * as P from '../features/prayer.js';
import { mount, topbar, sheet, toast, empty } from '../ui.js';
import { navigate } from '../router.js';
import { notifyCard } from './notifyCard.js';
import { playAdhan } from '../features/adhan.js';

let tab = 'times';

export function renderPrayer(_p, query) {
  if (query.tab) tab = query.tab;
  // فُتح من تنبيه الأذان: نعرض بطاقة الأذان ونحاول تشغيله
  if (query.adhan) { tab = 'times'; history.replaceState(null, '', '#/prayer'); setTimeout(() => playAdhan(query.adhan), 0); }
  const panel = h('div.pr-panel');
  const tabs = h('div.seg.pr-tabs', { role: 'tablist' }, [['times', 'المواقيت'], ['qibla', 'القبلة'], ['adhkar', 'الأذكار']].map(([t, label]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(tab === t),
    onclick: (e) => { tab = t; history.replaceState(null, '', `#/prayer?tab=${t}`); for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); draw(); },
  }, label)));
  let cleanupPanel = null;
  const draw = () => {
    cleanupPanel?.();
    cleanupPanel = null;
    const r = tab === 'qibla' ? qiblaPanel() : tab === 'adhkar' ? adhkarPanel() : timesPanel(draw);
    panel.replaceChildren(r.el || r);
    cleanupPanel = r.cleanup || null;
  };
  mount(h('div.prayer', topbar({ title: 'الصلاة' }), tabs, panel));
  draw();
  return { cleanup: () => cleanupPanel?.() };
}

// ---------------- المواقيت ----------------
function timesPanel(redraw) {
  const loc = P.getLocation();
  const hj = P.hijri();
  const dateCard = h('section.card.pr-date',
    h('div', h('strong.pr-hijri', hj ? hj.text : ''), h('span.muted', P.gregorianText())),
    h('button.pr-city', { type: 'button', onclick: () => locationSheet(redraw) }, icon('pin'), h('span', loc ? loc.name : 'حدّد موقعك')),
  );
  if (!loc) {
    return h('div', dateCard, h('section.card', empty('pin', 'حدّد موقعك لحساب المواقيت', 'المواقيت تُحسب على جهازك بدون إنترنت. اختر مدينتك أو استخدم موقعك الحالي.',
      h('button.btn', { type: 'button', onclick: () => locationSheet(redraw) }, icon('pin'), 'اختر الموقع'))));
  }
  const nextEl = h('div.pr-next');
  const list = h('ul.pr-list');
  const paint = () => {
    const now = new Date();
    const n = P.nextPrayer(loc, now);
    const cur = P.currentPrayerKey(n.today, now);
    nextEl.replaceChildren(
      h('span.eyebrow', 'الصلاة القادمة'),
      h('strong', n.name),
      h('span.pr-next-time', P.fmtTime(n.time, loc.tz)),
      h('span.pr-left', `بعد ${P.countdown(n.time - now)}`),
    );
    list.replaceChildren(...P.PRAYERS.map((p) => h('li', { class: (p.key === cur ? 'cur ' : '') + (p.key === n.key ? 'next' : '') },
      h('span', p.name), h('strong', { class: 'num' }, P.fmtTime(n.today[p.key], loc.tz)))));
  };
  paint();
  const timer = setInterval(paint, 30000);

  const methodSel = h('select', { 'aria-label': 'طريقة الحساب' }, Object.entries(P.METHODS).map(([k, v]) => h('option', { value: k }, v)));
  methodSel.value = loc.method;
  methodSel.addEventListener('change', () => { settings.set('prayerLocation', { ...loc, method: methodSel.value }); redraw(); });
  const seg = (opts, cur, onPick) => h('div.seg', { role: 'radiogroup' }, opts.map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(cur === v), onclick: () => onPick(v),
  }, label)));

  const el = h('div',
    dateCard,
    h('section.card.pr-hero', nextEl),
    h('section.card', list),
    notifyCard({ wird: false }),
    h('details.card.pr-settings',
      h('summary', 'إعدادات الحساب'),
      h('div.form',
        h('label.field', h('span', 'طريقة الحساب'), methodSel),
        h('div.field', h('span', 'وقت العصر'), seg([['shafi', 'الجمهور (شافعي)'], ['hanafi', 'حنفي']], loc.madhab || 'shafi', (v) => { settings.set('prayerLocation', { ...loc, madhab: v }); redraw(); })),
        h('div.field', h('span', 'تعديل التاريخ الهجري'), seg([[-1, '−١ يوم'], [0, 'بدون'], [1, '+١ يوم']], settings.get('hijriAdjust') || 0, (v) => { settings.set('hijriAdjust', v); redraw(); })),
        h('p.small-note', `الإحداثيات: ${ar(loc.lat.toFixed(3))}، ${ar(loc.lng.toFixed(3))}. المواقيت تقريبية وقد تختلف دقيقة أو دقيقتين عن تقويم مسجدك.`),
      ),
    ),
  );
  return { el, cleanup: () => clearInterval(timer) };
}

function locationSheet(onDone) {
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن مدينة…', 'aria-label': 'ابحث عن مدينة' });
  const list = h('ul.choice-list');
  let closeFn;
  const pick = (c) => {
    settings.set('prayerLocation', { name: `${c.name}، ${c.country}`, lat: c.lat, lng: c.lng, tz: c.tz, method: c.method, madhab: 'shafi' });
    closeFn(); onDone?.(); toast(`تم: ${c.name}`);
  };
  const draw = () => {
    const q = normalize(input.value);
    list.replaceChildren(...P.CITIES.filter((c) => !q || normalize(c.name).includes(q) || normalize(c.country).includes(q)).map((c) => h('li', h('button.choice', { type: 'button', onclick: () => pick(c) }, h('span', h('strong', c.name), h('small', c.country))))));
  };
  input.addEventListener('input', draw);
  draw();
  const geo = h('button.btn.block', { type: 'button', onclick: () => {
    if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع');
    geo.disabled = true; geo.lastChild.textContent = 'جارٍ تحديد موقعك…';
    navigator.geolocation.getCurrentPosition((pos) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      settings.set('prayerLocation', { name: 'موقعي الحالي', lat: pos.coords.latitude, lng: pos.coords.longitude, tz, method: P.methodForTz(tz), madhab: 'shafi' });
      closeFn(); onDone?.(); toast('تم تحديد موقعك');
    }, () => { geo.disabled = false; geo.lastChild.textContent = 'استخدم موقعي الحالي'; toast('تعذر تحديد الموقع، اختر مدينتك من القائمة'); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 });
  } }, icon('pin'), h('span', 'استخدم موقعي الحالي'));
  sheet({ title: 'الموقع', content: (close) => { closeFn = close; return h('div.form', geo, h('p.small-note', 'يُحفظ الموقع على جهازك فقط، ولا يُرسل (مقرّبًا) إلا إذا فعّلت تنبيهات الأذان.'), input, list); } });
}

// ---------------- القبلة ----------------
function qiblaPanel() {
  const loc = P.getLocation();
  if (!loc) return h('section.card', empty('pin', 'حدّد موقعك أولًا', 'نحتاج موقعك لحساب اتجاه القبلة.', h('button.btn', { type: 'button', onclick: () => locationSheet(() => dispatchEvent(new HashChangeEvent('hashchange'))) }, icon('pin'), 'اختر الموقع')));
  const bearing = P.qiblaBearing(loc.lat, loc.lng);
  const dist = P.distanceToKaaba(loc.lat, loc.lng);
  const rose = compassSvg(bearing);
  const dial = rose.querySelector('.dial');
  const status = h('p.qb-status', 'اضغط «تشغيل البوصلة» وضع الهاتف أفقيًا.');
  const aligned = h('p.qb-aligned', { hidden: true }, 'أنت في اتجاه القبلة ✓');
  let heading = null;
  const onOrient = (e) => {
    let hd = null;
    if (typeof e.webkitCompassHeading === 'number') hd = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') hd = (360 - e.alpha) % 360;
    if (hd == null) return;
    heading = hd;
    dial.style.transform = `rotate(${-hd}deg)`;
    const diff = Math.abs(((bearing - hd + 540) % 360) - 180);
    aligned.hidden = diff > 6;
    rose.classList.toggle('ok', diff <= 6);
    status.textContent = `اتجاه الهاتف ${ar(Math.round(hd))}°`;
  };
  let started = false;
  const start = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') { status.textContent = 'لم يُسمح بالوصول للبوصلة.'; return; }
      }
    } catch { /* */ }
    started = true;
    addEventListener('deviceorientationabsolute', onOrient);
    addEventListener('deviceorientation', onOrient);
    status.textContent = 'حرّك الهاتف على شكل ٨ لمعايرة البوصلة إن لزم.';
    setTimeout(() => { if (heading == null) status.textContent = 'لا توجد بوصلة في هذا الجهاز. استخدم الزاوية المكتوبة مع بوصلة خارجية.'; }, 3000);
  };
  const el = h('div.qibla',
    h('section.card.qb-card',
      rose,
      aligned,
      h('p.qb-angle', `القبلة على بُعد ${ar(Math.round(bearing))}° من الشمال باتجاه عقارب الساعة`),
      h('p.muted', `${loc.name}، المسافة إلى الكعبة ≈ ${ar(Math.round(dist).toLocaleString('en'))} كم`),
      status,
      h('button.btn', { type: 'button', onclick: start }, icon('compass'), 'تشغيل البوصلة'),
    ),
    h('p.small-note', 'دقة البوصلة تتأثر بالمعادن والمغناطيس القريب. للتأكد، قارن بالشمس أو بمحراب مسجد قريب.'),
  );
  return { el, cleanup: () => { if (started) { removeEventListener('deviceorientationabsolute', onOrient); removeEventListener('deviceorientation', onOrient); } } };
}

function compassSvg(bearing) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 240 240');
  s.setAttribute('class', 'qb-rose');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `اتجاه القبلة ${Math.round(bearing)} درجة`);
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const long = i % 18 === 0, mid = i % 6 === 0;
    return `<line x1="120" y1="${long ? 14 : mid ? 18 : 21}" x2="120" y2="26" transform="rotate(${i * 5} 120 120)" class="${long ? 't-long' : 't'}"/>`;
  }).join('');
  s.innerHTML = `
    <circle cx="120" cy="120" r="112" class="ring"/>
    <g class="dial">
      ${ticks}
      <text x="120" y="44" class="n">ش</text>
      <text x="200" y="125" class="d">ق</text>
      <text x="120" y="206" class="d">ج</text>
      <text x="40" y="125" class="d">غ</text>
      <g transform="rotate(${bearing} 120 120)">
        <line x1="120" y1="120" x2="120" y2="40" class="needle"/>
        <rect x="108" y="22" width="24" height="24" rx="3" class="kaaba"/>
        <rect x="108" y="28" width="24" height="4" class="kaaba-band"/>
      </g>
    </g>
    <circle cx="120" cy="120" r="6" class="hub"/>
    <path d="M120 2 l7 12 h-14z" class="top"/>`;
  return s;
}

// ---------------- الأذكار ----------------
let adhkarP = null;
export const getAdhkar = () => (adhkarP ||= fetch(new URL('../../public/data/adhkar.json', import.meta.url)).then((r) => r.json()));
const FEATURED = [27, 28, 1, 25];

function adhkarPanel() {
  const wrap = h('div', h('p.muted', 'جارٍ التحميل…'));
  getAdhkar().then((data) => {
    const input = h('input.note-input', { type: 'search', placeholder: 'ابحث في الأذكار والأدعية…', 'aria-label': 'ابحث في الأذكار' });
    const list = h('ul.adk-list');
    const featured = h('div.quick-row', FEATURED.map((id) => data.chapters.find((c) => c.id === id)).filter(Boolean).map((c) =>
      h('a.quick', { href: `#/adhkar/${c.id}` }, icon('note'), h('span', h('strong', c.title), h('small', `${ar(c.items.length)} ذكر`)))));
    const draw = () => {
      const q = normalize(input.value);
      list.replaceChildren(...data.chapters.filter((c) => !q || normalize(c.title).includes(q)).map((c) => h('li', h('a.adk-ch', { href: `#/adhkar/${c.id}` }, h('span', c.title), h('small.muted', ar(c.items.length))))));
    };
    input.addEventListener('input', draw);
    draw();
    wrap.replaceChildren(featured, h('section.card', input, list), h('p.small-note', `المصدر: ${data.source}`));
  }).catch(() => wrap.replaceChildren(h('p.muted', 'تعذر تحميل الأذكار.')));
  return wrap;
}

/** صفحة باب واحد من الأذكار مع عدّاد التكرار */
export async function renderAdhkarChapter(params, _q, isStale) {
  const data = await getAdhkar();
  if (isStale()) return;
  const ch = data.chapters.find((c) => c.id === +params.id);
  if (!ch) return navigate('/prayer?tab=adhkar', { replace: true });
  const key = `qa:adhkar:${ch.id}:${new Date().toDateString()}`;
  let counts = {};
  try { counts = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* */ }
  const save = () => { try { localStorage.setItem(key, JSON.stringify(counts)); } catch { /* */ } };
  const bar = h('div.bar', h('span'));
  const doneCount = () => ch.items.filter((it, i) => (counts[i] || 0) >= it.repeat).length;
  const updateBar = () => { bar.firstChild.style.width = `${(doneCount() / ch.items.length) * 100}%`; };
  const cards = ch.items.map((it, i) => {
    const left = h('span.adk-left');
    const card = h('li.adk-item',
      h('p.adk-text', it.text),
      h('button.adk-count', { type: 'button', onclick: () => {
        if ((counts[i] || 0) >= it.repeat) return;
        counts[i] = (counts[i] || 0) + 1;
        save(); paint(); updateBar();
        if (navigator.vibrate) navigator.vibrate(12);
        if (counts[i] >= it.repeat) {
          const next = card.nextElementSibling;
          if (next) setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
          if (doneCount() === ch.items.length) toast('أتممت الأذكار، تقبّل الله');
        }
      } }, left),
    );
    const paint = () => {
      const c = counts[i] || 0, done = c >= it.repeat;
      card.classList.toggle('done', done);
      left.textContent = done ? '✓ تم' : it.repeat > 1 ? `${ar(it.repeat - c)} / ${ar(it.repeat)}` : 'تم';
      left.parentElement?.setAttribute('aria-label', done ? 'تم' : `اضغط للعد، متبقٍ ${it.repeat - c}`);
    };
    paint();
    return card;
  });
  mount(h('div.adhkar',
    topbar({ title: ch.title, back: '#/prayer?tab=adhkar', actions: [h('button.icon-btn', { type: 'button', 'aria-label': 'إعادة العد', onclick: () => { counts = {}; save(); dispatchEvent(new HashChangeEvent('hashchange')); } }, icon('repeat'))] }),
    bar,
    h('ol.adk-items', cards),
    h('p.small-note', `المصدر: ${data.source}`),
  ));
  updateBar();
}
