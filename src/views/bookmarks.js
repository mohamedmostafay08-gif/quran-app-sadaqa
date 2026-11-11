// العلامات المرجعية وآخر موضع
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import * as bookmarks from '../features/bookmarks.js';
import * as settings from '../state.js';
import { mount, topbar, empty, toast } from '../ui.js';

export async function renderBookmarks(_p, _q, isStale) {
  const list = await bookmarks.list();
  if (isStale()) return;
  const last = settings.get('lastRead');

  const ul = h('ul.bm-list');
  for (const b of list) {
    const m = getSurahMeta(b.surah);
    const text = (await getSurahText(b.surah))[b.ayah - 1];
    const li = h('li.bm',
      h('a.bm-link', { href: `#/surah/${b.surah}/${b.ayah}` },
        h('span.result-ref', `سورة ${m.nameAr} · الآية ${ar(b.ayah)}`),
        h('p.result-text.clamp', { lang: 'ar' }, text),
        h('time.muted', { datetime: new Date(b.createdAt).toISOString() }, new Date(b.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })),
      ),
      h('button.icon-btn', {
        type: 'button', 'aria-label': `حذف علامة سورة ${m.nameAr} الآية ${b.ayah}`,
        onclick: async () => { await bookmarks.remove(b.surah, b.ayah); li.remove(); toast('تم الحذف'); if (!ul.children.length) ul.replaceWith(none()); },
      }, icon('trash')),
    );
    ul.append(li);
  }

  const none = () => empty('bookmark', 'لا توجد علامات بعد', 'اضغط على أي آية أثناء القراءة واختر «إضافة علامة».');
  mount(h('div.bookmarks',
    topbar({ title: 'العلامات' }),
    last ? h('a.continue', { href: `#/surah/${last.surah}/${last.ayah}` },
      h('div', h('span.eyebrow', 'آخر موضع قراءة'), h('strong', `سورة ${getSurahMeta(last.surah).nameAr}`), h('span.muted', `الآية ${ar(last.ayah)}`)),
      h('span.continue-go', icon('forward'))) : null,
    h('h2.section-title', 'علاماتك'),
    list.length ? ul : none(),
  ));
}
