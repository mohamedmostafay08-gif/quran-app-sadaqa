// بطاقة التنبيهات: أذان الصلوات + تذكير الورد اليومي (Web Push)
import { h, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { toast } from '../ui.js';
import { pushStatus, syncPush, PUSH_PRAYERS } from '../features/push.js';

const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const STATUS_MSG = {
  unsupported: 'المتصفح ده لا يدعم الإشعارات. جرّب Chrome أو Edge أو Firefox، أو ثبّت التطبيق.',
  'ios-install': 'على الآيفون: الإشعارات تعمل بعد تثبيت التطبيق على الشاشة الرئيسية (مشاركة ← «إضافة إلى الشاشة الرئيسية») ثم فتحه من الأيقونة.',
  denied: 'الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجوار العنوان) ثم ارجع هنا.',
};

export function notifyCard({ prayers = true, wird = true } = {}) {
  const status = pushStatus();
  const note = h('p.small-note', { 'aria-live': 'polite' });
  const save = async (rollback) => {
    note.textContent = 'جارٍ الحفظ…';
    try {
      const ok = await syncPush({ ask: true });
      if (!ok) { rollback(); note.textContent = Notification?.permission === 'denied' ? STATUS_MSG.denied : 'لم يتم السماح بالإشعارات.'; return; }
      note.textContent = '';
      toast('تم حفظ التنبيهات');
    } catch {
      rollback(); note.textContent = navigator.onLine ? 'تعذر الحفظ، حاول مرة أخرى.' : 'حفظ التنبيهات يحتاج اتصالًا بالإنترنت.';
    }
  };

  const body = [];
  if (status !== 'ok') body.push(h('p.muted', STATUS_MSG[status]));
  else {
    if (prayers) {
      const hasLoc = !!settings.get('prayerLocation');
      const chips = h('div.notify-chips', PUSH_PRAYERS.map((k) => {
        const on = () => (settings.get('notifyPrayers') || []).includes(k);
        const b = h('button.pb-chip', { type: 'button', 'aria-pressed': String(on()), disabled: !hasLoc, onclick: async () => {
          const before = settings.get('notifyPrayers') || [];
          const next = on() ? before.filter((x) => x !== k) : [...before, k];
          await settings.set('notifyPrayers', PUSH_PRAYERS.filter((x) => next.includes(x)));
          b.setAttribute('aria-pressed', String(on()));
          save(async () => { await settings.set('notifyPrayers', before); b.setAttribute('aria-pressed', String(on())); });
        } }, NAMES[k]);
        return b;
      }));
      body.push(h('div.field', h('span', 'تنبيه عند دخول وقت الصلاة'), chips,
        hasLoc ? null : h('small.muted', 'حدّد موقعك أولًا من شاشة المواقيت.')));
    }
    if (wird) {
      const time = h('input.note-input', { type: 'time', value: settings.get('wirdTime') || '', 'aria-label': 'موعد تذكير الورد' });
      const clear = h('button.btn.ghost', { type: 'button', hidden: !settings.get('wirdTime'), onclick: () => { time.value = ''; time.dispatchEvent(new Event('change')); } }, 'إيقاف');
      time.addEventListener('change', async () => {
        const before = settings.get('wirdTime');
        await settings.set('wirdTime', time.value || null);
        clear.hidden = !time.value;
        save(async () => { await settings.set('wirdTime', before); time.value = before || ''; clear.hidden = !before; });
      });
      body.push(h('div.field', h('span', 'تذكير بالورد اليومي'), h('div.notify-time', time, clear)));
    }
    body.push(h('p.small-note', 'لتصلك التنبيهات والتطبيق مغلق، نحفظ على الخادم: موقعك مقرّبًا (حوالي ١ كم)، وطريقة الحساب، والمواعيد التي اخترتها فقط — بلا اسم أو أي بيانات أخرى. إلغاء كل التنبيهات يحذفها من الخادم.'));
  }
  return h('section.card.notify-card', h('h2', 'التنبيهات'), ...body, note);
}
