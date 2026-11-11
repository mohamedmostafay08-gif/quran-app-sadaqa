// الرئيسية: متابعة القراءة + قائمة السور/الأجزاء
import { h, icon, ar } from '../lib/dom.js';
import { normalize, latinDigits } from '../lib/arabic.js';
import { getSurahs, getSurahMeta, juzStart, juzOf, pageOf } from '../data.js';
import * as settings from '../state.js';
import { mount } from '../ui.js';
import { navigate } from '../router.js';
import { homeWirdCard } from './khatma.js';
import * as srs from '../features/srs.js';
import * as P from '../features/prayer.js';

let tab = 'surahs';

export function renderHome() {
  const surahs = getSurahs();
  const last = settings.get('lastRead');

  const listWrap = h('div.list-wrap');
  const input = h('input.search-input', {
    type: 'search', placeholder: 'ابحث عن سورة أو آية…', 'aria-label': 'ابحث عن سورة أو آية',
    enterkeyhint: 'search', autocomplete: 'off',
  });

  const renderList = () => {
    const q = input.value.trim();
    listWrap.replaceChildren(tab === 'juz' && !q ? juzList() : surahList(surahs, q));
  };
  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) navigate('/search?q=' + encodeURIComponent(input.value.trim()));
  });

  const tabs = h('div.seg', { role: 'tablist', 'aria-label': 'طريقة العرض' },
    ['surahs', 'juz'].map((t) => h('button', {
      role: 'tab', type: 'button', 'aria-selected': String(tab === t),
      onclick: (e) => {
        tab = t;
        for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget));
        renderList();
      },
    }, t === 'surahs' ? 'السور' : 'الأجزاء')),
  );

  const quick = h('div.quick-row');
  Promise.all([homeWirdCard(), srs.due()]).then(([wird, due]) => {
    quick.append(
      wird,
      h('a.quick', { href: '#/memorize' }, icon('repeat'), h('span', h('strong', 'الحفظ والمراجعة'), h('small', due.length ? `${ar(due.length)} آية للمراجعة اليوم` : 'إخفاء تدريجي وتكرار'))),
      h('a.quick', { href: '#/group' }, icon('user'), h('span', h('strong', 'ختمة جماعية أو مُهداة'), h('small', 'اقرأوا معًا برابط واحد'))),
      h('a.quick', { href: '#/car' }, icon('play'), h('span', h('strong', 'وضع السيارة'), h('small', 'أزرار كبيرة وتحكم صوتي'))),
    );
  });
  const el = h('div.home',
    h('header.hero',
      h('div.hero-frame',
        h('div.hero-mark', { 'aria-hidden': 'true' }, '۞'),
        h('h1', 'رتّل'),
        h('span.hero-sub', 'القرآن الكريم، برواية حفص عن عاصم'),
      ),
      h('p.hero-date', P.hijri()?.text || ''),
      prayerPill(),
    ),
    h('form.search-bar', { role: 'search', onsubmit: (e) => e.preventDefault() }, icon('search'), input),
    last ? continueCard(last) : null,
    quick,
    tabs,
    listWrap,
    h('p.home-foot', h('a', { href: 'sura/' }, 'السور مكتوبة كاملة (صفحات للقراءة والمشاركة)')),
  );
  renderList();
  mount(el);
}

function continueCard(last) {
  const m = getSurahMeta(last.surah);
  return h('a.continue', { href: `#/surah/${last.surah}/${last.ayah}` },
    h('div',
      h('span.eyebrow', 'أكمل القراءة'),
      h('strong', `سورة ${m.nameAr}`),
      h('span.muted', `الآية ${ar(last.ayah)}، الجزء ${ar(juzOf(last.surah, last.ayah))}، صفحة ${ar(pageOf(last.surah, last.ayah))}`),
    ),
    h('span.continue-go', icon('forward')),
  );
}

function surahList(surahs, q) {
  let items = surahs;
  if (q) {
    const nq = normalize(q);
    const num = parseInt(latinDigits(q), 10);
    items = surahs.filter((s) => normalize(s.nameAr).includes(nq) || s.nameEn.toLowerCase().includes(q.toLowerCase()) || s.id === num);
    // مرجع مباشر مثل 2:255
    const ref = latinDigits(q).match(/^(\d{1,3})\s*[:：/.\-]\s*(\d{1,3})$/);
    if (ref) {
      const s = +ref[1], a = +ref[2];
      const m = surahs[s - 1];
      if (m && a >= 1 && a <= m.ayahCount) {
        return h('ul.surah-list', h('li', h('a.surah-item', { href: `#/surah/${s}/${a}` },
          h('span.surah-num', ar(s)), h('span.surah-main', h('strong', `سورة ${m.nameAr} — الآية ${ar(a)}`), h('span.muted', 'انتقال مباشر')),
        )));
      }
    }
    if (!items.length) {
      return h('div.hint', 'لا توجد سورة بهذا الاسم. اضغط ', h('kbd', 'Enter'), ' للبحث في نص القرآن.');
    }
  }
  return h('ul.surah-list', items.map((s) => h('li', h('a.surah-item', { href: `#/surah/${s.id}` },
    h('span.surah-num', { 'aria-hidden': 'true' }, ar(s.id)),
    h('span.surah-main',
      h('strong', `سورة ${s.nameAr}`),
      h('span.muted', `${s.revelation === 'Meccan' ? 'مكية' : 'مدنية'}، ${ar(s.ayahCount)} آية`),
    ),
    h('span.surah-en', { lang: 'en', dir: 'ltr' }, s.nameEn),
  ))));
}

const JUZ_NAMES = ['الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا', 'يعتذرون', 'وما من دابة', 'وما أبرئ', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب للناس', 'قد أفلح', 'وقال الذين', 'أمن خلق', 'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'];

function juzList() {
  return h('ul.surah-list', Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    const st = juzStart(n);
    const m = getSurahMeta(st.surah);
    return h('li', h('a.surah-item', { href: `#/surah/${st.surah}/${st.ayah}` },
      h('span.surah-num', { 'aria-hidden': 'true' }, ar(n)),
      h('span.surah-main', h('strong', `الجزء ${ar(n)}`), h('span.muted', `يبدأ من سورة ${m.nameAr}، الآية ${ar(st.ayah)}، صفحة ${ar(pageOf(st.surah, st.ayah))}`)),
      h('span.surah-en', JUZ_NAMES[i]),
    ));
  }));
}

function prayerPill() {
  const loc = P.getLocation();
  if (!loc) return h('a.pr-pill', { href: '#/prayer' }, icon('mosque'), 'حدّد موقعك لمواقيت الصلاة');
  try {
    const n = P.nextPrayer(loc);
    return h('a.pr-pill', { href: '#/prayer' }, icon('mosque'), `${n.name} ${P.fmtTime(n.time, loc.tz)}، بعد ${P.countdown(n.time - new Date())}`);
  } catch { return null; }
}
