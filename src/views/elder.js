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
  const toggle = h('input', { type: 'checkbox', role: 'switch', checked: !!settings.get('bigUI') });
  toggle.addEventListener('change', () => settings.set('bigUI', toggle.checked));
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
    h('label.toggle.card.el-toggle', h('span', h('strong', 'تكبير خط التطبيق كله'), h('small', 'لكل الشاشات، لا لهذه الشاشة فقط')), toggle),
  ));
}
