#!/usr/bin/env node
/**
 * build-adhkar.js — الأذكار من كتاب «حصن المسلم» (سعيد بن علي بن وهف القحطاني)
 * عبر الواجهة الرسمية لموقع hisnmuslim.com. النصوص منقولة كما هي دون تعديل.
 * المخرجات: public/data/adhkar.json = [{ id, title, items: [{ text, repeat }] }]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'public', 'data', 'adhkar.json');
const API = 'https://www.hisnmuslim.com/api/ar';

async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url.replace('http://', 'https://'));
      if (!r.ok) throw new Error(r.status);
      const t = (await r.text()).replace(/^﻿/, '');
      return JSON.parse(t);
    } catch (e) {
      if (i === 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function main() {
  const index = (await getJSON(`${API}/husn_ar.json`))['العربية'];
  const out = [];
  for (const ch of index) {
    process.stdout.write(`\r↓ ${out.length + 1}/${index.length} `);
    const data = await getJSON(ch.TEXT);
    const items = Object.values(data)[0].map((x) => ({ text: clean(x.ARABIC_TEXT), repeat: Number(x.REPEAT) || 1 })).filter((x) => x.text);
    out.push({ id: ch.ID, title: clean(ch.TITLE).replace(/ُ(?=ل)/, ''), items });
  }
  process.stdout.write('\n');
  fs.writeFileSync(OUT, JSON.stringify({ source: 'حصن المسلم — hisnmuslim.com', chapters: out }));
  const n = out.reduce((s, c) => s + c.items.length, 0);
  console.log(`✓ ${out.length} باب، ${n} ذكر، ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}
main().catch((e) => { console.error(e); process.exit(1); });
