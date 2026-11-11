// المشغل الثابت أسفل الشاشة
import { h, icon, ar } from '../lib/dom.js';
import { player, getReciters, getReciter } from './player.js';
import { getSurahMeta } from '../data.js';
import * as settings from '../state.js';
import { sheet, toast } from '../ui.js';
import { sleepSheet, sleepState } from './sleepTimer.js';

const RATES = [0.75, 1, 1.25, 1.5];
const REPEATS = [1, 2, 3, 5, 10];

export function mountPlayerBar() {
  const slot = document.getElementById('player-slot');
  const title = h('a.pb-title', { href: '#/' });
  const sub = h('button.pb-sub', { type: 'button', onclick: () => reciterSheet() });
  const playBtn = h('button.pb-play', { type: 'button', onclick: () => player.toggle() });
  const rateBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'سرعة التشغيل', onclick: () => {
    const i = RATES.indexOf(settings.get('rate'));
    settings.set('rate', RATES[(i + 1) % RATES.length]);
    render();
  } });
  const repBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'تكرار كل آية', onclick: () => {
    const i = REPEATS.indexOf(settings.get('repeat'));
    const v = REPEATS[(i + 1) % REPEATS.length];
    settings.set('repeat', v);
    toast(v === 1 ? 'بدون تكرار' : `تكرار كل آية ${ar(v)} مرات`);
    render();
  } });
  const sleepBtn = h('button.pb-chip', { type: 'button', 'aria-label': 'مؤقت النوم', onclick: () => sleepSheet() }, icon('timer'));
  const bar = h('div.player-bar', { role: 'region', 'aria-label': 'مشغل التلاوة' },
    h('div.pb-info', title, sub),
    h('div.pb-controls',
      h('button.icon-btn', { type: 'button', 'aria-label': 'الآية السابقة', onclick: () => player.prev() }, icon('back')),
      playBtn,
      h('button.icon-btn', { type: 'button', 'aria-label': 'الآية التالية', onclick: () => player.next() }, icon('forward')),
    ),
    h('div.pb-extra', rateBtn, repBtn, sleepBtn,
      h('button.icon-btn.pb-close', { type: 'button', 'aria-label': 'إغلاق المشغل', onclick: () => player.stop() }, icon('close'))),
    h('div.pb-progress', { 'aria-hidden': 'true' }, h('span')),
  );
  slot.append(bar);
  const progress = bar.querySelector('.pb-progress span');
  player.audio.addEventListener('timeupdate', () => {
    const a = player.audio;
    progress.style.transform = `scaleX(${a.duration ? a.currentTime / a.duration : 0})`;
  });

  function render() {
    const st = player.state();
    const visible = !!st.surah;
    bar.classList.toggle('show', visible);
    document.documentElement.style.setProperty('--player-h', visible ? '76px' : '0px');
    if (!visible) return;
    const m = getSurahMeta(st.surah);
    title.textContent = `سورة ${m.nameAr}، ${st.ayah === 0 ? 'البسملة' : 'الآية ' + ar(st.ayah)}`;
    title.href = `#/surah/${st.surah}/${st.ayah || 1}`;
    const rid = st.compare ? st.compare.list[st.compare.idx] : st.reciter;
    const sl = sleepState();
    sub.textContent = st.error ? st.error : (getReciter(rid)?.nameAr || '') + (st.compare ? ` (مقارنة ${ar(st.compare.idx + 1)}/${ar(st.compare.list.length)})` : '') + (sl ? `، نوم ${sl}` : '');
    sub.classList.toggle('err', !!st.error);
    const playing = st.status === 'playing';
    playBtn.replaceChildren(st.status === 'loading' ? h('span.spinner', { 'aria-hidden': 'true' }) : icon(playing ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
    rateBtn.textContent = `${ar(settings.get('rate'))}×`;
    repBtn.replaceChildren(...[icon('repeat'), settings.get('repeat') > 1 ? h('span', ar(settings.get('repeat'))) : null].filter(Boolean));
    repBtn.classList.toggle('on', settings.get('repeat') > 1);
    sleepBtn.classList.toggle('on', !!sl);
  }
  player.subscribe(render);
  settings.subscribe((k) => { if (k === 'reciter' || k === 'rate') render(); });
  setInterval(() => { if (sleepState()) render(); }, 15000);
  render();
}

export function reciterSheet() {
  const current = settings.get('reciter');
  sheet({
    title: 'اختر القارئ',
    content: (close) => h('ul.choice-list', getReciters().map((r) => h('li', h('button.choice', {
      type: 'button', 'aria-pressed': String(r.id === current),
      onclick: () => { player.setReciter(r.id); close(); },
    }, h('span', h('strong', r.nameAr), h('small', `${r.style}، ${ar(r.kbps)} ك.ب/ث`)), r.id === current ? icon('check') : null)))),
  });
}
