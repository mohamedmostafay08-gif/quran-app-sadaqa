// بطاقة التنبيهات: أذان الصلوات + تذكير الورد اليومي (Web Push)
import { h, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { toast } from '../ui.js';
import { pushStatus, syncPush, PUSH_PRAYERS, askPermission, testPush } from '../features/push.js';
import { playAdhan, preloadAdhan } from '../features/adhan.js';

const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const STATUS_MSG = {
  unsupported: 'هذا المتصفح لا يدعم الإشعارات. جرّب Chrome أو Edge أو Firefox، أو ثبّت التطبيق.',
  'ios-install': 'على الآيفون: تعمل الإشعارات بعد تثبيت التطبيق على الشاشة الرئيسية (مشاركة ← «إضافة إلى الشاشة الرئيسية») ثم فتحه من أيقونته.',
  denied: 'الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجوار العنوان) ثم عد إلى هنا.',
};

export function notifyCard({ prayers = true, wird = true } = {}) {
  const status = pushStatus();
  const note = h('p.small-note', { 'aria-live': 'polite' });
  const testBtn = h('button.btn.ghost.block', { type: 'button', hidden: !((settings.get('notifyPrayers') || []).length || settings.get('wirdTime')), onclick: async () => {
    testBtn.disabled = true; note.textContent = 'جارٍ الإرسال…';
    try { await testPush(); note.textContent = 'أُرسل الإشعار. إذا لم يصلك خلال دقيقة، فتأكد أن إشعارات «رتّل» مسموحة في إعدادات الجهاز، وأن وضع «عدم الإزعاج» أو «التركيز» غير مفعّل.'; }
    catch (e) { note.textContent = e.message === 'too soon' ? 'انتظر نصف دقيقة ثم أعد المحاولة.' : 'تعذر الإرسال؛ جرّب إيقاف التنبيهات ثم تفعيلها من جديد.'; }
    setTimeout(() => { testBtn.disabled = false; }, 30000);
  } }, 'إرسال إشعار تجريبي');
  const save = async (rollback, perm) => {
    note.textContent = 'جارٍ الحفظ…';
    try {
      if ((await perm) === 'denied') { rollback(); note.textContent = STATUS_MSG.denied; return; }
      const ok = await syncPush({ ask: true });
      if (!ok) { rollback(); note.textContent = Notification?.permission === 'denied' ? STATUS_MSG.denied : 'لم يتم السماح بالإشعارات.'; return; }
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
    body.push(
      h('div.field', h('span', 'الأذان عند دخول وقت الصلاة'), chips,
        hasLoc ? null : h('small.muted', 'حدّد موقعك أولًا من شاشة المواقيت.')),
      h('label.toggle', h('span', h('strong', 'تشغيل صوت الأذان'), h('small', 'يُرفع الأذان كاملًا إذا كان التطبيق مفتوحًا، وعند الضغط على تنبيه الأذان')), inApp),
      h('button.btn.ghost.block', { type: 'button', onclick: () => playAdhan('test') }, 'استمع إلى الأذان'),
      h('p.small-note', 'ملاحظة: لا تسمح الهواتف لتطبيقات الويب بتشغيل صوت خاص مع الإشعار، فيصلك التنبيه بصوت الإشعارات المعتاد واهتزاز، ثم يُرفع الأذان كاملًا عند فتحه.'));
  }
  if (pushOk) {
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
    body.push(h('p.small-note', 'لتصلك التنبيهات والتطبيق مغلق، نحفظ على الخادم موقعك مقرّبًا (نحو ١ كم)، وطريقة الحساب، والمواعيد التي اخترتها فقط، بلا اسم أو أي بيانات أخرى. وإلغاء كل التنبيهات يحذفها من الخادم.'));
  }
  return h('section.card.notify-card', h('h2', 'التنبيهات'), ...body, status === 'ok' ? testBtn : null, note);
}
