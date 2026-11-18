// «ما الجديد»: تعريف المستخدم بالمميزات الجديدة في شريط التحديث، ثم نافذة أنيقة بعد التحديث مرة واحدة
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { sheet, mount, topbar } from '../ui.js';

const SEEN = 'qa:seenRelease';
const lsGet = () => { try { return localStorage.getItem(SEEN); } catch { return null; } };
const lsSet = (v) => { try { localStorage.setItem(SEEN, v); } catch { /* محظور */ } };

let dataP = null;
export const loadReleases = () => (dataP ||= fetch(new URL('../../public/data/whats-new.json', import.meta.url).href, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null)).then((d) => d?.releases || []).catch(() => { dataP = null; return []; }));

/** نص قصير لشريط التحديث: أسماء أهم المميزات الجديدة */
export async function bannerSummary() {
  const [latest] = await loadReleases();
  if (!latest || latest.id === lsGet()) return null;
  const names = latest.items.slice(0, 3).map((x) => x[1]);
  return `الجديد: ${names.join('، ')}${latest.items.length > 3 ? ' وأكثر' : ''}`;
}

const itemNode = (close) => ([ic, title, desc, href]) => h('li', h('a.wn-item', { href, onclick: () => close?.() },
  h('span.wn-ic', { 'aria-hidden': 'true' }, icon(ic)),
  h('span.wn-t', h('strong', title), h('small', desc)),
  icon('back')));

function releaseBlock(r, close, showTitle) {
  return h('section.wn-rel', showTitle ? h('h3.wn-rel-h', r.title) : null, h('ul.wn-list', r.items.map(itemNode(close))));
}

/** النافذة بعد التحديث: الإصدارات الأحدث مما رآه المستخدم */
export function showWhatsNew(releases) {
  if (!releases.length) return;
  sheet({ title: 'الجديد في «رتّل»', content: (close) => h('div.wn-sheet',
    h('div.wn-hero', h('img', { src: 'public/icons/icon-192.png', alt: '', width: 56, height: 56 }),
      h('div', h('strong', releases[0].title), h('small', 'تم تحديث التطبيق، وهذه أهم الإضافات'))),
    ...releases.map((r) => releaseBlock(r, close, releases.length > 1)),
    h('button.btn.block', { type: 'button', onclick: () => close() }, 'ابدأ الاستخدام')) });
}

/** عند فتح التطبيق: إن كان هناك جديد لم يره المستخدم نعرضه مرة واحدة */
export async function checkWhatsNew() {
  const list = await loadReleases();
  if (!list.length) return;
  const seen = lsGet();
  lsSet(list[0].id);
  if (seen === list[0].id) return;
  // مستخدم جديد تمامًا: لا نعرض شيئًا (شاشة الترحيب تكفيه)
  if (!seen && !settings.get('onboarded')) return;
  const i = seen ? list.findIndex((r) => r.id === seen) : 1;
  const fresh = list.slice(0, i < 0 ? 2 : Math.max(1, Math.min(i, 3)));
  setTimeout(() => showWhatsNew(fresh), 900);
}

/** صفحة «ما الجديد» الكاملة */
export async function renderWhatsNew() {
  const list = await loadReleases();
  mount(h('div.whatsnew-page',
    topbar({ title: 'ما الجديد', back: '#/more' }),
    list.length ? list.map((r, i) => h('section.card.wn-card',
      h('div.wn-card-h', h('strong', r.title), i === 0 ? h('span.hd-badge.hd-grade', 'الأحدث') : null),
      h('ul.wn-list', r.items.map(itemNode())))) : h('p.muted', 'تحتاج اتصالًا بالإنترنت.'),
    h('p.small-note', `${ar(list.reduce((n, r) => n + r.items.length, 0))} إضافة في آخر التحديثات`)));
}
