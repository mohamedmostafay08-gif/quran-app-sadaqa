// الإعدادات
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import { mount, topbar } from '../ui.js';
import { install, isStandalone } from '../features/install.js';

function seg(key, opts, after) {
  return h('div.seg', { role: 'radiogroup' }, opts.map(([v, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(settings.get(key) === v),
    onclick: (e) => {
      settings.set(key, v);
      for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      after?.(v);
    },
  }, label)));
}

function toggle(key, label, hint) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!settings.get(key) });
  input.addEventListener('change', () => settings.set(key, input.checked));
  return h('label.toggle', h('span', h('strong', label), hint ? h('small', hint) : null), input);
}

export function renderSettings() {
  const scale = h('input', { type: 'range', min: '0.8', max: '2', step: '0.1', value: String(settings.get('fontScale')), 'aria-label': 'حجم خط المصحف' });
  scale.addEventListener('input', () => settings.set('fontScale', +scale.value));
  const recName = h('span', getReciter(settings.get('reciter'))?.nameAr || '');
  const unsub = settings.subscribe((k) => { if (k === 'reciter') recName.textContent = getReciter(settings.get('reciter'))?.nameAr || ''; });

  mount(h('div.settings',
    topbar({ title: 'الإعدادات' }),
    h('section.card',
      h('h2', 'العرض'),
      h('div.field', h('span', 'الثيم'), seg('theme', [['auto', 'تلقائي'], ['light', 'فاتح'], ['sepia', 'سيبيا'], ['dark', 'ليلي']])),
      h('label.field', h('span', 'حجم خط المصحف'), h('div.range-row', h('span.small', 'أ'), scale, h('span.large', 'أ'))),
      h('p.preview', { lang: 'ar' }, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ'),
      h('div.field', h('span', 'طريقة العرض'), seg('layout', [['flow', 'متصل كالمصحف'], ['list', 'آية في سطر']])),
      toggle('showPageMarks', 'علامات الصفحات والأجزاء', 'تظهر بداية كل صفحة وجزء وربع حزب داخل السورة'),
      toggle('keepAwake', 'إبقاء الشاشة مضاءة أثناء القراءة'),
    ),
    h('section.card',
      h('h2', 'التلاوة'),
      h('button.row-btn', { type: 'button', onclick: () => reciterSheet() }, h('span', h('strong', 'القارئ الافتراضي'), h('small', recName)), icon('forward')),
      h('div.field', h('span', 'السرعة الافتراضية'), seg('rate', [[0.9, `${ar(0.9)}×`], [1, `${ar(1)}×`], [1.1, `${ar(1.1)}×`], [1.25, `${ar(1.25)}×`], [1.5, `${ar(1.5)}×`]]),
        h('small.muted', 'لكل القراء. ولو غيّرت السرعة من المشغّل، بتتحفظ للقارئ ده وحده.')),
      Object.keys(settings.get('rateByReciter') || {}).length ? h('button.row-btn', { type: 'button', onclick: (e) => { settings.set('rateByReciter', {}); e.currentTarget.remove(); } }, h('span', h('strong', 'إلغاء السرعات المخصصة للقراء'), h('small', 'يرجع كل القراء للسرعة الافتراضية')), icon('repeat')) : null,
      h('div.field', h('span', 'تكرار كل آية'), seg('repeat', [[1, 'مرة'], [2, ar(2)], [3, ar(3)], [5, ar(5)], [10, ar(10)]])),
      toggle('autoNext', 'الانتقال للسورة التالية تلقائيًا'),
      toggle('autoScroll', 'تتبع الآية أثناء التلاوة', 'تمرير الشاشة مع الآية المقروءة'),
    ),
    h('section.card',
      h('h2', 'التنزيل'),
      toggle('autoDownloadNext', 'تنزيل السورة التالية تلقائيًا', 'أثناء الاستماع، تُنزَّل السورة التالية للقارئ الحالي'),
      toggle('wifiOnly', 'التنزيل التلقائي على الواي فاي فقط', 'يعتمد على دعم المتصفح لمعرفة نوع الاتصال'),
      h('a.row-btn', { href: '#/downloads' }, h('span', h('strong', 'إدارة التنزيلات والمساحة')), icon('forward')),
    ),
    !isStandalone() ? h('section.card',
      h('button.row-btn', { type: 'button', onclick: () => install() }, h('span', h('strong', 'تثبيت التطبيق على الشاشة الرئيسية'), h('small', 'يفتح كتطبيق ويعمل بدون إنترنت')), icon('download')),
    ) : null,
    h('section.card',
      h('a.row-btn', { href: '#/about' }, h('span', h('strong', 'عن التطبيق'), h('small', 'المصادر والإصدارات والحقوق')), icon('forward')),
    ),
  ));
  return { cleanup: unsub };
}
