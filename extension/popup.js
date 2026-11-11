import { APP, getData, resolve, ar, ayahOfDay } from './common.js';

const $ = (id) => document.getElementById(id);
const open = (url) => chrome.tabs.create({ url });

const data = await getData();
const a = ayahOfDay(data);
const s = data.surahs[a.surah - 1];
$('ayah').textContent = `${a.text} ﴿${ar(a.ayah)}﴾`;
$('ref').textContent = `سورة ${s.nameAr}، الآية ${ar(a.ayah)}`;
$('open').addEventListener('click', () => open(`${APP}#/surah/${a.surah}/${a.ayah}`));
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(`﴿${a.text}﴾\n[سورة ${s.nameAr}: ${ar(a.ayah)}]`);
  $('copy').textContent = 'تم النسخ ✓';
  setTimeout(() => { $('copy').textContent = 'نسخ'; }, 1500);
});
$('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (q) open(resolve(q, data.surahs));
});
for (const l of document.querySelectorAll('.links a')) {
  l.href = APP + l.dataset.path;
  l.addEventListener('click', (e) => { e.preventDefault(); open(l.href); });
}
try {
  $('hijri').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
} catch { /* */ }
$('q').focus();
