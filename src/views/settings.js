// الإعدادات
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import { mount, topbar } from '../ui.js';
import { install, isStandalone } from '../features/install.js';
import * as B from '../features/backup.js';
import * as Sync from '../features/sync.js';
import { download } from '../features/notes.js';
import { sheet, toast } from '../ui.js';
import { translationPicker } from './reader.js';
import { notifyCard } from './notifyCard.js';

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
    topbar({ title: 'الإعدادات', back: '#/more' }),
    h('section.card',
      h('h2', 'العرض'),
      h('div.field', h('span', 'الثيم'), themeGrid()),
      settings.get('theme') === 'prayer' && !settings.get('prayerLocation') ? h('small.muted', 'حدّد مدينتك من شاشة الصلاة ليعمل «حسب المغرب».') : null,
      h('label.field', h('span', 'حجم خط المصحف'), h('div.range-row', h('span.small', 'أ'), scale, h('span.large', 'أ'))),
      h('p.preview', { lang: 'ar' }, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ'),
      h('div.field', h('span', 'طريقة العرض'), seg('layout', [['flow', 'متصل كالمصحف'], ['list', 'آية في سطر']])),
      translationPicker(),
      h('div.field', h('span', 'التفسير المفضّل'), seg('tafsir', [['muyassar', 'الميسر'], ['saadi', 'السعدي']])),
      toggle('showPageMarks', 'علامات الصفحات والأجزاء'),
      toggle('keepAwake', 'إبقاء الشاشة مضاءة أثناء القراءة'),
    ),
    h('section.card',
      h('h2', 'التلاوة'),
      h('button.row-btn', { type: 'button', onclick: () => reciterSheet() }, h('span', h('strong', 'القارئ الافتراضي'), h('small', recName)), icon('forward')),
      h('div.field', h('span', 'السرعة الافتراضية'), seg('rate', [[0.9, `${ar(0.9)}×`], [1, `${ar(1)}×`], [1.1, `${ar(1.1)}×`], [1.25, `${ar(1.25)}×`], [1.5, `${ar(1.5)}×`]]),
        null),
      Object.keys(settings.get('rateByReciter') || {}).length ? h('button.row-btn', { type: 'button', onclick: (e) => { settings.set('rateByReciter', {}); e.currentTarget.remove(); } }, h('span', h('strong', 'إلغاء السرعات المخصصة للقراء'), h('small', 'يعود كل القراء إلى السرعة الافتراضية')), icon('repeat')) : null,
      h('div.field', h('span', 'تكرار كل آية'), seg('repeat', [[1, 'مرة'], [2, ar(2)], [3, ar(3)], [5, ar(5)], [10, ar(10)]])),
      toggle('autoNext', 'الانتقال للسورة التالية تلقائيًا'),
      toggle('autoScroll', 'تتبع الآية أثناء التلاوة'),
      toggle('wordHighlight', 'تظليل الكلمة المقروءة', 'للعفاسي والحصري والمنشاوي وعبدالباسط والسديس والشاطري والرفاعي والشريم'),
    ),
    h('section.card',
      h('h2', 'التنزيل'),
      toggle('autoDownloadNext', 'تنزيل السورة التالية تلقائيًا'),
      toggle('wifiOnly', 'التنزيل التلقائي على الواي فاي فقط'),
      h('a.row-btn', { href: '#/downloads' }, h('span', h('strong', 'إدارة التنزيلات والمساحة')), icon('forward')),
    ),
    notifyCard(),
    h('section.card',
      h('h2', 'الخصوصية'),
      toggle('stats', 'المساهمة في تحسين التطبيق', 'إحصائيات مجهولة بلا أي بيانات عنك'),
    ),
    syncCard(),
    backupCard(),
    !isStandalone() ? h('section.card',
      h('button.row-btn', { type: 'button', onclick: () => install() }, h('span', h('strong', 'تثبيت التطبيق على الشاشة الرئيسية'), h('small', 'يفتح كتطبيق ويعمل بدون إنترنت')), icon('download')),
    ) : null,
    h('section.card',
      h('a.row-btn', { href: '#/about' }, h('span', h('strong', 'عن التطبيق'), h('small', 'التواصل والدعم')), icon('forward')),
    ),
  ));
  return { cleanup: unsub };
}

// المزامنة بين الأجهزة برمز واحد (البيانات مشفّرة على الجهاز)
// سمات الألوان: معاينة صغيرة لكل سمة
const THEMES = [['auto', 'تلقائي', ['#f4f6f5', '#0d1110'], '#0b6b53'], ['prayer', 'حسب المغرب', ['#f4f6f5', '#0d1110'], '#0b6b53'], ['light', 'فاتح', ['#ffffff'], '#0b6b53'],
  ['green', 'أخضر هادئ', ['#e8f1ec'], '#1f6b4f'], ['sepia', 'سيبيا', ['#ead9b4'], '#6f4510'], ['paper', 'ورقي قديم', ['#efe6d2'], '#7a3b12'],
  ['dark', 'ليلي', ['#0d1110'], '#4fc59d'], ['navy', 'كحلي', ['#0c1526'], '#7fb2ff'], ['black', 'أسود', ['#000000'], '#d6b46a']];
function themeGrid() {
  const grid = h('div.theme-grid', { role: 'radiogroup', 'aria-label': 'الثيم' }, THEMES.map(([id, name, bg, ac]) => h('button.theme-opt', {
    type: 'button', role: 'radio', 'aria-checked': String(settings.get('theme') === id),
    onclick: (e) => { settings.set('theme', id); for (const b of grid.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
  }, h('span.th-sw', { 'aria-hidden': 'true', style: { background: bg.length > 1 ? `linear-gradient(135deg, ${bg[0]} 50%, ${bg[1]} 50%)` : bg[0] } }, h('span.th-dot', { style: { background: ac } })), h('span', name))));
  return grid;
}

function syncCard() {
  const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));
  const code = settings.get('syncCode');
  const run = async (btn) => {
    btn.disabled = true;
    try { const { changed } = await Sync.syncNow(); toast(changed ? 'تمت المزامنة، جارٍ التحديث…' : 'بياناتك متزامنة ✓'); if (changed) setTimeout(() => location.reload(), 800); else rerender(); }
    catch (e) { toast(e.message || 'تعذرت المزامنة'); btn.disabled = false; }
  };
  if (!code) {
    const input = h('input.note-input.sync-input', { type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX', 'aria-label': 'رمز المزامنة', dir: 'ltr' });
    const join = async (e) => {
      const btn = e.currentTarget;
      const c = Sync.normalizeCode(input.value);
      if (!c) return toast('الرمز غير صحيح؛ ١٦ حرفًا ورقمًا');
      await settings.set('syncCode', c);
      run(btn);
    };
    return h('section.card.sync-card',
      h('h2', 'المزامنة بين أجهزتك'),
      h('p.muted', 'علاماتك وملاحظاتك وحفظك وختماتك ومتابعة صلاتك على كل أجهزتك تلقائيًا.'),
      h('button.btn.block', { type: 'button', onclick: async (e) => { const btn = e.currentTarget; await settings.set('syncCode', Sync.newCode()); run(btn); } }, icon('sync'), 'ابدأ المزامنة على هذا الجهاز'),
      h('div.field', h('span', 'أو اكتب الرمز من جهازك الآخر'), h('div.qd-days', input, h('button.btn.ghost', { type: 'button', onclick: join }, 'ربط'))));
  }
  const last = Sync.lastSync();
  const copy = () => navigator.clipboard.writeText(code).then(() => toast('تم نسخ الرمز'), () => toast('تعذر النسخ'));
  return h('section.card.sync-card',
    h('h2', 'المزامنة بين أجهزتك'),
    h('p.muted', 'اكتب هذا الرمز في «الإعدادات» على جهازك الآخر. احتفظ به ولا تشاركه مع أحد.'),
    h('div.sync-code', h('code', { dir: 'ltr' }, code), h('button.icon-btn', { type: 'button', 'aria-label': 'نسخ الرمز', onclick: copy }, icon('copy'))),
    h('small.muted', last ? `آخر مزامنة: ${new Date(last).toLocaleString('ar-EG', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}` : 'لم تتم المزامنة بعد'),
    h('div.btn-row',
      h('button.btn', { type: 'button', onclick: (e) => run(e.currentTarget) }, icon('sync'), 'زامن الآن'),
      h('button.btn.ghost', { type: 'button', onclick: () => sheet({ title: 'إيقاف المزامنة', content: (close) => h('div',
        h('p', 'تبقى بياناتك على هذا الجهاز كما هي.'),
        h('div.btn-row',
          h('button.btn.ghost', { type: 'button', onclick: async () => { await Sync.stopSync(); close(); rerender(); } }, 'إيقاف على هذا الجهاز'),
          h('button.btn.ghost.danger', { type: 'button', onclick: async () => { try { await Sync.stopSync({ wipe: true }); close(); toast('حُذفت النسخة من الخادم'); rerender(); } catch { toast('تعذر الاتصال'); } } }, 'إيقاف وحذف النسخة من الخادم'))) }) }, 'إيقاف')));
}

function backupCard() {
  const last = settings.get('lastBackupAt');
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    let data;
    try { data = B.parseBackup(await f.text()); } catch (e) { return toast(e.message); }
    const n = B.summary(data);
    sheet({ title: 'استعادة النسخة الاحتياطية', content: (close) => h('div',
      h('p', `النسخة بتاريخ ${new Date(data.exportedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })} فيها:`),
      h('ul.backup-sum',
        h('li', `${ar(n.bookmarks)} علامة`), h('li', `${ar(n.notes)} ملاحظة`), h('li', `${ar(n.memorize)} آية في جدول الحفظ`),
        h('li', `${ar(n.khatma)} ختمة`), h('li', `${ar(n.groups)} ختمة جماعية`)),
      h('p.small-note', 'ستُدمج مع بياناتك الحالية.'),
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: async () => {
          try { await B.importBackup(data); close(); toast('تمت الاستعادة، جارٍ إعادة التحميل…'); setTimeout(() => location.reload(), 900); }
          catch (e) { toast('تعذرت الاستعادة: ' + e.message); }
        } }, icon('check'), 'استعادة'),
        h('button.btn.ghost', { type: 'button', onclick: () => close() }, 'إلغاء')),
    ) });
  });
  const exportIt = async (share) => {
    const data = await B.exportBackup();
    const text = JSON.stringify(data);
    const name = B.backupFilename();
    if (share) {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'نسخة احتياطية من رتّل' }); toast('تم'); dispatchEvent(new HashChangeEvent('hashchange')); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
    }
    download(name, text, 'application/json');
    toast('تم حفظ ملف النسخة الاحتياطية');
    dispatchEvent(new HashChangeEvent('hashchange'));
  };
  return h('section.card',
    h('h2', 'النسخة الاحتياطية'),
    h('p.muted', 'احفظ علاماتك وختماتك وتقدّم الحفظ في ملف لتنقلها إلى جهاز آخر.'),
    h('p.small-note', last ? `آخر نسخة: ${new Date(last).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'لم تحفظ أي نسخة احتياطية بعد.'),
    h('div.btn-row',
      h('button.btn', { type: 'button', onclick: () => exportIt(false) }, icon('download'), 'حفظ نسخة'),
      navigator.canShare ? h('button.btn.ghost', { type: 'button', onclick: () => exportIt(true) }, icon('share'), 'إرسال النسخة') : null,
      h('button.btn.ghost', { type: 'button', onclick: () => fileIn.click() }, 'استعادة من ملف'),
      fileIn,
    ),
  );
}
