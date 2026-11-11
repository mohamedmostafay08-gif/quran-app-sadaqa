// العلامات المرجعية + الملاحظات والتظليل (مع التصدير والاستيراد)
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import * as bookmarks from '../features/bookmarks.js';
import * as notes from '../features/notes.js';
import * as settings from '../state.js';
import { mount, topbar, empty, toast } from '../ui.js';

let tab = 'bookmarks';

export async function renderBookmarks(_p, query, isStale) {
  if (query.tab) tab = query.tab;
  const [bList, nList] = await Promise.all([bookmarks.list(), notes.list()]);
  if (isStale()) return;
  const last = settings.get('lastRead');
  const panel = h('div');

  const fmtDate = (t) => new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

  const bookmarksPanel = async () => {
    if (!bList.length) return empty('bookmark', 'لا توجد علامات بعد', 'اضغط على أي آية أثناء القراءة واختر «إضافة علامة».');
    const ul = h('ul.bm-list');
    for (const b of bList) {
      const m = getSurahMeta(b.surah);
      const text = (await getSurahText(b.surah))[b.ayah - 1];
      const li = h('li.bm',
        h('a.bm-link', { href: `#/surah/${b.surah}/${b.ayah}` },
          h('span.result-ref', `سورة ${m.nameAr}، الآية ${ar(b.ayah)}`),
          h('p.result-text.clamp', { lang: 'ar' }, text),
          h('time.muted', { datetime: new Date(b.createdAt).toISOString() }, fmtDate(b.createdAt)),
        ),
        h('button.icon-btn', {
          type: 'button', 'aria-label': `حذف علامة سورة ${m.nameAr} الآية ${b.ayah}`,
          onclick: async () => {
            await bookmarks.remove(b.surah, b.ayah);
            bList.splice(bList.indexOf(b), 1);
            li.remove(); toast('تم الحذف');
            if (!bList.length) draw();
          },
        }, icon('trash')),
      );
      ul.append(li);
    }
    return ul;
  };

  const notesPanel = async () => {
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      try { const n = await notes.importJSON(await f.text()); toast(`تم استيراد ${ar(n)} ملاحظة`); dispatchEvent(new HashChangeEvent('hashchange')); }
      catch { toast('الملف غير صالح'); }
    });
    const tools = h('div.btn-row',
      nList.length ? h('button.btn.ghost', { type: 'button', onclick: async () => notes.download('ملاحظاتي-القرآن.txt', await notes.exportText()) }, icon('download'), 'تصدير نص') : null,
      nList.length ? h('button.btn.ghost', { type: 'button', onclick: async () => notes.download('quran-notes.json', await notes.exportJSON(), 'application/json') }, icon('download'), 'نسخة احتياطية') : null,
      h('button.btn.ghost', { type: 'button', onclick: () => fileIn.click() }, 'استيراد'),
      fileIn,
    );
    if (!nList.length) return h('div', empty('note', 'لا توجد ملاحظات بعد', 'اضغط على أي آية واختر «ملاحظة وتظليل» لتكتب تدبرك أو تلوّن الآية.'), tools);
    const ul = h('ul.bm-list');
    for (const n of nList) {
      const m = getSurahMeta(n.surah);
      const text = (await getSurahText(n.surah))[n.ayah - 1];
      ul.append(h('li.bm',
        h('a.bm-link', { href: `#/surah/${n.surah}/${n.ayah}` },
          h('span.result-ref', n.color ? h('span', { class: `dot sw-${n.color}`, 'aria-hidden': 'true' }) : null, `سورة ${m.nameAr}، الآية ${ar(n.ayah)}`),
          h('p.result-text.clamp', { lang: 'ar', class: `result-text clamp${n.color ? ` hl-${n.color}` : ''}` }, text),
          n.text ? h('p.note-text', n.text) : null,
          h('time.muted', fmtDate(n.updatedAt)),
        ),
      ));
    }
    return h('div', tools, ul);
  };

  const tabs = h('div.seg', { role: 'tablist' }, [['bookmarks', `العلامات (${ar(bList.length)})`], ['notes', `الملاحظات (${ar(nList.length)})`]].map(([t, label]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(tab === t),
    onclick: (e) => { tab = t; for (const b of tabs.children) b.setAttribute('aria-selected', String(b === e.currentTarget)); draw(); },
  }, label)));

  const draw = async () => panel.replaceChildren(await (tab === 'notes' ? notesPanel() : bookmarksPanel()));

  mount(h('div.bookmarks',
    topbar({ title: 'العلامات والملاحظات' }),
    last ? h('a.continue', { href: `#/surah/${last.surah}/${last.ayah}` },
      h('div', h('span.eyebrow', 'آخر موضع قراءة'), h('strong', `سورة ${getSurahMeta(last.surah).nameAr}`), h('span.muted', `الآية ${ar(last.ayah)}`)),
      h('span.continue-go', icon('forward'))) : null,
    tabs,
    panel,
  ));
  await draw();
}
