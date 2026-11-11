// القراءة الغامرة: إخفاء الأشرطة أثناء النزول، السحب بين السور، شريط التنقل الجانبي، ومنع انطفاء الشاشة
import { h, ar } from '../lib/dom.js';
import { juzOf, pageOf } from '../data.js';
import * as settings from '../state.js';
import { navigate } from '../router.js';
import { toast } from '../ui.js';

export function setupImmersive({ n, container }) {
  const cleanups = [];
  const body = document.body;

  // ---- 1) إخفاء الأشرطة عند النزول وإظهارها عند الطلوع أو اللمس ----
  let lastY = scrollY, acc = 0;
  const onScroll = () => {
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    if (y < 80) { acc = 0; body.classList.remove('immersive'); return; }
    acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;
    if (acc > 40) body.classList.add('immersive');
    else if (acc < -30) body.classList.remove('immersive');
  };
  addEventListener('scroll', onScroll, { passive: true });
  // لمسة على مساحة فارغة (مش آية) تُظهر الأشرطة
  const onTapEmpty = (e) => { if (!e.target.closest('.ayah, button, a, input')) body.classList.toggle('immersive'); };
  container.addEventListener('click', onTapEmpty);
  cleanups.push(() => { removeEventListener('scroll', onScroll); container.removeEventListener('click', onTapEmpty); body.classList.remove('immersive'); });

  // ---- 2) السحب أفقيًا للانتقال بين السور (كتقليب المصحف: السحب لليمين = التالية) ----
  let sx = 0, sy = 0, st = 0, tracking = false;
  const onStart = (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); tracking = true;
  };
  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - st > 600 || Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
    const to = dx > 0 ? n + 1 : n - 1;
    if (to < 1 || to > 114) return;
    navigate(`/surah/${to}`);
  };
  container.addEventListener('touchstart', onStart, { passive: true });
  container.addEventListener('touchend', onEnd, { passive: true });
  cleanups.push(() => { container.removeEventListener('touchstart', onStart); container.removeEventListener('touchend', onEnd); });

  // ---- 3) شريط التنقل الجانبي ----
  const ayahEls = [...container.querySelectorAll('.ayah')];
  if (ayahEls.length > 12) {
    const bubble = h('div.scrub-bubble', { 'aria-hidden': 'true' });
    const thumb = h('div.scrub-thumb');
    const track = h('div.scrubber', {
      role: 'slider', tabindex: '0', 'aria-label': 'التنقل داخل السورة',
      'aria-valuemin': '1', 'aria-valuemax': String(ayahEls.length), 'aria-valuenow': '1',
    }, thumb, bubble);
    document.body.append(track);
    const range = () => document.documentElement.scrollHeight - innerHeight;
    let hideT;
    const show = () => { track.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(() => { if (!track.classList.contains('drag')) track.classList.remove('show'); }, 1400); };
    const syncThumb = () => {
      const f = range() > 0 ? scrollY / range() : 0;
      thumb.style.top = `${f * 100}%`;
    };
    const ayahAtFraction = (f) => {
      const y = f * range() + innerHeight * 0.3;
      let lo = 0, hi = ayahEls.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ayahEls[mid].offsetTop <= y) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
    const label = (a) => `الآية ${ar(a)}، صفحة ${ar(pageOf(n, a))}، الجزء ${ar(juzOf(n, a))}`;
    const onScroll2 = () => { syncThumb(); show(); };
    addEventListener('scroll', onScroll2, { passive: true });
    const dragTo = (clientY) => {
      const r = track.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      scrollTo(0, f * range());
      const a = ayahAtFraction(f);
      bubble.textContent = label(a);
      bubble.style.top = `${f * 100}%`;
      track.setAttribute('aria-valuenow', String(a));
    };
    track.addEventListener('pointerdown', (e) => { e.preventDefault(); track.setPointerCapture(e.pointerId); track.classList.add('drag', 'show'); dragTo(e.clientY); });
    track.addEventListener('pointermove', (e) => { if (track.classList.contains('drag')) dragTo(e.clientY); });
    const up = () => { track.classList.remove('drag'); show(); };
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
    track.addEventListener('keydown', (e) => {
      const step = e.key === 'PageDown' || e.key === 'ArrowDown' ? 1 : e.key === 'PageUp' || e.key === 'ArrowUp' ? -1 : 0;
      if (step) { e.preventDefault(); scrollBy(0, step * innerHeight * 0.8); }
    });
    syncThumb();
    cleanups.push(() => { removeEventListener('scroll', onScroll2); track.remove(); clearTimeout(hideT); });
  }

  // ---- 4) منع انطفاء الشاشة أثناء القراءة ----
  let lock = null;
  const keep = async () => {
    if (!settings.get('keepAwake')) return;
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* غير مدعوم */ }
  };
  const onVis = () => { if (document.visibilityState === 'visible') keep(); };
  keep();
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}); });

  return () => cleanups.forEach((f) => f());
}

/** تلميح يظهر مرة واحدة لتعريف الإيماءات */
export function gestureHintOnce() {
  try {
    if (localStorage.getItem('qa:hint-gestures')) return;
    localStorage.setItem('qa:hint-gestures', '1');
  } catch { return; }
  setTimeout(() => toast('اضغط مرتين على الآية لتشغيلها، واسحب يمين/شمال للتنقل بين السور', 5000), 1200);
}
