// شاشة الترحيب: ثلاث خطوات (القارئ، شكل القراءة، الختمة)
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { player, getReciters } from '../audio/player.js';
import * as K from '../features/khatma.js';
import { mount, toast } from '../ui.js';
import { navigate } from '../router.js';

export function renderWelcome() {
  let step = 0;
  let khatmaDays = 30;
  const body = h('div.wl-body');
  const dots = h('div.wl-dots', { 'aria-hidden': 'true' }, [0, 1, 2].map(() => h('span')));
  const back = h('button.btn.ghost', { type: 'button', onclick: () => go(step - 1) }, 'رجوع');
  const next = h('button.btn', { type: 'button', onclick: () => (step < 2 ? go(step + 1) : finish()) });
  const skip = h('button.link.wl-skip', { type: 'button', onclick: () => finish(true) }, 'تخطَّ');

  const steps = [stepReciter, stepLook, stepKhatma];
  function go(i) {
    if (i < 0) return;
    if (player.state().only) player.stop();
    step = i;
    body.replaceChildren(steps[i]());
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    back.hidden = i === 0;
    next.textContent = i < 2 ? 'التالي' : 'ابدأ';
    body.querySelector('h1')?.focus({ preventScroll: true });
    scrollTo(0, 0);
  }

  function stepReciter() {
    let style = 'مرتل';
    const list = h('ul.wl-reciters');
    const select = (r, li) => {
      settings.set('reciter', r.id);
      for (const x of list.children) { x.classList.toggle('sel', x === li); x.firstChild.setAttribute('aria-pressed', String(x === li)); }
    };
    const draw = () => {
      const current = settings.get('reciter');
      const pool = getReciters().filter((r) => r.style === style);
      const shown = (pool.filter((r) => r.featured).length ? pool.filter((r) => r.featured) : pool).slice(0, 12);
      list.replaceChildren(...shown.map((r) => {
        const li = h('li', { class: r.id === current ? 'sel' : '' },
          h('button.wl-pick', { type: 'button', 'aria-pressed': String(r.id === current), onclick: () => select(r, li) }, h('strong', r.nameAr), h('small', r.style === 'مرتل' ? 'مرتّل' : r.style)),
          h('button.icon-btn', { type: 'button', 'aria-label': `استمع إلى ${r.nameAr}`, onclick: () => { select(r, li); player.playFrom(1, 2, { only: true, times: 1 }); } }, icon('play')),
        );
        return li;
      }));
    };
    const tabs = h('div.seg', { role: 'tablist' }, [['مرتل', 'مرتّل'], ['مجوّد', 'مجوّد'], ['معلّم', 'معلّم']].map(([v, label]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(v === style),
      onclick: (e) => { style = v; for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); draw(); },
    }, label)));
    draw();
    return h('section.wl-step',
      h('h1', { tabindex: '-1' }, 'اختر قارئك المفضل'),
      h('p.muted', 'المرتّل للقراءة اليومية، والمجوّد بأداء المحافل، والمعلّم للتعلّم والحفظ. تقدر تسمع عينة وتغيّر القارئ في أي وقت.'),
      tabs,
      list,
    );
  }

  function stepLook() {
    const seg = (key, opts, after) => h('div.seg', { role: 'radiogroup' }, opts.map(([v, label]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(settings.get(key) === v),
      onclick: (e) => { settings.set(key, v); for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); after?.(); },
    }, label)));
    const scale = h('input', { type: 'range', min: '0.8', max: '2', step: '0.1', value: String(settings.get('fontScale')), 'aria-label': 'حجم الخط' });
    scale.addEventListener('input', () => settings.set('fontScale', +scale.value));
    return h('section.wl-step',
      h('h1', { tabindex: '-1' }, 'شكل القراءة'),
      h('p.preview.wl-preview', { lang: 'ar' }, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ'),
      h('div.form',
        h('div.field', h('span', 'الثيم'), seg('theme', [['auto', 'تلقائي'], ['light', 'فاتح'], ['sepia', 'سيبيا'], ['dark', 'ليلي']])),
        h('label.field', h('span', 'حجم الخط'), h('div.range-row', h('span.small', 'أ'), scale, h('span.large', 'أ'))),
        h('div.field', h('span', 'طريقة القراءة'), seg('readMode', [['scroll', 'عرض متصل'], ['pages', 'صفحات مصحف المدينة']])),
      ),
    );
  }

  function stepKhatma() {
    const opts = [[30, 'ختمة في شهر', '≈ ٢١ صفحة يوميًا'], [60, 'في شهرين', '≈ ١١ صفحة يوميًا'], [90, 'في ٣ أشهر', '≈ ٧ صفحات يوميًا'], [0, 'لاحقًا', 'تقدر تبدأها من الرئيسية']];
    const list = h('div.wl-options', opts.map(([d, t, sub]) => h('button.wl-option', {
      type: 'button', 'aria-pressed': String(d === khatmaDays),
      onclick: (e) => { khatmaDays = d; for (const b of list.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); },
    }, h('strong', t), h('small', sub))));
    return h('section.wl-step',
      h('h1', { tabindex: '-1' }, 'ابدأ رحلتك مع القرآن'),
      h('p.muted', 'ورد يومي بالصفحات يتعدّل تلقائيًا لو فاتك يوم. وفيه كمان وضع للحفظ والمراجعة.'),
      list,
    );
  }

  async function finish(skipped) {
    if (player.state().only) player.stop();
    if (!skipped && khatmaDays) {
      const existing = await K.getActive('read');
      if (!existing) { await K.create({ type: 'read', days: khatmaDays }); toast('بدأت الختمة، وفقك الله'); }
    }
    await settings.set('onboarded', true);
    navigate('/', { replace: true });
  }

  mount(h('div.welcome',
    h('header.wl-head', h('div.hero-mark', { 'aria-hidden': 'true' }, '۞'), dots, skip),
    body,
    h('footer.wl-foot', back, next),
  ));
  go(0);
}
