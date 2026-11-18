#!/usr/bin/env node
/**
 * build-shaarawy.js — فهرس حلقات «خواطر الشيخ الشعراوي» الصوتية (أرشيف الإنترنت)
 * كل حلقة عنوانها بالسورة ومدى الآيات، مثل: 014_Ibrahim(031_032)
 * المخرجات: public/data/shaarawy.json = { item, surahs: { "14": [[file, from, to, minutes], ...] } }
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ITEM = 'Islamic_Tape-233_uP_bY_mUSLEm';
const OUT = path.resolve(__dirname, '..', 'public', 'data', 'shaarawy.json');
const SURAHS = require('../public/data/surahs.json');

(async () => {
  const meta = await (await fetch(`https://archive.org/metadata/${ITEM}`)).json();
  const files = meta.files.filter((f) => f.source === 'original' && f.name.endsWith('.mp3')).sort((a, b) => a.name.localeCompare(b.name));
  const surahs = {};
  let skipped = 0;
  for (const f of files) {
    const t = (f.title || '').replace(/_+$/, '');
    const m = /^(\d{3})_[^(]*?(?:\((\d{3})_(\d{3})\))?(?:_(\d+))?$/.exec(t);
    if (!m) { skipped++; continue; }
    const s = +m[1];
    if (!s) continue; // المقدمة
    const count = SURAHS[s - 1].ayahCount;
    const from = m[2] ? +m[2] : 1;
    const to = Math.min(count, m[3] ? +m[3] : count);
    (surahs[s] ||= []).push([f.name.replace(/\.mp3$/, ''), from, to, Math.round(+f.length / 60)]);
  }
  fs.writeFileSync(OUT, JSON.stringify({ item: ITEM, surahs }));
  console.log(`✓ ${Object.keys(surahs).length} سورة، ${Object.values(surahs).flat().length} حلقة (تجاهل ${skipped})`);
})();
