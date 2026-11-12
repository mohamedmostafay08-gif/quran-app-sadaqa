// وضع السيارة: أزرار كبيرة جدًا، الشاشة لا تنطفئ، وتحكم صوتي بسيط
import { h, icon, ar } from '../lib/dom.js';
import { getSurahs, getSurahMeta } from '../data.js';
import { normalize } from '../lib/arabic.js';
import { player, getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import * as settings from '../state.js';
import { mount, toast, sheet } from '../ui.js';

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

export function renderCar() {
  const title = h('h1.car-title');
  const sub = h('p.car-sub');
  const playBtn = h('button.car-btn.car-play', { type: 'button', onclick: () => {
    const st = player.state();
    if (!st.surah) { const last = settings.get('lastRead'); player.playFrom(last?.surah || 1, last?.ayah || 1); }
    else player.toggle();
  } });
  const micBtn = SpeechRec ? h('button.car-btn.car-mic', { type: 'button', 'aria-label': 'أمر صوتي', onclick: () => listen() }, micIcon(), h('span', 'أمر صوتي')) : null;
  const heard = h('p.car-heard', { role: 'status', 'aria-live': 'polite' });

  const render = () => {
    const st = player.state();
    if (st.surah) {
      const m = getSurahMeta(st.surah);
      title.textContent = `سورة ${m.nameAr}`;
      sub.textContent = `${st.ayah == null ? 'السورة كاملة' : st.ayah === 0 ? 'البسملة' : 'الآية ' + ar(st.ayah)}، ${getReciter(st.reciter)?.nameAr || ''}`;
    } else {
      title.textContent = 'وضع السيارة';
      sub.textContent = 'اضغط تشغيل للمتابعة من آخر موضع';
    }
    const playing = st.status === 'playing';
    playBtn.replaceChildren(st.status === 'loading' ? h('span.spinner') : icon(playing ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
  };

  // ---- منع انطفاء الشاشة ----
  let lock = null;
  const keepAwake = async () => {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* غير مدعوم */ }
  };
  const onVis = () => { if (document.visibilityState === 'visible') keepAwake(); };
  keepAwake();
  document.addEventListener('visibilitychange', onVis);

  // ---- التحكم الصوتي ----
  let rec = null;
  function listen() {
    if (!SpeechRec) return;
    try { rec?.abort(); } catch { /* */ }
    rec = new SpeechRec();
    rec.lang = 'ar-EG';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    heard.textContent = 'أنا أسمعك… قل: التالي، السابق، توقف، شغّل، أو اسم سورة';
    micBtn?.classList.add('on');
    rec.onresult = (e) => {
      const alts = [...e.results[0]].map((r) => r.transcript);
      heard.textContent = `«${alts[0]}»`;
      if (!command(alts)) toast('لم أفهم الأمر');
    };
    rec.onerror = () => { heard.textContent = 'تعذر الاستماع، حاول مرة أخرى'; };
    rec.onend = () => micBtn?.classList.remove('on');
    rec.start();
  }

  const el = h('div.car',
    h('header.car-head',
      h('a.icon-btn', { href: '#/listen', 'aria-label': 'خروج من وضع السيارة' }, icon('close')),
      h('button.car-reciter', { type: 'button', onclick: () => reciterSheet() }, icon('user'), 'القارئ'),
    ),
    h('div.car-now', title, sub),
    h('div.car-controls',
      h('button.car-btn', { type: 'button', 'aria-label': 'الآية السابقة', onclick: () => player.prev() }, icon('back')),
      playBtn,
      h('button.car-btn', { type: 'button', 'aria-label': 'الآية التالية', onclick: () => player.next() }, icon('forward')),
    ),
    h('div.car-row',
      h('button.car-btn.car-wide', { type: 'button', onclick: () => jumpSurah(-1) }, 'السورة السابقة'),
      h('button.car-btn.car-wide', { type: 'button', onclick: () => jumpSurah(1) }, 'السورة التالية'),
    ),
    h('div.car-row',
      h('button.car-btn.car-wide', { type: 'button', onclick: () => pickSurah() }, 'اختر سورة'),
      micBtn,
    ),
    heard,
  );
  document.body.classList.add('car-mode');
  mount(el);
  const unsub = player.subscribe(render);
  render();

  return {
    cleanup() {
      unsub();
      document.body.classList.remove('car-mode');
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.().catch(() => {});
      try { rec?.abort(); } catch { /* */ }
    },
  };
}

function jumpSurah(d) {
  const st = player.state();
  const cur = st.surah || settings.get('lastRead')?.surah || 1;
  const n = Math.min(114, Math.max(1, cur + d));
  player.playFrom(n, 1);
}

function pickSurah() {
  sheet({
    title: 'اختر سورة',
    content: (close) => h('div.car-grid', getSurahs().map((s) => h('button.car-pick', { type: 'button', onclick: () => { close(); player.playFrom(s.id, 1); } }, h('small', ar(s.id)), s.nameAr))),
  });
}

/** ينفذ الأمر الصوتي؛ يرجع true لو فُهم */
function command(alts) {
  for (const raw of alts) {
    const t = normalize(raw);
    if (/(التالي|التاليه|بعده|اللي بعد)/.test(t)) { player.next(); return true; }
    if (/(السابق|السابقه|قبله|اللي قبل|رجوع)/.test(t)) { player.prev(); return true; }
    if (/(توقف|وقف|ايقاف|اسكت|بس)/.test(t)) { player.pause(); return true; }
    if (/(شغل|تشغيل|كمل|استمر|ابدا)/.test(t) && !/سوره/.test(t)) { player.resume(); return true; }
    const m = t.match(/(?:سوره\s+)?(.+)$/);
    if (m) {
      const q = m[1].replace(/^(شغل|اقرا|افتح)\s+/, '').replace(/^سوره\s+/, '').trim();
      const s = getSurahs().find((x) => normalize(x.nameAr) === q || normalize(x.nameAr).replace(/^ال/, '') === q.replace(/^ال/, ''));
      if (s) { player.playFrom(s.id, 1); toast(`سورة ${s.nameAr}`); return true; }
    }
  }
  return false;
}

function micIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>';
  return s;
}
