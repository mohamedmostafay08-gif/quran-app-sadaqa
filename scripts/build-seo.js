#!/usr/bin/env node
/**
 * build-seo.js — صفحات ثابتة لمحركات البحث: صفحة لكل سورة (النص العثماني كاملًا)،
 * وفهرس السور، وخريطة الموقع sitemap.xml. يُشغَّل بعد build-data.js.
 *   node scripts/build-seo.js
 * الرابط الأساسي يُضبط بـ SITE_URL (الافتراضي: رابط GitHub Pages الحالي).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = (process.env.SITE_URL || 'https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/').replace(/\/?$/, '/');
const OUT = path.join(ROOT, 'sura');

const { ayahs, notice } = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/quran-uthmani.json'), 'utf8'));
const surahs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/surahs.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/quran-meta.json'), 'utf8'));

const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const revAr = (r) => (r === 'Meccan' ? 'مكية' : 'مدنية');

// صفحة بداية كل سورة (لرابط «صفحات المصحف»)
const pageOfStart = (s) => {
  let p = 1;
  meta.pages.forEach(([ps, pa], i) => { if (ps < s || (ps === s && pa <= 1)) p = i + 1; });
  return p;
};
const juzOfStart = (s) => {
  let j = 1;
  meta.juz.forEach(([js, ja], i) => { if (js < s || (js === s && ja <= 1)) j = i + 1; });
  return j;
};

const CSS = `
:root{--bg:#f4ecda;--surface:#fdf8ec;--text:#22201a;--text2:#5b5547;--accent:#0e5a4b;--gold:#a07a2c;--gold-line:#c9a85c;--gold-soft:#efe0b8;--on-accent:#fffaf0;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#12130f;--surface:#1b1c17;--text:#ece6d6;--text2:#b7ae98;--accent:#6cc3a8;--gold:#d3ad5c;--gold-line:#8a7240;--gold-soft:#3b3220;--on-accent:#0b1f19;color-scheme:dark}}
@font-face{font-family:'Amiri Quran';src:url('../public/fonts/amiri-quran.woff2') format('woff2');font-display:swap}
@font-face{font-family:'Noto Kufi Arabic';src:url('../public/fonts/noto-kufi-arabic.woff2') format('woff2');font-weight:400 700;font-display:swap}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 'Noto Kufi Arabic',system-ui,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px))}
header.top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:3px double var(--gold-line)}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-weight:700}
.brand img{border-radius:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:var(--accent);color:var(--on-accent);text-decoration:none;font-weight:700;font-size:14px}
.btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--gold-line)}
.frame{margin:22px 0 10px;text-align:center;padding:14px 18px;border:1px solid var(--gold-line);border-radius:16px;background:var(--surface);box-shadow:inset 0 0 0 4px var(--surface),inset 0 0 0 5px var(--gold-soft)}
.frame h1{margin:0 0 6px;font:400 clamp(30px,8vw,44px)/1.8 'Amiri Quran',serif;color:var(--accent)}
.frame p{margin:0;color:var(--text2);font-size:13px}
.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0}
.basmala{text-align:center;font:400 1.7rem/2 'Amiri Quran',serif;margin:18px 0 6px}
.quran{font:400 clamp(1.45rem,4.8vw,1.8rem)/2.35 'Amiri Quran',serif;text-align:justify;text-align-last:center;margin:0}
.n{color:var(--gold);white-space:nowrap}
nav.pn{display:flex;justify-content:space-between;gap:8px;margin:26px 0 0;padding-top:16px;border-top:1px solid var(--gold-soft)}
nav.pn a{color:var(--accent);text-decoration:none;font-weight:700}
.intro{color:var(--text2);font-size:14px;text-align:center;margin:0 0 6px}
footer{margin-top:30px;color:var(--text2);font-size:12px;text-align:center}
footer a{color:var(--accent)}
ol.list{list-style:none;padding:0;margin:16px 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
ol.list a{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--gold-soft);border-radius:12px;background:var(--surface);color:var(--text);text-decoration:none}
ol.list b{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--gold-soft);color:var(--accent);font-size:13px;flex:none}
ol.list small{display:block;color:var(--text2);font-size:12px}
`;

const head = ({ title, desc, url, jsonld }) => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0e5a4b">
<link rel="icon" href="../public/icons/icon-192.png" type="image/png">
<link rel="manifest" href="../manifest.webmanifest">
<meta property="og:type" content="article">
<meta property="og:site_name" content="رتّل — القرآن الكريم">
<meta property="og:locale" content="ar_AR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}public/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>`;

const topbar = () => `<header class="top"><a class="brand" href="../"><img src="../public/icons/icon-192.png" alt="" width="36" height="36">رتّل — القرآن الكريم</a><a class="btn ghost" href="index.html">فهرس السور</a></header>`;
const footer = () => `<footer><p>النص العثماني من <a href="https://tanzil.net">مشروع تنزيل (Tanzil)</a> ${esc(notice.version)}، منقول حرفيًا دون تعديل، برخصة CC BY 3.0.</p><p><a href="../">افتح تطبيق «رتّل»</a>: مصحف كامل وتلاوات أكثر من ١٠٠ قارئ، يعمل بدون إنترنت.</p></footer>`;

function surahPage(s) {
  const m = surahs[s - 1];
  const url = `${SITE}sura/${s}.html`;
  const title = `سورة ${m.nameAr} مكتوبة كاملة بالتشكيل — رتّل`;
  const desc = `اقرأ سورة ${m.nameAr} (${m.ayahCount} آية، ${revAr(m.revelation)}) مكتوبة كاملة بالرسم العثماني والتشكيل، واستمع لها بصوت أكثر من ١٠٠ قارئ في تطبيق رتّل.`;
  const prev = s > 1 ? surahs[s - 2] : null;
  const next = s < 114 ? surahs[s] : null;
  const text = ayahs[s - 1].map((t, i) => `${esc(t)} <span class="n">﴿${ar(i + 1)}﴾</span>`).join(' ');
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: `سورة ${m.nameAr}`, alternateName: m.nameEn,
    inLanguage: 'ar', url, isPartOf: { '@type': 'Book', name: 'القرآن الكريم' }, position: s,
    description: desc,
  };
  return `${head({ title, desc, url, jsonld })}
<body><div class="wrap">
${topbar()}
<main>
<div class="frame"><h1>سورة ${esc(m.nameAr)}</h1><p>${revAr(m.revelation)}، ${ar(m.ayahCount)} آية، الجزء ${ar(juzOfStart(s))}، ترتيبها في المصحف ${ar(s)}</p></div>
<p class="intro">سورة ${esc(m.nameAr)} (${esc(m.nameEn)}) مكتوبة كاملة بالرسم العثماني.</p>
<div class="actions"><a class="btn" href="../#/surah/${s}">استمع واقرأ في رتّل</a><a class="btn ghost" href="../#/page/${pageOfStart(s)}">صفحات المصحف</a></div>
${m.basmala ? `<p class="basmala">${esc(m.basmala)}</p>` : ''}
<p class="quran" lang="ar">${text}</p>
<nav class="pn">${prev ? `<a href="${s - 1}.html">→ سورة ${esc(prev.nameAr)}</a>` : '<span></span>'}${next ? `<a href="${s + 1}.html">سورة ${esc(next.nameAr)} ←</a>` : '<span></span>'}</nav>
</main>
${footer()}
</div></body></html>
`;
}

function indexPage() {
  const url = `${SITE}sura/`;
  const title = 'فهرس سور القرآن الكريم مكتوبة كاملة — رتّل';
  const desc = 'فهرس سور القرآن الكريم الـ١١٤ مكتوبة كاملة بالرسم العثماني، مع الاستماع لأكثر من ١٠٠ قارئ في تطبيق رتّل.';
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'فهرس سور القرآن الكريم', url, inLanguage: 'ar' };
  return `${head({ title, desc, url, jsonld })}
<body><div class="wrap">
${topbar()}
<main>
<div class="frame"><h1>سور القرآن الكريم</h1><p>١١٤ سورة، ٦٢٣٦ آية، برواية حفص عن عاصم</p></div>
<ol class="list">${surahs.map((m) => `<li><a href="${m.id}.html"><b>${ar(m.id)}</b><span>سورة ${esc(m.nameAr)}<small>${revAr(m.revelation)}، ${ar(m.ayahCount)} آية</small></span></a></li>`).join('')}</ol>
</main>
${footer()}
</div></body></html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
for (let s = 1; s <= 114; s++) fs.writeFileSync(path.join(OUT, `${s}.html`), surahPage(s));
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());

const today = new Date().toISOString().slice(0, 10);
const urls = [SITE, `${SITE}sura/`, ...surahs.map((m) => `${SITE}sura/${m.id}.html`)];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${i === 0 ? '1.0' : i === 1 ? '0.9' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`);
const size = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`✓ ${114} صفحة سورة + فهرس (${(size / 1024).toFixed(0)} KB)، sitemap.xml بـ ${urls.length} رابط`);
