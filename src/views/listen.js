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
  const card = h('section.listen-card', { 'aria-label': 'الاستماع' });
  const draw = () => {
    const st = player.state();
    const last = settings.get('lastListen');
    const lastRead = settings.get('lastRead');
    const rec = getReciter(settings.get('reciter'));
    const playing = st.status === 'playing' || st.status === 'loading';
    let title, sub, action;
    if (st.radio) {
      title = st.radio.name; sub = playing ? 'بث مباشر الآن' : 'متوقف';
      action = () => player.toggle();
    } else if (st.surah) {
      const m = getSurahMeta(st.surah);
      title = `سورة ${m.nameAr}`; sub = (playing ? 'يُتلى الآن' : 'متوقف') + (st.ayah ? `، الآية ${ar(st.ayah)}` : '');
      action = () => player.toggle();
    } else if (last?.surah) {
      const m = getSurahMeta(last.surah);
      title = `سورة ${m.nameAr}`; sub = `تابع الاستماع من الآية ${ar(last.ayah || 1)}`;
      action = () => { player.restore(last); player.resume(); };
    } else {
      const s = lastRead?.surah || 18;
      title = `سورة ${getSurahMeta(s).nameAr}`; sub = lastRead ? 'استمع إلى آخر سورة قرأتها' : 'ابدأ الاستماع';
      action = () => player.playFrom(s, 1);
    }
    card.replaceChildren(
      h('div.lc-top',
        h('span.lc-eyebrow', 'الاستماع'),
        h('button.lc-reciter', { type: 'button', onclick: () => reciterSheet(), 'aria-label': 'تغيير القارئ' }, icon('user'), h('span', st.radio ? 'إذاعة' : (getReciter(st.reciter || rec?.id)?.nameAr || rec?.nameAr || '')))),
      h('div.lc-main',
        h('button.lc-play', { type: 'button', onclick: action, 'aria-label': playing ? 'إيقاف مؤقت' : 'تشغيل' }, st.status === 'loading' ? h('span.spinner', { 'aria-hidden': 'true' }) : icon(playing ? 'pause' : 'play')),
        h('div.lc-text', h('strong', title), h('small', sub))),
      h('div.lc-actions',
        h('button.lc-chip', { type: 'button', onclick: async () => { const r = (await radios()).featured[0]; player.playRadio(r); } }, h('i.lc-live'), 'إذاعة القاهرة'),
        h('a.lc-chip', { href: '#/radio' }, icon('radio'), 'الإذاعات'),
        h('a.lc-chip', { href: '#/listen' }, icon('play'), 'اختر سورة')));
  };
  card.cleanup = player.subscribe(draw); // تستدعيها الشاشة عند مغادرتها
  draw();
  return card;
}

// ================= شاشة الاستماع =================
export function renderListen() {
  const input = h('input.note-input', { type: 'search', placeholder: 'ابحث عن سورة…', 'aria-label': 'ابحث عن سورة للاستماع' });
  const list = h('ul.ls-surahs');
  const draw = () => {
    const q = normalize(input.value.trim());
    const st = player.state();
    list.replaceChildren(...getSurahs().filter((s) => !q || normalize(s.nameAr).includes(q) || String(s.id) === q).map((s) => {
      const on = st.surah === s.id && !st.radio;
      return h('li', h('button.ls-item', { type: 'button', class: on ? 'ls-item on' : 'ls-item', onclick: () => (on ? player.toggle() : player.playFrom(s.id, 1)) },
        h('span.ls-num', ar(s.id)),
        h('span.ls-name', `سورة ${s.nameAr}`),
        h('small', `${ar(s.ayahCount)} آية`),
        icon(on && st.status === 'playing' ? 'pause' : 'play')));
    }));
  };
  input.addEventListener('input', draw);
  const unsub = player.subscribe(draw);
  draw();
  const lc = listenCard();
  const featured = h('div.ls-radios');
  radios().then((d) => featured.replaceChildren(...d.featured.slice(0, 3).map((r) => h('button.ls-radio', { type: 'button', onclick: () => player.playRadio(r) },
    h('i.lc-live'), h('span', h('strong', r.name), h('small', r.sub)))))).catch(() => {});
  mount(h('div.listen-page',
    topbar({ title: 'الاستماع', sub: 'تلاوات متصلة وإذاعات مباشرة' }),
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

// ================= شاشة المزيد =================
export function renderMore() {
  const row = (href, ic, title, sub) => h('a.more-row', { href }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon(ic)), h('span.lib-text', h('strong', title), sub ? h('small', sub) : null), icon('forward'));
  mount(h('div.more-page',
    topbar({ title: 'المزيد' }),
    h('h2.lib-h', 'القراءة والحفظ'),
    h('div.more-group',
      row('#/search', 'search', 'البحث في القرآن', 'بالكلمة أو بالجذر'),
      row('#/bookmarks', 'bookmark', 'العلامات والملاحظات'),
      row('#/khatma', 'book', 'الختمة والورد اليومي'),
      row('#/memorize', 'repeat', 'الحفظ والمراجعة'),
      row('#/group', 'users', 'الختمة الجماعية والمُهداة', 'اقرأوا معًا برابط واحد')),
    h('h2.lib-h', 'الاستماع'),
    h('div.more-group',
      row('#/car', 'play', 'وضع السيارة', 'أزرار كبيرة وتحكم صوتي'),
      row('#/downloads', 'download', 'التنزيلات والمساحة')),
    h('h2.lib-h', 'التطبيق'),
    h('div.more-group',
      row('#/settings', 'settings', 'الإعدادات', 'العرض والتلاوة والتنبيهات والنسخة الاحتياطية'),
      !isStandalone() ? h('button.more-row', { type: 'button', onclick: () => install() }, h('span.lib-icon', { 'aria-hidden': 'true' }, icon('download')), h('span.lib-text', h('strong', 'تثبيت التطبيق'), h('small', 'يفتح كتطبيق ويعمل بدون إنترنت')), icon('forward')) : null,
      row('#/about', 'info', 'عن التطبيق', 'المصادر والخصوصية والتواصل')),
    h('a.credit-foot', { href: '#/about' },
      h('span.cf-by', { dir: 'ltr' }, 'Powered by ', h('strong', 'Mohamed Mostafa')),
      h('span.cf-phone', 'للتواصل والدعم: ', h('bdi', { dir: 'ltr' }, '01120339097'))),
  ));
}
