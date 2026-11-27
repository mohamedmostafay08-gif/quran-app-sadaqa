// الاستماع: بطاقة التلاوة في أعلى الرئيسية، وشاشة «الاستماع» (القارئ، الإذاعات، اختيار سورة)، وشاشة «المزيد»
import { h, icon, ar } from '../lib/dom.js';
import { normalize } from '../lib/arabic.js';
import * as settings from '../state.js';
import { player, getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import { getSurahs, getSurahMeta } from '../data.js';
import { mount, topbar } from '../ui.js';
import { install, isStandalone } from '../features/install.js';

let radiosP = null;
const radios = () => (radiosP ||= fetch(new URL('../../public/data/radios.json', import.meta.url)).then((r) => r.json()).catch((e) => { radiosP = null; throw e; }));

/** بطاقة الاستماع: تتابع حالة المشغّل (يُتلى الآن / تابع الاستماع / ابدأ) */
export function listenCard() {
  // البطاقة تُبنى مرة واحدة، ومع كل آية يتغير النص والأيقونة فقط (الأزرار نفسها تبقى فلا يضيع التركيز)
  let action = () => {};
  const reciterName = h('span');
  const playBtn = h('button.lc-play', { type: 'button', onclick: () => action() });
  const title = h('strong'), sub = h('small');
  const card = h('section.listen-card', { 'aria-label': 'الاستماع' },
    h('div.lc-top',
      h('span.lc-eyebrow', 'الاستماع'),
      h('button.lc-reciter', { type: 'button', onclick: () => reciterSheet(), 'aria-label': 'تغيير القارئ' }, icon('user'), reciterName)),
    h('div.lc-main', playBtn, h('div.lc-text', title, sub)),
    h('div.lc-actions',
      h('button.lc-chip', { type: 'button', onclick: async () => { const r = (await radios()).featured[0]; player.playRadio(r); } }, h('i.lc-live'), 'إذاعة القاهرة'),
      h('a.lc-chip', { href: '#/radio' }, icon('radio'), 'الإذاعات'),
      h('a.lc-chip', { href: '#/listen' }, icon('play'), 'اختر سورة')));
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  let iconKey = '';
  const draw = () => {
    const st = player.state();
    const last = settings.get('lastListen');
    const lastRead = settings.get('lastRead');
    const rec = getReciter(settings.get('reciter'));
    const playing = st.status === 'playing' || st.status === 'loading';
    let t, s;
    if (st.radio) {
      t = st.radio.name; s = st.radio.ondemand ? (st.radio.sub || '') : playing ? 'بث مباشر الآن' : 'متوقف';
      action = () => player.toggle();
    } else if (st.surah) {
      const m = getSurahMeta(st.surah);
      t = `سورة ${m.nameAr}`; s = (playing ? 'يُتلى الآن' : 'متوقف') + (st.ayah ? `، الآية ${ar(st.ayah)}` : '');
      action = () => player.toggle();
    } else if (last?.surah) {
      const m = getSurahMeta(last.surah);
      t = `سورة ${m.nameAr}`; s = `تابع الاستماع من الآية ${ar(last.ayah || 1)}`;
      action = () => { player.restore(last); player.resume(); };
    } else {
      const n = lastRead?.surah || 18;
      t = `سورة ${getSurahMeta(n).nameAr}`; s = lastRead ? 'استمع إلى آخر سورة قرأتها' : 'ابدأ الاستماع';
      action = () => player.playFrom(n, 1);
    }
    setText(title, t); setText(sub, s);
    setText(reciterName, st.radio ? (st.radio.ondemand ? 'تفسير' : 'إذاعة') : (getReciter(st.reciter || rec?.id)?.nameAr || rec?.nameAr || ''));
    const k = st.status === 'loading' ? 'loading' : playing ? 'pause' : 'play';
    if (k !== iconKey) {
      iconKey = k;
      playBtn.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
      playBtn.replaceChildren(k === 'loading' ? h('span.spinner', { 'aria-hidden': 'true' }) : icon(k));
    }
  };
  card.cleanup = player.subscribe(draw); // تستدعيها الشاشة عند مغادرتها
  draw();
  return card;
}

// ================= شاشة الاستماع =================
export function renderListen() {
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن سورة…', 'aria-label': 'ابحث عن سورة للاستماع' });
  // القائمة تُبنى مرة واحدة؛ مع كل تحديث يتغير صف السورة السابقة والحالية فقط
  const items = new Map();
  const isOn = (id) => { const st = player.state(); return st.surah === id && !st.radio; };
  const paint = (ref) => {
    const st = player.state();
    const on = isOn(ref.s.id);
    const mode = on ? st.status : 'off';
    if (mode === ref.mode) return;
    ref.mode = mode;
    ref.btn.classList.toggle('on', on);
    ref.btn.setAttribute('aria-pressed', String(on && st.status === 'playing'));
    ref.btn.lastChild.replaceWith(icon(on && st.status === 'playing' ? 'pause' : 'play'));
  };
  const list = h('ul.ls-surahs', getSurahs().map((s) => {
    const btn = h('button.ls-item', { type: 'button', dataset: { surah: s.id }, onclick: () => (isOn(s.id) ? player.toggle() : player.playFrom(s.id, 1)) },
      h('span.ls-num', ar(s.id)), h('span.ls-name', `سورة ${s.nameAr}`), h('small', `${ar(s.ayahCount)} آية`), icon('play'));
    const ref = { s, btn, li: h('li', btn), name: normalize(s.nameAr), mode: null };
    items.set(s.id, ref);
    paint(ref);
    return ref.li;
  }));
  input.addEventListener('input', () => {
    const q = normalize(input.value.trim());
    for (const ref of items.values()) ref.li.hidden = !!q && !ref.name.includes(q) && String(ref.s.id) !== q;
  });
  let lastId = player.state().surah;
  const unsub = player.subscribe((st) => {
    if (lastId !== st.surah && items.has(lastId)) paint(items.get(lastId));
    if (items.has(st.surah)) paint(items.get(st.surah));
    lastId = st.surah;
  });
  const lc = listenCard();
  const featured = h('div.ls-radios');
  radios().then((d) => featured.replaceChildren(...d.featured.slice(0, 3).map((r) => h('button.ls-radio', { type: 'button', onclick: () => player.playRadio(r) },
    h('i.lc-live'), h('span', h('strong', r.name), h('small', r.sub)))))).catch(() => {});
  mount(h('div.listen-page',
    topbar({ title: 'التلاوات والإذاعة', sub: 'استمع إلى القرآن الكريم' }),
    lc,
    h('h2.lib-h', 'إذاعات مباشرة'),
    featured,
    h('a.row-btn.ls-more', { href: '#/radio' }, h('span', h('strong', 'كل الإذاعات'), h('small', 'القاهرة والسعودية وإذاعة لكل قارئ')), icon('forward')),
    h('h2.lib-h', 'استمع إلى سورة'),
    h('div.hd-tools', input),
    list,
    h('a.row-btn.ls-more', { href: '#/downloads' }, h('span', h('strong', 'التنزيلات'), h('small', 'نزّل السور للاستماع بدون إنترنت')), icon('download')),
  ));
  return { cleanup() { unsub(); lc.cleanup(); } };
}

// ================= شاشة الأذكار والأدعية =================
export function renderAdhkar() {
  const row = (href, ic, title, sub) => h('a.more-row', { href }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon(ic)), h('span.lib-text', h('strong', title), sub ? h('small', sub) : null), icon('forward'));
  mount(h('div.more-page',
    topbar({ title: 'الأذكار والأدعية' }),
    h('h2.lib-h', 'الأذكار اليومية'),
    h('div.more-group',
      row('#/adhkar/27?period=sabah', 'sun', 'أذكار الصباح', 'أذكار الحصن من صحيح السنة'),
      row('#/adhkar/27?period=masa', 'moon', 'أذكار المساء', 'أذكار الحصن من صحيح السنة'),
      row('#/adhkar/28', 'moon', 'أذكار النوم', 'قبل النوم حتى تنام'),
      row('#/adhkar/1', 'sun', 'أذكار الاستيقاظ', 'أول ما تفتح عينيك')),
    h('h2.lib-h', 'الأدعية والتسبيح'),
    h('div.more-group',
      row('#/duas', 'heart', 'الأدعية', 'أدعية المناسبات من القرآن والسنة الصحيحة'),
      row('#/asma', 'star', 'أسماء الله الحسنى', 'التسعة والتسعون مع معانيها'),
      row('#/tasbih', 'repeat', 'السبحة', 'عدّاد التسبيح بأذكار جاهزة')),
    h('h2.lib-h', 'كل الأذكار'),
    h('a.row-btn.ls-more', { href: '#/prayer?tab=adhkar' }, h('span', h('strong', 'مكتبة الأذكار الكاملة'), h('small', 'حصن المسلم مرتّب بالمواقف')), icon('forward')),
  ));
}

// ================= شاشة المزيد =================
export function renderMore() {
  const row = (href, ic, title, sub) => h('a.more-row', { href }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon(ic)), h('span.lib-text', h('strong', title), sub ? h('small', sub) : null), icon('forward'));
  mount(h('div.more-page',
    topbar({ title: 'المعرفة' }),
    h('h2.lib-h', 'القصص والسيرة'),
    h('div.more-group',
      row('#/prophets', 'users', 'قصص الأنبياء والمعجزات', 'القصص مع آياتها، ومعجزات بصور تخيلية'),
      row('#/sahabi', 'star', 'قصص الصحابة', 'قصص الصحابة رضي الله عنهم')),
    h('h2.lib-h', 'العلم والمعرفة'),
    h('div.more-group',
      row('#/library', 'library', 'المكتبة', 'أحاديث صحيحة، ودليل الوضوء والصلاة، وغيرها'),
      row('#/nawawi', 'book', 'الأربعون النووية', 'اقرأ واحفظ'),
      row('#/lessons', 'users', 'دروس المشايخ', 'الشعراوي وابن عثيمين وابن باز وعمر عبد الكافي وغيرهم')),
    h('h2.lib-h', 'أدوات ووضعيات'),
    h('div.more-group',
      row('#/sleep', 'moon', 'روتين النوم', 'أذكار النوم وسورة الملك بمؤقت'),
      row('#/car', 'play', 'وضع السيارة', 'أزرار كبيرة وتحكم صوتي'),
      row('#/kids', 'star', 'وضع الأطفال', 'حفظ جزء عمّ بالنجوم'),
      row('#/elder', 'user', 'وضع كبار السن', 'أزرار كبيرة وخط كبير'),
      row('#/greetings', 'share', 'بطاقات التهنئة', 'رمضان والعيدين والجمعة'),
      row('#/wallpaper', 'download', 'خلفيات للموبايل', 'آية أو ذكر بخط المصحف')),
    h('h2.lib-h', 'التطبيق'),
    h('div.more-group',
      row('#/stats', 'timer', 'إحصائياتي', 'القراءة والاستماع والشارات'),
      row('#/settings', 'settings', 'الإعدادات', 'العرض والتلاوة والتنبيهات والنسخة الاحتياطية'),
      !isStandalone() ? h('button.more-row', { type: 'button', onclick: () => install() }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon('download')), h('span.lib-text', h('strong', 'تثبيت التطبيق'), h('small', 'يفتح كتطبيق ويعمل بدون إنترنت')), icon('forward')) : null,
      row('#/whats-new', 'star', 'ما الجديد', 'آخر الإضافات في التطبيق'),
      row('#/help', 'info', 'طريقة الاستخدام', 'شرح سريع لكل أقسام التطبيق'),
      row('#/about', 'heart', 'عن التطبيق', 'التواصل والدعم')),
    h('a.credit-foot', { href: '#/about' },
      h('span.cf-by', { dir: 'ltr' }, 'Powered by ', h('strong', 'Mohamed Mostafa')),
      h('span.cf-phone', 'للتواصل والدعم: ', h('bdi', { dir: 'ltr' }, '01120339097'))),
  ));
}
