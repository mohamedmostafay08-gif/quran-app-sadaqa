#!/usr/bin/env node
/**
 * build-reciters.js — قائمة القراء من mp3quran.net: تلاوة السورة كاملة (متصلة بدون فواصل)
 * مع توقيت كل آية (ayat_timing) لتظليل الآية المقروءة.
 *
 * يأخذ فقط القراء الذين لهم توقيتات لكل السور الـ114 برواية حفص عن عاصم،
 * ويتحقق من وجود ملف الصوت، ويضع المشهورين أولًا.
 * المخرجات: public/data/reciters.json
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'public', 'data', 'reciters.json');
const API = 'https://www.mp3quran.net/api/v3';

// الأشهر أولًا (بالترتيب) — مفتاحها مسار المصحف على الخادم
const FEATURED = [
  'mishary-alafasy/r1', 'abdulbasit-abdulsamad/r3', 'abdulbasit-abdulsamad/r1', 'mahmoud-husary/r1',
  'muhammad-minshawi/r1', 'abdulrahman-sudais/r1', 'saud-shuraim/r1', 'maher-muaiqly/r3', 'yasser-dosari/r1',
  'saad-ghamdi/r1', 'nasser-qatami/r1', 'abubakr-shatri/r1', 'ali-hudhaifi/r1', 'muhammad-ayyub/r1',
  'ahmad-ajmi/r1', 'fares-abbad/r1', 'idrees-abkar/r1', 'khalid-jalil/r1', 'salah-budair/r1',
  'abdullah-basfar/r1', 'abdullah-juhani/r1', 'abdulbari-thubaiti/r1', 'muhammad-tablawi/r1', 'mahmoud-banna/r2',
  'mustafa-ismail/r2', 'hani-rifai/r1', 'khalid-mohanna/r1',
];

async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); throw new Error(r.status); }
    catch (e) { if (i === 3) throw e; await new Promise((res) => setTimeout(res, 1000 * 2 ** i)); }
  }
}

const keyOf = (url) => (url.match(/audio\/(.+?)\/?$/) || [])[1];

async function main() {
  const reads = await getJSON(`${API}/ayat_timing/reads`);
  const reciters = (await getJSON(`${API}/reciters?language=ar`)).reciters;
  const moshafByKey = new Map();
  for (const r of reciters) for (const m of r.moshaf) moshafByKey.set(keyOf(m.server), { name: r.name, moshaf: m.name });

  const out = [];
  for (const rd of reads) {
    const key = keyOf(rd.folder_url);
    const info = moshafByKey.get(key);
    if (rd.soar_count !== 114) continue;
    if (!/حفص عن عاصم/.test(rd.rewaya || '') && !(info && /حفص عن عاصم/.test(info.moshaf))) continue;
    const style = info ? (info.moshaf.split(' - ')[1] || 'مرتل').replace('المصحف ', '') : 'مرتل';
    out.push({
      id: String(rd.id),
      nameAr: (info?.name || rd.name).replace(/^شيخ /, ''),
      style,
      server: rd.folder_url.replace(/\/?$/, '/'),
      featured: FEATURED.indexOf(key),
    });
  }
  // التحقق من ملفات الصوت (الفاتحة)
  const ok = [];
  for (const r of out) {
    const res = await fetch(r.server + '001.mp3', { method: 'HEAD', redirect: 'follow' }).catch(() => null);
    if (res && res.ok) ok.push(r);
    else console.warn('✗ بدون صوت:', r.nameAr, r.server);
  }
  ok.sort((a, b) => {
    const fa = a.featured < 0 ? 999 : a.featured, fb = b.featured < 0 ? 999 : b.featured;
    return fa - fb || a.nameAr.localeCompare(b.nameAr, 'ar');
  });
  const final = ok.map(({ featured, ...r }) => ({ ...r, featured: featured >= 0 }));
  fs.writeFileSync(OUT, JSON.stringify(final, null, 1));
  console.log(`✓ ${final.length} قارئ (${final.filter((r) => r.featured).length} من الأشهر)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
