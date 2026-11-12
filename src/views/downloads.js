// التنزيلات: اختيار القارئ، تنزيل سور أو المصحف كاملًا، المساحة، الحذف
import { h, icon, ar, formatBytes } from '../lib/dom.js';
import { getSurahs, getSimpleText } from '../data.js';
import * as settings from '../state.js';
import { getReciter } from '../audio/player.js';
import { reciterSheet } from '../audio/playerBar.js';
import * as dl from '../offline/downloader.js';
import { downloadsFor, estimate, isPersisted, requestPersist, deleteReciter } from '../offline/storage.js';
import { mount, topbar, toast, sheet } from '../ui.js';
import { extrasStatus, downloadExtras } from '../offline/extras.js';

// تقدير حجم الصوت: ثوانٍ تقريبية لكل حرف × معدل البت
const SEC_PER_LETTER = 0.2;
let lettersPerSurah = null;
async function sizeOf(reciter, s) {
  if (!lettersPerSurah) {
    const simple = await getSimpleText();
    lettersPerSurah = simple.map((ayahs) => ayahs.reduce((n, t) => n + t.replace(/\s/g, '').length, 0));
  }
  const r = getReciter(reciter);
  const slow = /مجوّد|تعليمي/.test(r.style) ? 1.7 : 1;
  // ملفات mp3quran غالبًا 128 ك.ب/ث
  return lettersPerSurah[s - 1] * SEC_PER_LETTER * slow * 128 * 125;
}

export async function renderDownloads(_p, _q, isStale) {
  const reciter = settings.get('reciter');
  const r = getReciter(reciter);
  let done = await downloadsFor(reciter);
  const sizes = await Promise.all(getSurahs().map((s) => sizeOf(reciter, s.id)));
  if (isStale()) return;
  const totalEst = sizes.reduce((a, b) => a + b, 0);

  const usage = h('div.usage');
  const persistNote = h('p.small-note');
  const refreshUsage = async () => {
    const e = await estimate();
    const mine = [...done.values()].reduce((s, d) => s + (d.bytes || 0), 0);
    const doneCount = [...done.values()].filter((d) => d.status === 'done').length;
    usage.replaceChildren(...[
      h('div.usage-row', h('strong', `${ar(doneCount)} / ${ar(114)} سورة منزّلة`), h('span.muted', formatBytes(mine))),
      h('div.bar', h('span', { style: { width: `${(doneCount / 114) * 100}%` } })),
      e ? h('p.muted', `المساحة المستخدمة على الجهاز: ${formatBytes(e.usage)} من ${formatBytes(e.quota)} متاحة للمتصفح`) : null,
    ].filter(Boolean));
    const p = await isPersisted();
    persistNote.replaceChildren(p
      ? 'التخزين محمي من المسح التلقائي ✓'
      : h('span', 'قد يمسح المتصفح الملفات عند امتلاء المساحة. ', h('button.link', { type: 'button', onclick: async () => { toast((await requestPersist()) ? 'تم تفعيل الحماية' : 'المتصفح رفض الطلب — ثبّت التطبيق على الشاشة الرئيسية'); refreshUsage(); } }, 'اطلب حماية التخزين')));
  };

  const rows = new Map();
  const list = h('ul.dl-list');
  for (const s of getSurahs()) {
    const btn = h('button.icon-btn', { type: 'button' });
    const state = h('span.muted.dl-state');
    const prog = h('div.bar.thin', h('span'));
    const li = h('li.dl-item',
      h('span.surah-num', { 'aria-hidden': 'true' }, ar(s.id)),
      h('div.dl-main', h('strong', `سورة ${s.nameAr}`), state, prog),
      btn,
    );
    rows.set(s.id, { li, btn, state, prog });
    list.append(li);
  }

  const paint = () => {
    const st = dl.status();
    for (const [s, row] of rows) {
      const d = done.get(s);
      const isActive = st.active && st.active.reciter === reciter && st.active.surah === s;
      const queued = st.queued.some((q) => q.reciter === reciter && q.surah === s);
      let label, iconName, action, aria;
      row.prog.hidden = !isActive;
      if (isActive) {
        const pct = st.active.total ? st.active.done / st.active.total : 0;
        row.prog.firstChild.style.width = `${pct * 100}%`;
        label = `جارٍ التنزيل ${ar(Math.round(pct * 100))}٪`;
        iconName = 'close'; aria = 'إلغاء التنزيل'; action = () => dl.cancel(reciter, s);
      } else if (queued) {
        label = 'في الانتظار'; iconName = 'close'; aria = 'إلغاء'; action = () => dl.cancel(reciter, s);
      } else if (d?.status === 'done') {
        label = `منزّلة، ${formatBytes(d.bytes)}`; iconName = 'trash'; aria = 'حذف التنزيل';
        action = async () => { await dl.deleteSurah(reciter, s); done.delete(s); paint(); refreshUsage(); toast('تم الحذف'); };
      } else {
        label = d?.status === 'partial' ? `غير مكتملة (${ar(d.files)}/${ar(d.total)})، ≈ ${formatBytes(sizes[s - 1])}` : `≈ ${formatBytes(sizes[s - 1])}`;
        iconName = 'download'; aria = 'تنزيل';
        action = () => dl.enqueue(reciter, s);
      }
      row.state.textContent = label;
      row.li.classList.toggle('is-done', d?.status === 'done' && !isActive);
      row.btn.replaceChildren(icon(iconName));
      row.btn.setAttribute('aria-label', `${aria}: سورة ${getSurahs()[s - 1].nameAr}`);
      row.btn.onclick = action;
    }
  };

  // عند تغير السورة الجاري تنزيلها نعيد قراءة الحالة من IndexedDB (آخر طلب فقط هو اللي يتطبق)
  let wasActive = null;
  let reloadSeq = 0;
  const unsub = dl.subscribe((st) => {
    const key = st.active ? `${st.active.reciter}:${st.active.surah}` : null;
    if (key !== wasActive) {
      wasActive = key;
      const my = ++reloadSeq;
      downloadsFor(reciter).then((m) => { if (my === reloadSeq) { done = m; paint(); refreshUsage(); } });
    }
    paint();
  });

  const remaining = () => getSurahs().map((s) => s.id).filter((s) => done.get(s)?.status !== 'done');

  // ---- بيانات التطبيق الإضافية (للاستخدام بدون إنترنت) ----
  const exState = h('span.muted');
  const exBar = h('div.bar.thin', h('span'));
  const exBtn = h('button.btn', { type: 'button' }, icon('download'), 'نزّل كل البيانات');
  const paintEx = (st) => {
    const full = st.done >= st.total;
    exState.textContent = full ? `كل البيانات منزّلة ✓ (${formatBytes(st.bytes)})` : `${ar(st.done)} من ${ar(st.total)} ملف، الحجم الكامل ≈ ${formatBytes(st.bytes)}`;
    exBar.firstChild.style.width = `${(st.done / st.total) * 100}%`;
    exBtn.hidden = full;
  };
  extrasStatus().then(paintEx).catch(() => { exState.textContent = 'غير متاح'; });
  exBtn.onclick = async () => {
    exBtn.disabled = true;
    try {
      const st = await downloadExtras((done, total) => paintEx({ done, total, bytes: 0 }));
      paintEx({ ...st, bytes: (await extrasStatus()).bytes });
      toast('تم تنزيل كل البيانات، التطبيق جاهز بدون إنترنت');
    } catch (e) { toast(navigator.onLine ? e.message : 'تحتاج اتصالًا بالإنترنت للتنزيل'); }
    exBtn.disabled = false;
  };
  const extrasCard = h('section.card',
    h('h2', 'الاستخدام بدون إنترنت'),
    h('p.muted', 'نزّل التفسير وصفحات المصحف مرة واحدة لتستخدمها بدون إنترنت.'),
    exState, exBar,
    h('div.btn-row', exBtn),
  );

  mount(h('div.downloads',
    topbar({ title: 'التنزيلات', back: '#/more' }),
    extrasCard,
    h('section.card',
      h('button.row-btn', { type: 'button', onclick: () => reciterSheet() },
        h('span', h('strong', r.nameAr), h('small', `${r.style}، المصحف كاملًا ≈ ${formatBytes(totalEst)}`)), icon('forward')),
      usage,
      persistNote,
      h('div.btn-row',
        h('button.btn', { type: 'button', onclick: () => {
          const rem = remaining();
          if (!rem.length) return toast('المصحف كله منزّل لهذا القارئ');
          const est = rem.reduce((a, s) => a + sizes[s - 1], 0);
          sheet({ title: 'تنزيل المصحف كاملًا', content: (close) => h('div',
            h('p', `سيتم تنزيل ${ar(rem.length)} سورة بصوت ${r.nameAr}، بحجم تقريبي ${formatBytes(est)}. يُفضّل الاتصال بالواي فاي.`),
            h('div.btn-row', h('button.btn', { type: 'button', onclick: () => { dl.enqueue(reciter, rem); close(); } }, icon('download'), 'ابدأ التنزيل'),
              h('button.btn.ghost', { type: 'button', onclick: close }, 'إلغاء'))) });
        } }, icon('download'), 'تنزيل المصحف كاملًا'),
        h('button.btn.ghost', { type: 'button', onclick: () => { dl.cancelAll(); toast('تم إيقاف التنزيلات'); } }, 'إيقاف الكل'),
        h('button.btn.ghost.danger', { type: 'button', onclick: () => {
          sheet({ title: 'حذف كل تنزيلات القارئ؟', content: (close) => h('div',
            h('p', `سيتم حذف كل الملفات الصوتية المنزّلة لـ ${r.nameAr}.`),
            h('div.btn-row', h('button.btn.danger', { type: 'button', onclick: async () => { dl.cancelAll(); await deleteReciter(reciter); done = new Map(); paint(); refreshUsage(); close(); toast('تم الحذف'); } }, icon('trash'), 'حذف'),
              h('button.btn.ghost', { type: 'button', onclick: close }, 'إلغاء'))) });
        } }, icon('trash'), 'حذف الكل'),
      ),
    ),
    h('h2.section-title', 'السور'),
    list,
  ));
  paint();
  refreshUsage();
  const unsubSettings = settings.subscribe((k) => { if (k === 'reciter') dispatchEvent(new HashChangeEvent('hashchange')); });
  return { cleanup() { unsub(); unsubSettings(); } };
}
