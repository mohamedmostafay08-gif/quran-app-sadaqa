// يبني public/data/lessons.json من مصادر دروس المشايخ (قوائم يوتيوب الرسمية + السلاسل الصوتية)
// المصادر في scripts/lessons/: youtube.json و audio.json (إن وُجد)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons', f), 'utf8')); } catch { return []; } };

const SHEIKHS = {
  shaarawy: { name: 'الشيخ محمد متولي الشعراوي', short: 'الشعراوي', key: 'الشعراوي' },
  kafy: { name: 'د. عمر عبد الكافي', short: 'عمر عبد الكافي', key: 'عمر عبد الكافي' },
  uthaymeen: { name: 'الشيخ محمد بن صالح العثيمين', short: 'ابن عثيمين', key: 'ابن عثيمين' },
  binbaz: { name: 'الشيخ عبد العزيز بن باز', short: 'ابن باز', key: 'ابن باز' },
  samir: { name: 'الشيخ سمير مصطفى', short: 'سمير مصطفى', key: 'سمير مصطفى' },
  amgad: { name: 'الشيخ أمجد سمير', short: 'أمجد سمير', key: 'أمجد سمير' },
  huwayni: { name: 'الشيخ أبو إسحاق الحويني', short: 'الحويني', key: 'الحويني' },
};
const TOPICS = [['تفسير', 'التفسير'], ['حديث', 'الحديث'], ['سيرة', 'السيرة'], ['فقه', 'الفقه'], ['عقيدة', 'العقيدة'], ['رقائق', 'الرقائق والمواعظ'], ['قصص', 'القصص']];
const byKey = Object.fromEntries(Object.entries(SHEIKHS).map(([id, s]) => [s.key, id]));
const sid = (sheikh) => byKey[sheikh] || Object.entries(SHEIKHS).find(([, s]) => sheikh.includes(s.key))?.[0];

const friendly = (src = '') => (/binbaz/.test(src) ? 'الموقع الرسمي للشيخ ابن باز (binbaz.org.sa)' : /islamhouse/.test(src) ? 'موقع دار الإسلام (islamhouse.com)' : /archive\.org/.test(src) ? 'أرشيف الإنترنت (archive.org)' : src);
// عناوين الحلقات: بلا ترقيم في أولها (الدوائر ترقّمها)، والرقم الملتصق بآخرها يصير «(٢)»
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const cleanEp = (t) => { let x = String(t).trim().replace(/^[\d٠-٩]+\s*[-_.)]?\s*/, ''); x = x.replace(/([^\s\d])(\d+)$/, (m, a, n) => `${a} (${AR(n)})`); return x || String(t); };
const cleanTitle = (t) => String(t).replace(/\s*ﷺ/g, ' صلى الله عليه وسلم');
const series = [];
const seen = new Set();
// الصوت أولًا (يعمل بالخلفية ويُستكمل)، ثم الفيديو
for (const a of read('audio.json')) {
  const sh = sid(a.sheikh); if (!sh || !a.episodes?.length || !TOPICS.some((t) => t[0] === a.topic)) continue;
  const id = `a${series.length + 1}`;
  series.push({ id, kind: 'audio', sheikh: sh, topic: a.topic, title: cleanTitle(a.title), source: friendly(a.source), episodes: a.episodes.map((e) => [cleanEp(e.t), e.url]) });
}
for (const y of read('youtube.json')) {
  const sh = sid(y.sheikh); if (!sh || !y.verified || seen.has(y.playlist) || !TOPICS.some((t) => t[0] === y.topic)) continue;
  seen.add(y.playlist);
  series.push({ id: `v${series.length + 1}`, kind: 'video', sheikh: sh, topic: y.topic, title: cleanTitle(y.title), playlist: y.playlist, count: y.count || 0, source: `يوتيوب — ${y.channel}` });
}
const used = new Set(series.map((s) => s.sheikh));
const sheikhs = Object.fromEntries(Object.entries(SHEIKHS).filter(([id]) => used.has(id)).map(([id, s]) => [id, { name: s.name, short: s.short }]));
fs.writeFileSync(path.join(ROOT, 'public/data/lessons.json'), JSON.stringify({ topics: TOPICS, sheikhs, series }));
const audio = series.filter((s) => s.kind === 'audio');
console.log(`✓ ${series.length} سلسلة (${audio.length} صوتية بـ${audio.reduce((n, s) => n + s.episodes.length, 0)} درسًا، ${series.length - audio.length} مرئية) لـ${Object.keys(sheikhs).length} مشايخ`);
