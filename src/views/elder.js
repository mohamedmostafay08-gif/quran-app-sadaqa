// وضع كبار السن: شاشة بسيطة بأزرار ضخمة وخط كبير، وخيار لتكبير خط التطبيق كله
import { h, icon } from '../lib/dom.js';
import * as settings from '../state.js';
import * as P from '../features/prayer.js';
import { mount, topbar } from '../ui.js';
import { player } from '../audio/player.js';

export function renderElder() {
  const loc = P.getLocation();
  let next = null;
  try { if (loc) next = P.nextPrayer(loc); } catch { /* */ }
  const last = settings.get('lastListen');
  const big = (href, ic, title, sub, onclick) => h(onclick ? 'button.el-btn' : 'a.el-btn', { href: onclick ? undefined : href, type: onclick ? 'button' : undefined, onclick },
    h('span.el-ic', icon(ic)), h('span.el-t', h('strong', title), sub ? h('small', sub) : null));
  // حجم الواجهة كلها (ثلاث درجات)، وخط المصحف، والوضع الليلي: في مكان واحد
  const sizes = h('div.seg', { role: 'radiogroup', 'aria-label': 'حجم خط التطبيق' }, [[0, 'عادي'], [1, 'كبير'], [2, 'كبير جدًا']].map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(settings.uiLevel() === v),
    onclick: (e) => { settings.set('bigUI', v); for (const b of sizes.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
  }, label)));
  const scale = h('input', { type: 'range', min: '0.8', max: '2', step: '0.1', value: String(settings.get('fontScale') || 1), 'aria-label': 'حجم خط المصحف' });
  scale.addEventListener('input', () => settings.set('fontScale', +scale.value));
  const sample = h('p.preview', { lang: 'ar' }, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ');
  const dark = h('input', { type: 'checkbox', role: 'switch', checked: ['dark', 'navy', 'black'].includes(settings.get('theme')) });
  dark.addEventListener('change', () => settings.set('theme', dark.checked ? 'dark' : 'auto'));
  mount(h('div.elder-page',
    topbar({ title: 'وضع كبار السن', back: '#/more' }),
    next ? h('section.card.el-prayer', h('span', 'الصلاة القادمة'), h('strong', `${next.name} ${P.fmtTime(next.time, loc.tz)}`), h('small', `بعد ${P.countdown(next.time - new Date())}`)) : null,
    h('div.el-grid',
      big('#/continue', 'book', 'اقرأ القرآن', 'من حيث توقفت'),
      big(null, 'play', 'استمع للقرآن', last?.surah ? 'أكمل الاستماع' : 'سورة الكهف', () => { if (last?.surah) { player.restore(last); player.resume(); } else player.playFrom(18, 1); }),
      big('#/prayer?tab=times', 'mosque', 'مواقيت الصلاة', 'والأذان'),
      big('#/adhkar/27', 'sun', 'أذكار الصباح والمساء'),
      big('#/prayer?tab=qibla', 'compass', 'القبلة'),
      big('#/tasbih', 'repeat', 'السبحة')),
    h('section.card.el-settings',
      h('div.field', h('span', 'حجم خط التطبيق كله'), sizes),
      h('div.field', h('span', 'حجم خط المصحف'), scale, sample),
      h('label.toggle', h('span', h('strong', 'الوضع الليلي'), h('small', 'خلفية داكنة مريحة للعين')), dark)),
  ));
}
