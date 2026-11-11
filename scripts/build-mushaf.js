#!/usr/bin/env node
/**
 * build-mushaf.js — بيانات وضع الصفحات (مصحف المدينة، 604 صفحة × 15 سطر).
 *
 * المصدر: Quran.com API v4 — نص مجمع الملك فهد (text_qpc_hafs) مع رقم الصفحة والسطر لكل كلمة،
 * ويُعرض بخط KFGQPC Uthmanic Script HAFS المصمم لهذا النص.
 * الأسطر غير الموجودة في الصفحة هي عناوين السور والبسملة (تُبنى عند العرض).
 *
 * المخرجات: public/data/mushaf/{juz}.json = { pages: { "رقم": [[سطر, [[نص, سورة, آية, نهاية؟], ...]], ...] } }
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const OUT = path.join(ROOT, 'public', 'data', 'mushaf');
const QC = 'https://api.quran.com/api/v4';

async function getJSON(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); throw new Error(r.status); }
    catch (e) { if (i === 4) throw e; await new Promise((res) => setTimeout(res, 1000 * 2 ** i)); }
  }
}

async function main() {
  const cacheFile = path.join(CACHE, 'qc-qpc-words-v2.json');
  let verses;
  if (fs.existsSync(cacheFile)) verses = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  else {
    verses = [];
    for (let s = 1; s <= 114; s++) {
      process.stdout.write(`\r↓ نص المصحف بالأسطر: سورة ${s}/114 `);
      // ملاحظة: طلب text_qpc_hafs مع أرقام الأسطر يُرجع ترقيمًا غير متسق في الـ API،
      // لذلك نأخذ الترقيم (الصفحة/السطر) في طلب، والنص في طلب آخر، ونطابقهما كلمة بكلمة.
      let page = 1;
      while (page) {
        const q = `${QC}/verses/by_chapter/${s}?words=true&per_page=50&page=${page}`;
        const [lay, txt] = await Promise.all([
          getJSON(`${q}&word_fields=line_number,page_number&fields=juz_number,page_number`),
          getJSON(`${q}&word_fields=text_qpc_hafs`),
        ]);
        lay.verses.forEach((v, i) => {
          const tv = txt.verses[i];
          if (!tv || tv.verse_key !== v.verse_key || tv.words.length !== v.words.length) throw new Error('عدم تطابق ' + v.verse_key);
          verses.push({ key: v.verse_key, juz: v.juz_number, words: v.words.map((w, k) => [tv.words[k].text_qpc_hafs, w.page_number, w.line_number, w.char_type_name === 'end' ? 1 : 0]) });
        });
        page = lay.pagination.next_page;
      }
    }
    process.stdout.write('\n');
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(verses));
  }

  // ---- فحوصات ----
  if (verses.length !== 6236) throw new Error('عدد الآيات ' + verses.length);
  const pages = new Map(); // page → Map(line → tokens)
  const pageJuz = new Map();
  for (const v of verses) {
    const [s, a] = v.key.split(':').map(Number);
    for (const [text, pg, line, end] of v.words) {
      if (!pages.has(pg)) pages.set(pg, new Map());
      const lines = pages.get(pg);
      if (!lines.has(line)) lines.set(line, []);
      lines.get(line).push(end ? [text, s, a, 1] : [text, s, a]);
      if (!pageJuz.has(pg)) pageJuz.set(pg, v.juz);
    }
  }
  if (pages.size !== 604) throw new Error('عدد الصفحات ' + pages.size);
  let maxLine = 0;
  for (const lines of pages.values()) for (const l of lines.keys()) maxLine = Math.max(maxLine, l);
  if (maxLine !== 15) throw new Error('أقصى سطر ' + maxLine);
  console.log('✓ 6236 آية، 604 صفحة، 15 سطرًا كحد أقصى');

  // ---- الكتابة حسب الجزء (بداية الصفحة) ----
  fs.mkdirSync(OUT, { recursive: true });
  const byJuz = new Map();
  for (const [pg, lines] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    const j = pageJuz.get(pg);
    if (!byJuz.has(j)) byJuz.set(j, { pages: {} });
    byJuz.get(j).pages[pg] = [...lines.entries()].sort((a, b) => a[0] - b[0]);
  }
  const index = {};
  for (const [j, data] of byJuz) {
    fs.writeFileSync(path.join(OUT, `${j}.json`), JSON.stringify(data));
    for (const pg of Object.keys(data.pages)) index[pg] = j;
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  const size = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`✓ ${byJuz.size} ملف، ${(size / 1024).toFixed(0)} KB`);
}
main().catch((e) => { console.error(e); process.exit(1); });
