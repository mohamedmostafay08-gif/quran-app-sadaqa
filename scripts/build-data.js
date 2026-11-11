#!/usr/bin/env node
/**
 * build-data.js — يجهز ملفات JSON الثابتة للتطبيق من المصادر الموثقة.
 *
 * المصادر:
 *   - نص المصحف العثماني والإملائي: Tanzil Project (https://tanzil.net) — CC BY 3.0، ممنوع تعديل النص.
 *   - بيانات الأجزاء/الصفحات/الأرباع/السجدات: Tanzil quran-data.xml.
 *   - أسماء السور بالإنجليزي وصفحاتها: Quran.com API v4.
 *
 * الاستخدام:  node scripts/build-data.js         (يحمل المصادر لو مش موجودة في scripts/.cache)
 *             node scripts/build-data.js --fresh (يعيد التحميل)
 *
 * النص لا يُعدَّل: الشيء الوحيد اللي بنعمله هو فصل البسملة الملحقة بأول آية
 * (في السور 2..114 ما عدا التوبة) لتظهر كعنوان، مع فحص إن (البسملة + الآية) = السطر الأصلي حرفيًا.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const OUT = path.join(ROOT, 'public', 'data');
const FRESH = process.argv.includes('--fresh');

const SOURCES = {
  uthmani: 'https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=false&tatweel=true&quranType=uthmani&outType=txt-2&agree=true',
  simple: 'https://tanzil.net/pub/download/index.php?quranType=simple-clean&outType=txt-2&agree=true',
  meta: 'https://tanzil.net/res/text/metadata/quran-data.xml',
  chapters: 'https://api.quran.com/api/v4/chapters?language=en',
};
const FILES = { uthmani: 'uthmani.txt', simple: 'simple-clean.txt', meta: 'quran-data.xml', chapters: 'chapters.json' };

// إجماليات معروفة (رواية حفص، العد الكوفي) للفحص الآلي
const EXPECTED = { surahs: 114, ayahs: 6236, pages: 604, juz: 30, quarters: 240, sajdas: 15 };

async function fetchSource(key) {
  const file = path.join(CACHE, FILES[key]);
  if (!FRESH && fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file, 'utf8');
  console.log(`↓ تحميل ${key} …`);
  const res = await fetch(SOURCES[key]);
  if (!res.ok) throw new Error(`فشل تحميل ${key}: ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, text);
  return text;
}

function parseTanzilTxt(txt) {
  const rows = [];
  for (const line of txt.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [s, a, ...rest] = line.split('|');
    rows.push({ s: +s, a: +a, t: rest.join('|').replace(/\r$/, '') });
  }
  return rows;
}

function groupBySurah(rows) {
  const out = Array.from({ length: 114 }, () => []);
  for (const r of rows) {
    const list = out[r.s - 1];
    if (list.length + 1 !== r.a) throw new Error(`ترتيب غير متوقع عند ${r.s}:${r.a}`);
    list.push(r.t);
  }
  return out;
}

function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
}
function parseMeta(xml) {
  const pick = (name) => [...xml.matchAll(new RegExp(`<${name} [^>]*/>`, 'g'))].map((m) => attrs(m[0]));
  return {
    suras: pick('sura'),
    juz: pick('juz').map((j) => [+j.sura, +j.aya]),
    pages: pick('page').map((p) => [+p.sura, +p.aya]),
    quarters: pick('quarter').map((q) => [+q.sura, +q.aya]),
    sajdas: pick('sajda').map((s) => [+s.sura, +s.aya, s.type]),
  };
}

// البسملة الملحقة بأول آية (قد تأتي "بِسْمِ" أو "بِّسْمِ" حسب السياق في نص Tanzil)
// تُبنى الأنماط من نص الفاتحة 1:1 نفسه (تجنبًا لاختلاف ترتيب الحركات عند الكتابة اليدوية)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function basmalaRe(fatiha1) {
  // "بِسْمِ" قد تأتي "بِّسْمِ" (بشدة على الباء) في بعض السور
  const body = escapeRe(fatiha1).replace(/^ب/, 'ب\u0651?');
  return new RegExp('^(' + body + ') ');
}

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function assert(cond, msg) { if (!cond) { console.error('✗ ' + msg); process.exitCode = 1; throw new Error(msg); } console.log('✓ ' + msg); }

async function main() {
  const [uTxt, sTxt, xml, chJson] = await Promise.all(Object.keys(FILES).map(fetchSource));
  const uRows = parseTanzilTxt(uTxt);
  const sRows = parseTanzilTxt(sTxt);
  const meta = parseMeta(xml);
  const chapters = JSON.parse(chJson).chapters;
  const versionLine = (uTxt.match(/Tanzil Quran Text \(([^)]+)\)/) || [])[1] || 'Uthmani';

  // ---- فحوصات ----
  assert(uRows.length === EXPECTED.ayahs, `عدد الآيات (عثماني) = ${uRows.length}`);
  assert(sRows.length === EXPECTED.ayahs, `عدد الآيات (إملائي) = ${sRows.length}`);
  const uthmani = groupBySurah(uRows);
  const simple = groupBySurah(sRows);
  assert(uthmani.length === EXPECTED.surahs, `عدد السور = ${uthmani.length}`);
  assert(meta.suras.length === 114 && meta.suras.every((m, i) => +m.ayas === uthmani[i].length), 'عدد آيات كل سورة يطابق بيانات Tanzil');
  assert(chapters.length === 114 && chapters.every((c, i) => c.verses_count === uthmani[i].length), 'عدد آيات كل سورة يطابق Quran.com');
  assert(meta.pages.length === EXPECTED.pages, `عدد الصفحات = ${meta.pages.length}`);
  assert(meta.juz.length === EXPECTED.juz, `عدد الأجزاء = ${meta.juz.length}`);
  assert(meta.quarters.length === EXPECTED.quarters, `عدد الأرباع = ${meta.quarters.length}`);
  assert(meta.sajdas.length === EXPECTED.sajdas, `عدد السجدات = ${meta.sajdas.length}`);

  // ---- فصل البسملة كعنوان ----
  const BASMALA_RE = basmalaRe(uthmani[0][0]);
  const BASMALA_SIMPLE_RE = new RegExp('^(' + escapeRe(simple[0][0]) + ') ');
  const basmala = new Array(114).fill(null);
  for (let i = 0; i < 114; i++) {
    const n = i + 1;
    if (n === 1 || n === 9) continue;
    const mu = uthmani[i][0].match(BASMALA_RE);
    const ms = simple[i][0].match(BASMALA_SIMPLE_RE);
    if (!mu || !ms) throw new Error(`لم أجد البسملة في أول السورة ${n}`);
    const original = uthmani[i][0];
    basmala[i] = mu[1];
    uthmani[i][0] = original.slice(mu[0].length);
    simple[i][0] = simple[i][0].slice(ms[0].length);
    if (basmala[i] + ' ' + uthmani[i][0] !== original) throw new Error(`فشل التحقق العكسي للسورة ${n}`);
  }
  assert(basmala.filter(Boolean).length === 112, 'تم فصل البسملة في 112 سورة مع تحقق عكسي حرفي');

  // التأكد إن النص بعد إعادة التركيب = الأصل بالضبط
  const rebuilt = uthmani.map((ay, i) => ay.map((t, j) => (j === 0 && basmala[i] ? basmala[i] + ' ' + t : t))).flat().join('\n');
  const original = uRows.map((r) => r.t).join('\n');
  assert(sha(rebuilt) === sha(original), `بصمة النص بعد إعادة التركيب مطابقة (sha256 ${sha(original).slice(0, 12)}…)`);

  // ---- كتابة الملفات ----
  fs.mkdirSync(OUT, { recursive: true });
  const surahs = meta.suras.map((m, i) => {
    const c = chapters[i];
    return {
      id: i + 1,
      nameAr: m.name,
      nameEn: c.name_simple,
      meaningEn: c.translated_name.name,
      ayahCount: +m.ayas,
      revelation: m.type, // Meccan | Medinan
      order: +m.order,
      pages: c.pages,
      basmala: basmala[i],
    };
  });

  const notice = {
    source: 'Tanzil Project — https://tanzil.net',
    version: versionLine,
    license: 'Creative Commons Attribution 3.0 — verbatim copies only, changing the text is not allowed.',
    sha256: sha(original),
    builtAt: new Date().toISOString().slice(0, 10),
  };

  const write = (name, obj) => {
    const file = path.join(OUT, name);
    fs.writeFileSync(file, JSON.stringify(obj));
    console.log(`  → public/data/${name} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  };
  write('surahs.json', surahs);
  write('quran-uthmani.json', { notice, ayahs: uthmani });
  write('quran-simple.json', { notice: { ...notice, version: 'Simple Clean (search only)' }, ayahs: simple });
  write('quran-meta.json', { juz: meta.juz, pages: meta.pages, quarters: meta.quarters, sajdas: meta.sajdas });
  console.log('\nتم. الإصدار:', versionLine);
}

main().catch((e) => { console.error(e); process.exit(1); });
