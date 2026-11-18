// اليوم: لوحة يومية — الصلاة القادمة، تفعيل الأذان، الاستماع، القراءة، الورد، أذكار الوقت، صحابي اليوم
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import * as P from '../features/prayer.js';
import { getSurahMeta, juzOf, pageOf } from '../data.js';
import { mount, toast } from '../ui.js';
import { listenCard } from './listen.js';
import { homeWirdCard } from './khatma.js';
import { sahabiTile } from './library.js';
import { pushStatus, askPermission, syncPush } from '../features/push.js';
import { upcomingOccasions } from './calendar.js';
import { streak } from '../features/activity.js';

export function renderToday() {
  const loc = P.getLocation();
  const prayer = h('a.td-prayer', { href: '#/prayer' });
  const drawPrayer = () => {
    if (!loc) {
      prayer.replaceChildren(h('span.td-ic', icon('mosque')), h('span.td-pt', h('strong', 'مواقيت الصلاة'), h('small', 'حدّد مدينتك لتظهر المواقيت ويُرفع الأذان')), icon('forward'));
      return;
    }
    try {
      const n = P.nextPrayer(loc);
      prayer.replaceChildren(
        h('span.td-pt', h('small', 'الصلاة القادمة'), h('strong', n.name), h('span.td-time', P.fmtTime(n.time, loc.tz))),
        h('span.td-left', h('small', 'بعد'), h('strong', P.countdown(n.time - new Date()))));
    } catch { prayer.replaceChildren(h('strong', 'مواقيت الصلاة')); }
  };
  drawPrayer();
  const timer = setInterval(drawPrayer, 30000);

  const lc = listenCard();
  const last = settings.get('lastRead');
  const quick = h('div.quick-row');
  homeWirdCard().then((w) => quick.prepend(w)).catch(() => {});
  quick.append(adhkarTile(loc), h('a.quick', { href: '#/tasbih' }, icon('repeat'), h('span', h('strong', 'السبحة'), h('small', 'عدّاد التسبيح'))), sahabiTile());
  const occ = upcomingOccasions(new Date(), 1)[0];
  const st = streak();
  quick.append(
    h('a.quick', { href: '#/calendar' }, icon('star'), h('span', h('strong', 'التقويم الهجري'),
      h('small', !occ ? 'المناسبات والأيام البيض' : occ.days === 0 ? `اليوم: ${occ.name}` : `${occ.name} بعد ${daysWord(occ.days)}`))),
    h('a.quick', { href: '#/stats' }, icon('timer'), h('span', h('strong', 'إحصائياتي'),
      h('small', st ? `${daysWord(st)} متتالية` : 'القراءة والاستماع هذا الأسبوع'))));

  mount(h('div.home.today',
    h('header.home-head',
      h('div.hh-brand', h('h1', 'رتّل'), h('span', P.hijri()?.text || 'القرآن الكريم')),
      h('a.icon-btn', { href: '#/help', 'aria-label': 'طريقة الاستخدام' }, icon('info'))),
    prayer,
    adhanCard(loc),
    lc,
    last ? continueCard(last) : null,
    fridayCard(),
    quick,
  ));
  return { cleanup() { clearInterval(timer); lc.cleanup(); } };
}

/** تفعيل تنبيهات الأذان بضغطة واحدة (يظهر فقط إن لم تُفعَّل بعد) */
function adhanCard(loc) {
  if (!loc || pushStatus() !== 'ok' || Notification.permission !== 'default' || !(settings.get('notifyPrayers') || []).length) return null;
  const card = h('section.td-adhan',
    h('span.td-ic', icon('bell')),
    h('span.td-pt', h('strong', 'تنبيه الأذان'), h('small', 'ليصلك الأذان في وقته والتطبيق مغلق')),
    h('button.btn', { type: 'button', onclick: async () => {
      const perm = askPermission();
      if ((await perm) !== 'granted') { toast('لم يتم السماح بالإشعارات'); return; }
      try { await syncPush({ ask: true }); toast('تم تفعيل تنبيه الأذان'); card.remove(); }
      catch { toast('تعذر التفعيل، حاول مرة أخرى'); }
    } }, 'تفعيل'));
  return card;
}

const daysWord = (n) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${ar(n)} أيام` : `${ar(n)} يومًا`);

/** يوم الجمعة: سورة الكهف */
function fridayCard() {
  if (new Date().getDay() !== 5) return null;
  return h('a.td-friday', { href: '#/surah/18' },
    h('span.td-ic', icon('book')),
    h('span.td-pt', h('strong', 'سورة الكهف'), h('small', 'يوم الجمعة: اقرأ سورة الكهف، وأكثر من الصلاة على النبي ﷺ')),
    icon('forward'));
}

/** أذكار الوقت: الصباح بعد الفجر، المساء بعد العصر، النوم بعد العشاء */
function adhkarTile(loc) {
  let id = 27, title = 'أذكار الصباح', sub = 'من الفجر إلى الظهر';
  try {
    const t = loc ? P.computeTimes(loc) : null;
    const now = new Date();
    if (t && now >= t.isha) { id = 28; title = 'أذكار النوم'; sub = 'قبل أن تنام'; }
    else if (t && now >= t.asr) { title = 'أذكار المساء'; sub = 'من العصر إلى المغرب'; }
    else if (t && now >= t.dhuhr) { id = 25; title = 'أذكار بعد الصلاة'; sub = 'بعد السلام من الصلاة'; }
    else if (!t) { const hr = now.getHours(); if (hr >= 15 && hr < 20) { title = 'أذكار المساء'; sub = 'من العصر إلى المغرب'; } else if (hr >= 20 || hr < 4) { id = 28; title = 'أذكار النوم'; sub = 'قبل أن تنام'; } }
  } catch { /* */ }
  return h('a.quick', { href: `#/adhkar/${id}` }, icon('note'), h('span', h('strong', title), h('small', sub)));
}

function continueCard(last) {
  const m = getSurahMeta(last.surah);
  return h('a.continue', { href: `#/surah/${last.surah}/${last.ayah}` },
    h('div',
      h('span.eyebrow', 'أكمل القراءة'),
      h('strong', `سورة ${m.nameAr}`),
      h('span.muted', `الآية ${ar(last.ayah)}، الجزء ${ar(juzOf(last.surah, last.ayah))}، صفحة ${ar(pageOf(last.surah, last.ayah))}`)),
    h('span.continue-go', icon('forward')));
}
