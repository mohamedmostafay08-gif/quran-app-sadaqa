// إحصائياتي: القراءة والاستماع والتسبيح خلال الأسبوع، والأيام المتتالية — محفوظة على الجهاز فقط
import { h, ar } from '../lib/dom.js';
import { mount, topbar } from '../ui.js';
import { lastDays, streak } from '../features/activity.js';
import { badgesGrid } from '../features/badges.js';

const DAY = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' });
const streakLabel = (n) => (n === 0 ? 'ابدأ اليوم بصفحة واحدة' : n === 1 ? 'يوم مع القرآن' : n === 2 ? 'يومان متتاليان مع القرآن' : n <= 10 ? 'أيام متتالية مع القرآن' : 'يومًا متتاليًا مع القرآن');

export function renderStats() {
  const week = lastDays(7);
  const month = lastDays(30);
  const sum = (arr, k) => arr.reduce((n, d) => n + d[k], 0);
  const s = streak();
  const pagesW = sum(week, 'pages'), minW = sum(week, 'minutes'), tasW = sum(week, 'tasbih');
  const max = Math.max(1, ...week.map((d) => d.pages + d.minutes / 5));
  const tile = (value, label) => h('div.st-tile', h('strong', ar(value)), h('small', label));

  mount(h('div.stats-page',
    topbar({ title: 'إحصائياتي', sub: 'محفوظة على جهازك فقط', back: '#/' }),
    h('section.card.st-streak',
      s ? h('strong', ar(s)) : h('span.st-ic', '۞'),
      h('span', streakLabel(s))),
    h('h2.lib-h', 'آخر ٧ أيام'),
    h('div.st-tiles',
      tile(pagesW, 'صفحة قرأتها'),
      tile(minW, 'دقيقة استماع'),
      tile(tasW, 'تسبيحة')),
    h('section.card.st-chart', { 'aria-label': 'النشاط اليومي' },
      h('div.st-bars', week.map((d) => {
        const v = d.pages + d.minutes / 5;
        return h('div.st-bar', { title: `${ar(d.pages)} صفحة، ${ar(d.minutes)} دقيقة` },
          h('span.st-fill', { style: { height: `${Math.round((v / max) * 100)}%` } }),
          h('small', DAY.format(d.date)));
      })),
      h('p.small-note', 'طول العمود: الصفحات المقروءة مع دقائق الاستماع.')),
    h('h2.lib-h', 'آخر ٣٠ يومًا'),
    h('div.st-tiles',
      tile(sum(month, 'pages'), 'صفحة'),
      tile(sum(month, 'minutes'), 'دقيقة استماع'),
      tile(month.filter((d) => d.pages || d.minutes).length, 'يوم نشاط')),
    badgesGrid(),
  ));
}
