// روتين النوم: أذكار النوم، ثم سورة الملك (والسجدة) بصوت قارئك، مع مؤقت يوقف التلاوة بهدوء، وشاشة داكنة
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast } from '../ui.js';
import { player } from '../audio/player.js';
import { startSleep, cancelSleep, sleepState } from '../audio/sleepTimer.js';
import { markDone, todayLog } from '../features/adhkarLog.js';

export function renderSleep() {
  let minutes = settings.get('sleepMinutes') || 20;
  const state = h('small.sl-state', { 'aria-live': 'polite' });
  const paint = () => { const s = sleepState(); state.textContent = s ? `التلاوة تتوقف بعد ${s}` : ''; };
  const timer = setInterval(paint, 15000);
  const mins = h('div.seg', { role: 'radiogroup', 'aria-label': 'مدة المؤقت' }, [10, 20, 30, 45].map((m) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(m === minutes),
    onclick: (e) => { minutes = m; settings.set('sleepMinutes', m); for (const b of mins.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
  }, `${ar(m)} د`)));
  const listen = (s) => {
    player.playFrom(s, 1);
    startSleep(minutes);
    paint();
    toast(`تتوقف التلاوة بعد ${ar(minutes)} دقيقة`);
  };
  const done = todayLog().nawm;
  document.body.classList.add('sleep-mode');
  mount(h('div.sleep-page',
    topbar({ title: 'روتين النوم', back: '#/' }),
    h('p.sl-intro', 'نَمْ على ذكرٍ وقرآن'),
    h('ol.sl-steps',
      h('li.card.sl-step', h('span.sl-num', '١'), h('span.sl-body', h('strong', 'أذكار النوم'), h('small', done ? 'قرأتها الليلة ✓' : 'آية الكرسي، والمعوذات، ودعاء النوم')),
        h('a.btn', { href: '#/adhkar/28' }, done ? 'مراجعة' : 'ابدأ')),
      h('li.card.sl-step', h('span.sl-num', '٢'), h('span.sl-body', h('strong', 'سورة الملك'), h('small', '«كان النبي ﷺ لا ينام حتى يقرأ الم تنزيل وتبارك الذي بيده الملك» رواه الترمذي وأحمد، وصححه الألباني')),
        h('button.btn', { type: 'button', onclick: () => listen(67) }, icon('play'), 'استمع')),
      h('li.card.sl-step', h('span.sl-num', '٣'), h('span.sl-body', h('strong', 'سورة السجدة'), h('small', 'الم تنزيل')),
        h('button.btn.ghost', { type: 'button', onclick: () => listen(32) }, icon('play'), 'استمع'))),
    h('section.card.sl-timer', h('strong', 'إيقاف التلاوة بعد'), mins, state,
      h('button.btn.ghost', { type: 'button', onclick: () => { cancelSleep(); paint(); } }, 'إلغاء المؤقت')),
    h('button.btn.ghost.block', { type: 'button', onclick: async () => { await markDone('nawm'); toast('تصبح على خير، حفظك الله'); } }, icon('check'), 'قرأت أذكار النوم'),
  ));
  paint();
  return { cleanup() { clearInterval(timer); document.body.classList.remove('sleep-mode'); } };
}
