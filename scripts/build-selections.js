#!/usr/bin/env node
/**
 * build-selections.js — مختارات: الأدعية القرآنية، وآية اليوم، وأسماء الله الحسنى
 * المصادر: scripts/selections.src.json و scripts/asma.src.json
 * - نصوص الآيات لا تُكتب هنا: تُعرض في التطبيق من نص المصحف نفسه بالمرجع (سورة:آية)
 * - لكل اسم من الأسماء الحسنى آية ورد فيها بلفظه (إن وُجد في القرآن)، والمراجع المصححة يدويًا في ASMA_REFS
 * المخرجات: public/data/selections.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = require('./selections.src.json');
const asma = require('./asma.src.json');
const quran = require(path.join(ROOT, 'public/data/quran-simple.json')).ayahs;
const surahs = require(path.join(ROOT, 'public/data/surahs.json'));

// مراجع مختارة يدويًا (تتقدم على البحث الآلي)؛ null = لا يرد بلفظه في القرآن
const ASMA_REFS = require('./asma-refs.json');

const strip = (s) => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا');
const valid = (ref) => { const [s, a] = ref.split(':').map(Number); return s >= 1 && s <= 114 && a >= 1 && a <= surahs[s - 1].ayahCount; };

function findRef(name) {
  const n = strip(name);
  const words = n.split(' ');
  for (let s = 1; s <= 114; s++) {
    const list = quran[s - 1];
    for (let a = 1; a <= list.length; a++) {
      const t = strip(list[a - 1]);
      const toks = t.split(' ');
      for (let i = 0; i + words.length <= toks.length; i++) {
        const w = toks.slice(i, i + words.length).join(' ').replace(/^(و|ف)(?=ال)/, '');
        if (w === n && /(^| )(الله|هو|ربك|ربنا|ربي|ربه|انه|انك|ان الله|والله)( |$)/.test(t)) return `${s}:${a}`;
      }
    }
  }
  return null;
}

const errors = [];
for (const d of src.quranDuas) { if (!valid(d.ref)) errors.push('dua ' + d.ref); if (d.to && !valid(d.ref.split(':')[0] + ':' + d.to)) errors.push('dua to ' + d.ref); }
for (const r of src.dailyAyahs) if (!valid(r)) errors.push('daily ' + r);
const names = asma.map(([n, m]) => {
  const ref = n in ASMA_REFS ? ASMA_REFS[n] : findRef(n);
  if (ref && !valid(ref)) errors.push('asma ' + n + ' ' + ref);
  return ref ? { n, m, ref } : { n, m };
});
if (asma.length !== 99) errors.push('asma count ' + asma.length);
if (errors.length) { console.error('✗', errors); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'public/data/selections.json'), JSON.stringify({ quranDuas: src.quranDuas, dailyAyahs: src.dailyAyahs, asma: names }));
// نصوص آيات اليوم (بالرسم العثماني) لإشعار «آية الصباح» من الخادم
const uth = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/quran-uthmani.json'), 'utf8')).ayahs;
fs.writeFileSync(path.join(ROOT, 'public/data/daily-ayahs.json'), JSON.stringify(src.dailyAyahs.map((r) => { const [s, a] = r.split(':').map(Number); return { s, a, name: surahs[s - 1].nameAr, text: uth[s - 1][a - 1] }; })));
console.log(`✓ ${src.quranDuas.length} دعاء قرآني، ${src.dailyAyahs.length} آية لليوم، ${names.length} اسمًا (${names.filter((x) => x.ref).length} بآية)`);
if (process.argv.includes('--list')) for (const x of names) console.log(x.n, '|', x.ref || '—', x.ref ? '| ' + quran[x.ref.split(':')[0] - 1][x.ref.split(':')[1] - 1].slice(0, 90) : '');
