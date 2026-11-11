// الحفظ والمراجعة: تمرين بالإخفاء التدريجي + التكرار + جلسة مراجعة SRS
import { h, icon, ar } from '../lib/dom.js';
import { getSurahs, getSurahMeta, getSurahText } from '../data.js';
import * as srs from '../features/srs.js';
import { player } from '../audio/player.js';
import { mount, topbar, toast, empty } from '../ui.js';
import { navigate } from '../router.js';
import { stripDiacritics } from '../lib/arabic.js';

const LEVELS = ['كامل', '٢٥٪', '٥٠٪', '٧٥٪', 'أوائل الحروف', 'مخفي'];

// ---------- الشاشة الرئيسية للحفظ ----------
export async function renderMemorize(_p, query, isStale) {
  if (query.mode === 'practice') return renderPractice(query, isStale);
  if (query.mode === 'review') return renderReview(isStale);

  const [dueList, sum] = await Promise.all([srs.due(), srs.summary()]);
  if (isStale()) return;

  // اختيار نطاق جديد
  const surahSel = h('select', { 'aria-label': 'السورة' }, getSurahs().map((s) => h('option', { value: String(s.id) }, `${ar(s.id)}. ${s.nameAr}`)));
  surahSel.value = '78';
  const fromIn = h('input', { type: 'number', min: '1', inputmode: 'numeric', 'aria-label': 'من آية', value: '1' });
  const toIn = h('input', { type: 'number', min: '1', inputmode: 'numeric', 'aria-label': 'إلى آية' });
  const syncMax = () => {
    const m = getSurahMeta(+surahSel.value);
    fromIn.max = toIn.max = String(m.ayahCount);
    toIn.value = String(Math.min(m.ayahCount, 5));
    fromIn.value = '1';
  };
  surahSel.addEventListener('change', syncMax);
  syncMax();

  const go = () => {
    const s = +surahSel.value, m = getSurahMeta(s);
    const from = Math.max(1, Math.min(m.ayahCount, parseInt(fromIn.value, 10) || 1));
    const to = Math.max(from, Math.min(m.ayahCount, parseInt(toIn.value, 10) || from));
    navigate(`/memorize?mode=practice&s=${s}&from=${from}&to=${to}`);
  };

  mount(h('div.memorize',
    topbar({ title: 'الحفظ والمراجعة', back: '#/' }),
    h('section.card.review-card',
      h('div.kc-head',
        h('div', h('span.eyebrow', 'راجع النهارده'), h('h2', dueList.length ? `${ar(dueList.length)} آية للمراجعة` : 'لا توجد مراجعات اليوم')),
        h('div.big-num', { 'aria-hidden': 'true' }, ar(dueList.length)),
      ),
      dueList.length
        ? h('button.btn', { type: 'button', onclick: () => navigate('/memorize?mode=review') }, icon('repeat'), 'ابدأ المراجعة')
        : h('p.muted', sum.length ? 'أحسنت! عُد غدًا لمراجعة ما حفظت.' : 'ابدأ بحفظ نطاق من الآيات، وسنذكّرك بمراجعتها في الوقت المناسب.'),
    ),
    h('section.card',
      h('h2', 'حفظ جديد'),
      h('div.form',
        h('label.field', h('span', 'السورة'), surahSel),
        h('div.two-col', h('label.field', h('span', 'من آية'), fromIn), h('label.field', h('span', 'إلى آية'), toIn)),
        h('button.btn', { type: 'button', onclick: go }, icon('book'), 'ابدأ التمرين'),
      ),
    ),
    sum.length ? h('section.card',
      h('h2', 'محفوظاتي'),
      h('ul.mem-list', sum.map((x) => {
        const m = getSurahMeta(x.surah);
        return h('li',
          h('div', h('strong', `سورة ${m.nameAr}`), h('span.muted', `${ar(x.count)} من ${ar(m.ayahCount)} آية · ${ar(x.mature)} راسخة${x.due ? ` · ${ar(x.due)} مستحقة` : ''}`),
            h('div.bar.thin', h('span', { style: { width: `${(x.count / m.ayahCount) * 100}%` } }))),
          h('button.icon-btn', { type: 'button', 'aria-label': `حذف سورة ${m.nameAr} من المحفوظات`, onclick: async (e) => {
            if (!confirm(`حذف سورة ${m.nameAr} من جدول المراجعة؟`)) return;
            await srs.removeSurah(x.surah); e.currentTarget.closest('li').remove(); toast('تم الحذف');
          } }, icon('trash')),
        );
      })),
    ) : null,
  ));
}

// ---------- التمرين: إخفاء تدريجي + تكرار ----------
async function renderPractice(q, isStale) {
  const s = +q.s, m = getSurahMeta(s);
  const from = +q.from, to = +q.to;
  const ayahs = (await getSurahText(s)).slice(from - 1, to);
  if (isStale()) return;

  let level = 0;
  let times = 3;
  const box = h('div.practice', { lang: 'ar' });
  const draw = () => {
    box.replaceChildren(...ayahs.map((t, i) => {
      const a = from + i;
      const words = t.split(' ');
      const hide = srs.hiddenWords(words, level, a);
      return h('p.p-ayah', words.flatMap((w, k) => {
        const el = !hide.has(k) ? h('span.w', w)
          : h('button.w.hidden', { type: 'button', 'aria-label': 'كلمة مخفية — اضغط لإظهارها', onclick: (e) => { e.currentTarget.replaceWith(h('span.w.revealed', w)); } },
            level === 4 ? stripDiacritics(w).replace(/^\u0671/, '\u0627').charAt(0) + '\u2026' : '\u2003\u2003');
        return k ? [' ', el] : [el];
      }), ' ', h('span.ayah-num', { 'aria-hidden': 'true' }, '۝' + ar(a)));
    }));
  };
  const levelSeg = h('div.seg.levels', { role: 'radiogroup', 'aria-label': 'مستوى الإخفاء' }, LEVELS.map((label, i) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(i === level),
    onclick: (e) => { level = i; for (const b of levelSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
  }, label)));
  const timesSeg = h('div.seg', { role: 'radiogroup', 'aria-label': 'عدد مرات تكرار كل آية' }, [1, 3, 5, 7, 10].map((n) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(n === times),
    onclick: (e) => { times = n; for (const b of timesSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); },
  }, `${ar(n)}×`)));

  draw();
  mount(h('div.memorize',
    topbar({ title: `حفظ: سورة ${m.nameAr}`, sub: `الآيات ${ar(from)}–${ar(to)}`, back: '#/memorize' }),
    h('section.card',
      h('div.field', h('span', 'إخفاء الكلمات'), levelSeg),
      h('div.field', h('span', 'تكرار كل آية'), timesSeg),
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: () => {
          player.playFrom(s, from, { range: { from: { surah: s, ayah: from }, to: { surah: s, ayah: to }, loop: true, times }, noBasmala: true, times });
          toast(`تكرار كل آية ${ar(times)} مرات، ثم إعادة النطاق`);
        } }, icon('repeat'), 'استمع وكرّر'),
        h('button.btn.ghost', { type: 'button', onclick: () => player.stop() }, icon('stop'), 'إيقاف'),
      ),
    ),
    box,
    h('section.card',
      h('p', 'بعد ما تتقن النطاق، أضفه لجدول المراجعة وهنذكّرك بيه في الوقت المناسب.'),
      h('button.btn.block', { type: 'button', onclick: async () => {
        const n = await srs.addRange(s, from, to);
        toast(n ? `أُضيفت ${ar(n)} آية للمراجعة` : 'الآيات موجودة بالفعل في المراجعة');
        navigate('/memorize');
      } }, icon('check'), 'أتقنتها — أضفها للمراجعة'),
    ),
  ));
  return { cleanup: () => { if (player.state().range?.loop) player.stop(); } };
}

// ---------- جلسة المراجعة ----------
async function renderReview(isStale) {
  const queue = await srs.due();
  if (isStale()) return;
  let i = 0;
  let done = 0;
  const stage = h('div.review-stage');
  const progress = h('div.bar', h('span'));

  const show = async () => {
    progress.firstChild.style.width = `${(done / Math.max(1, done + queue.length - i)) * 100}%`;
    if (i >= queue.length) {
      stage.replaceChildren(empty('check', 'انتهت مراجعة اليوم', `راجعت ${ar(done)} آية. بارك الله فيك.`, h('a.btn', { href: '#/memorize' }, 'رجوع')));
      return;
    }
    const item = queue[i];
    const m = getSurahMeta(item.surah);
    const text = (await getSurahText(item.surah))[item.ayah - 1];
    const prev = item.ayah > 1 ? (await getSurahText(item.surah))[item.ayah - 2] : null;
    const words = text.split(' ');
    const answer = h('p.review-answer', { lang: 'ar', hidden: true }, text, ' ', h('span.ayah-num', '۝' + ar(item.ayah)));
    const grades = h('div.grades', { hidden: true }, srs.GRADES.map((g) => h(`button.grade.${g.cls}`, { type: 'button', onclick: async () => {
      const n = await srs.grade(item, g.q);
      if (n.interval === 0) queue.push(n); // نعيدها في نفس الجلسة
      else done++;
      i++;
      show();
    } }, h('strong', g.label), h('small', srs.intervalLabel(item, g.q).replace(/[\d.]+/g, ar)))));
    const reveal = h('button.btn.block', { type: 'button', onclick: () => { answer.hidden = false; grades.hidden = false; reveal.hidden = true; } }, 'اعرض الآية');
    stage.replaceChildren(
      h('p.result-ref', `سورة ${m.nameAr} · الآية ${ar(item.ayah)}`),
      prev ? h('p.review-prev', { lang: 'ar' }, h('small', 'الآية السابقة: '), prev) : h('p.muted', 'أول السورة'),
      h('p.review-cue', { lang: 'ar' }, `${words[0]} …`),
      h('div.btn-row', h('button.btn.ghost', { type: 'button', onclick: () => player.playFrom(item.surah, item.ayah, { only: true, times: 1 }) }, icon('play'), 'استمع')),
      reveal, answer, grades,
    );
  };
  mount(h('div.memorize', topbar({ title: 'مراجعة اليوم', back: '#/memorize' }), progress, stage));
  show();
}
