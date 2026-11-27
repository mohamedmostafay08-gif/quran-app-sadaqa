// بطاقة التنبيهات: أذان الصلوات + تذكير الورد اليومي (Web Push)
import { h, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { toast } from '../ui.js';
import { pushStatus, syncPush, PUSH_PRAYERS, askPermission, testPush } from '../features/push.js';
import { playAdhan, preloadAdhan, VOICES } from '../features/adhan.js';

const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const STATUS_MSG = {
  unsupported: 'المتصفح لا يدعم الإشعارات.',
  'ios-install': 'لتفعيل الإشعارات: ثبّت التطبيق على الشاشة الرئيسية ثم افتحه منها.',
  denied: 'الإشعارات محظورة؛ فعّلها من إعدادات المتصفح.',
};

export function notifyCard({ prayers = true, wird = true } = {}) {
  const status = pushStatus();
  const note = h('p.small-note', { 'aria-live': 'polite' });
  const testBtn = h('button.btn.ghost.block', { type: 'button', hidden: !((settings.get('notifyPrayers') || []).length || settings.get('wirdTime')), onclick: async () => {
    testBtn.disabled = true; note.textContent = 'جارٍ الإرسال…';
    try { await testPush(); note.textContent = 'تم الإرسال'; }
    catch (e) { note.textContent = e.message === 'too soon' || e.message === 'too many requests' ? 'حاول بعد نصف دقيقة' : 'تعذر الإرسال'; }
    setTimeout(() => { testBtn.disabled = false; }, 30000);
  } }, 'إرسال إشعار تجريبي');
  const save = async (rollback, perm) => {
    note.textContent = 'جارٍ الحفظ…';
    try {
      if ((await perm) === 'denied') { rollback(); note.textContent = STATUS_MSG.denied; return; }
      const ok = await syncPush({ ask: true });
      if (!ok) { rollback(); note.textContent = self.Notification?.permission === 'denied' ? STATUS_MSG.denied : 'لم يتم السماح بالإشعارات.'; return; }
      note.textContent = '';
      testBtn.hidden = !((settings.get('notifyPrayers') || []).length || settings.get('wirdTime'));
      toast('تم حفظ التنبيهات');
    } catch {
      rollback(); note.textContent = navigator.onLine ? 'تعذر الحفظ، حاول مرة أخرى.' : 'حفظ التنبيهات يحتاج اتصالًا بالإنترنت.';
    }
  };

  const body = [];
  const pushOk = status === 'ok';
  if (!pushOk) body.push(h('p.muted', STATUS_MSG[status]));
  if (prayers) {
    const hasLoc = !!settings.get('prayerLocation');
    const chips = h('div.notify-chips', PUSH_PRAYERS.map((k) => {
      const on = () => (settings.get('notifyPrayers') || []).includes(k);
      const b = h('button.pb-chip', { type: 'button', 'aria-pressed': String(on()), disabled: !hasLoc, onclick: async () => {
        const perm = pushOk ? askPermission() : null;
        const before = settings.get('notifyPrayers') || [];
        const next = on() ? before.filter((x) => x !== k) : [...before, k];
        await settings.set('notifyPrayers', PUSH_PRAYERS.filter((x) => next.includes(x)));
        b.setAttribute('aria-pressed', String(on()));
        if (next.length) preloadAdhan();
        if (pushOk) save(async () => { await settings.set('notifyPrayers', before); b.setAttribute('aria-pressed', String(on())); }, perm);
        else toast(on() ? `سيُرفع أذان ${NAMES[k]} والتطبيق مفتوح` : 'تم الحفظ');
      } }, NAMES[k]);
      return b;
    }));
    const inApp = h('input', { type: 'checkbox', role: 'switch', checked: settings.get('adhanInApp') !== false });
    inApp.addEventListener('change', () => settings.set('adhanInApp', inApp.checked));
    // الأذان مفعّل افتراضيًا؛ يبقى فقط السماح بالإشعارات ليصل والتطبيق مغلق
    if (pushOk && hasLoc && Notification.permission === 'default' && (settings.get('notifyPrayers') || []).length) {
      const en = h('button.btn.block', { type: 'button', onclick: () => { const perm = askPermission(); save(() => {}, perm).then(() => { if (Notification.permission === 'granted') en.remove(); }); } }, 'تفعيل تنبيه الأذان');
      body.push(en);
    }
    body.push(
      h('div.field', h('span', 'الأذان عند دخول وقت الصلاة'), chips,
        hasLoc ? null : h('small.muted', 'حدّد موقعك أولًا من شاشة المواقيت.')),
      h('label.toggle', h('span', h('strong', 'تشغيل صوت الأذان')), inApp),
      h('div.field', h('span', 'صوت الأذان'), h('div.notify-chips', VOICES.map((v) => {
        const b = h('button.pb-chip.voice-chip', { type: 'button', 'aria-pressed': String(settings.get('adhanVoice') === v.id), onclick: async () => {
          await settings.set('adhanVoice', v.id);
          for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b));
          playAdhan('test', v.id);
        } }, v.name);
        return b;
      }))),
      h('button.btn.ghost.block', { type: 'button', onclick: () => playAdhan('test') }, 'استمع إلى الأذان'));
  }
  if (pushOk) {
    // تذكيرات الجمعة والصيام
    const xt = (key, label, hint) => {
      const inp = h('input', { type: 'checkbox', role: 'switch', checked: !!settings.get(key) });
      inp.addEventListener('change', async () => {
        const perm = askPermission();
        const before = settings.get(key);
        await settings.set(key, inp.checked);
        save(async () => { await settings.set(key, before); inp.checked = !!before; }, perm);
      });
      return h('label.toggle', h('span', h('strong', label), h('small', hint)), inp);
    };
    // تنبيه قبل الأذان
    const preSeg = h('div.seg', { role: 'radiogroup', 'aria-label': 'تنبيه قبل الأذان' }, [[0, 'بدون'], [10, '١٠ د'], [15, '١٥ د'], [30, '٣٠ د']].map(([v, label]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String((settings.get('preAdhan') || 0) === v),
      onclick: async (e) => {
        const perm = v ? askPermission() : null;
        const before = settings.get('preAdhan') || 0;
        await settings.set('preAdhan', v);
        for (const b of preSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
        save(async () => { await settings.set('preAdhan', before); for (const b of preSeg.children) b.setAttribute('aria-checked', String(b.dataset.v === String(before))); }, perm);
      }, dataset: { v } }, label)));
    body.push(h('div.field', h('span', 'تنبيه قبل الأذان'), preSeg), xt('notifyAfter', 'تذكير بالأذكار بعد الصلاة', 'بعد الأذان بعشر دقائق'));
    body.push(xt('notifyKahf', 'تذكير يوم الجمعة', 'سورة الكهف صباحًا، وآخر ساعة قبل المغرب'),
      xt('notifyFasting', 'تذكير بالصيام', 'ليلة الاثنين والخميس، وقبل الأيام البيض'),
      xt('adhkarReminder', 'تذكير بأذكار الصباح والمساء', 'بعد الفجر بنصف ساعة، وبعد العصر بثلث ساعة'),
      xt('notifyAod', 'آية الصباح', 'آية اليوم كل صباح في الثامنة'),
      xt('notifyQiyam', 'قيام الليل والوتر', 'عند دخول الثلث الأخير من الليل'));
    if (wird) {
      const time = h('input.note-input', { type: 'time', value: settings.get('wirdTime') || '', 'aria-label': 'موعد تذكير الورد' });
      const clear = h('button.btn.ghost', { type: 'button', hidden: !settings.get('wirdTime'), onclick: () => { time.value = ''; time.dispatchEvent(new Event('change')); } }, 'إيقاف');
      // iOS: نطلب الإذن عند لمس خانة الوقت (ضغطة مستخدم)، لأن حدث change لا يُعتبر ضغطة
      let perm = null;
      time.addEventListener('pointerdown', () => { perm = askPermission(); });
      time.addEventListener('change', async () => {
        perm ||= askPermission();
        const before = settings.get('wirdTime');
        await settings.set('wirdTime', time.value || null);
        clear.hidden = !time.value;
        save(async () => { await settings.set('wirdTime', before); time.value = before || ''; clear.hidden = !before; }, perm);
      });
      body.push(h('div.field', h('span', 'تذكير بالورد اليومي'), h('div.notify-time', time, clear)));
    }
  }
  return h('section.card.notify-card', h('h2', 'التنبيهات'), ...body, status === 'ok' ? testBtn : null, note);
}
