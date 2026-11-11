#!/usr/bin/env node
/**
 * build-tafsir-trans.js — تفسير السعدي وترجمات معاني القرآن (تُحمَّل عند الحاجة لكل سورة)
 *   - تفسير السعدي (تيسير الكريم الرحمن): Quran.com API v4 (tafsir 91)
 *   - ترجمات المعاني: Tanzil.net (مع ذكر المصدر، للاستخدام غير التجاري)
 * المخرجات:
 *   public/data/tafsir-saadi/{n}.json  نفس صيغة الميسر: نص أو رقم أول آية في المجموعة
 *   public/data/trans/{id}/{n}.json    مصفوفة نصوص الآيات
 *   public/data/trans/index.json       قائمة الترجمات
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');
const CACHE = path.join(__dirname, '.cache');
const QC = 'https://api.quran.com/api/v4';

const TRANSLATIONS = [
  { id: 'en.sahih', name: 'English — Saheeh International', lang: 'en', dir: 'ltr' },
  { id: 'fr.hamidullah', name: 'Français — Hamidullah', lang: 'fr', dir: 'ltr' },
  { id: 'tr.diyanet', name: 'Türkçe — Diyanet İşleri', lang: 'tr', dir: 'ltr' },
  { id: 'id.indonesian', name: 'Bahasa Indonesia — Kementerian Agama', lang: 'id', dir: 'ltr' },
  { id: 'ur.jalandhry', name: 'اردو — جالندھری', lang: 'ur', dir: 'rtl' },
];

async function getJSON(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); throw new Error(r.status); }
    catch (e) { if (i === 4) throw e; await new Promise((res) => setTimeout(res, 1000 * 2 ** i)); }
  }
}
async function cached(name, fn) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const data = await fn();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}
const cleanHtml = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'surahs.json'), 'utf8'));
  const counts = meta.map((m) => m.ayahCount ?? m.ayahs ?? m.count);
  if (counts.length !== 114 || counts.reduce((a, b) => a + b, 0) !== 6236) throw new Error('surahs.json: عدد الآيات غير متوقع');

  // ---- تفسير السعدي ----
  const saadi = await cached('qc-saadi.json', async () => {
    const out = {};
    for (let s = 1; s <= 114; s++) {
      process.stdout.write(`\r↓ تفسير السعدي: سورة ${s}/114 `);
      let page = 1;
      while (page) {
        const d = await getJSON(`${QC}/tafsirs/91/by_chapter/${s}?per_page=50&page=${page}`);
        for (const t of d.tafsirs) out[t.verse_key] = t.text;
        page = d.pagination?.next_page;
      }
    }
    process.stdout.write('\n');
    return out;
  });
  fs.mkdirSync(path.join(OUT, 'tafsir-saadi'), { recursive: true });
  let n = 0;
  for (let s = 1; s <= 114; s++) {
    let lastA = 0;
    const arr = Array.from({ length: counts[s - 1] }, (_, i) => {
      const t = saadi[`${s}:${i + 1}`];
      if (t && cleanHtml(t)) { n++; lastA = i + 1; return cleanHtml(t); }
      return lastA || '';
    });
    fs.writeFileSync(path.join(OUT, 'tafsir-saadi', `${s}.json`), JSON.stringify(arr));
  }
  console.log(`✓ تفسير السعدي: ${n}/6236 آية لها نص مستقل`);

  // ---- الترجمات ----
  for (const tr of TRANSLATIONS) {
    const file = path.join(CACHE, `tanzil-${tr.id}.txt`);
    if (!fs.existsSync(file)) {
      console.log(`↓ ${tr.id}`);
      const r = await fetch(`https://tanzil.net/trans/?transID=${tr.id}&type=txt-2`);
      if (!r.ok) throw new Error(`${tr.id}: ${r.status}`);
      fs.writeFileSync(file, await r.text());
    }
    const by = Array.from({ length: 114 }, (_, i) => new Array(counts[i]).fill(null));
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^(\d+)\|(\d+)\|(.*)$/);
      if (m) by[m[1] - 1][m[2] - 1] = m[3].trim();
    }
    const missing = by.flat().filter((x) => x == null).length;
    if (missing) throw new Error(`${tr.id}: ${missing} آية ناقصة`);
    fs.mkdirSync(path.join(OUT, 'trans', tr.id), { recursive: true });
    by.forEach((arr, i) => fs.writeFileSync(path.join(OUT, 'trans', tr.id, `${i + 1}.json`), JSON.stringify(arr)));
    console.log(`✓ ${tr.name}`);
  }
  fs.writeFileSync(path.join(OUT, 'trans', 'index.json'), JSON.stringify(TRANSLATIONS));
}
main().catch((e) => { console.error(e); process.exit(1); });
