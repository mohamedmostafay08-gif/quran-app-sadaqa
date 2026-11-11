#!/usr/bin/env node
/**
 * stamp-sw.js — يحدّث قائمة ASSETS ورقم VERSION في sw.js حسب ملفات المشروع.
 * أي تعديل في أي ملف يغيّر البصمة، فيتحدث الكاش عند المستخدمين.
 * الاستخدام: node scripts/stamp-sw.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'src', 'public'];
const SKIP = [/\.DS_Store$/, /^public\/icons\/.*\.svg\.src$/];

function walk(rel) {
  const abs = path.join(ROOT, rel);
  const st = fs.statSync(abs);
  if (st.isFile()) return [rel];
  return fs.readdirSync(abs).sort().flatMap((n) => walk(path.posix.join(rel, n)));
}

const files = INCLUDE.flatMap(walk).filter((f) => !SKIP.some((re) => re.test(f)));
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);

// modulepreload لكل وحدات JS لتفادي تحميلها في سلسلة متتابعة
const idxPath = path.join(ROOT, 'index.html');
let idx = fs.readFileSync(idxPath, 'utf8');
const mods = files.filter((f) => f.startsWith('src/') && f.endsWith('.js'));
idx = idx.replace(/<!-- modulepreload:start -->[\s\S]*?<!-- modulepreload:end -->/, `<!-- modulepreload:start -->\n${mods.map((m) => `  <link rel="modulepreload" href="${m}">`).join('\n')}\n  <!-- modulepreload:end -->`);
fs.writeFileSync(idxPath, idx);

const swPath = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n  './',\n${files.map((f) => `  '${f}',`).join('\n')}\n];`);
fs.writeFileSync(swPath, sw);
console.log(`sw.js → VERSION ${version}, ${files.length} ملف`);
