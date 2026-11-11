#!/usr/bin/env node
/**
 * build-mushaf-tajweed.js — أحكام التجويد لوضع الصفحات (نص مجمع الملك فهد text_qpc_hafs).
 * يأخذ مواضع الأحكام من نص Quran.com التجويدي (uthmani_tajweed) ويحاذيها حرفًا بحرف (LCS)
 * على كلمات نص المجمع، بعد توحيد الرموز التي تُكتب بأكواد مختلفة بين الترميزين.
 * يحتاج: scripts/.cache/tajweed.json و qc-qpc-words-v2.json (من build-extra.js و build-mushaf.js)
 * المخرجات: public/data/tajweed-qpc.json = { rules, ayahs: { "s:a": [[كلمة, بداية, نهاية, حكم], ...] } }
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const RULES = ['ham_wasl', 'laam_shamsiyah', 'slnt', 'madda_normal', 'madda_permissible', 'madda_obligatory', 'madda_necessary',
  'qalaqah', 'ghunnah', 'ikhafa', 'ikhafa_shafawi', 'idgham_ghunnah', 'idgham_wo_ghunnah', 'idgham_shafawi',
  'idgham_mutajanisayn', 'idgham_mutaqaribayn', 'iqlab'];

// توحيد رموز ترميز Quran.com العثماني إلى مقابلاتها في ترميز المجمع
const EQUIV = { 'ْ': 'ۡ', 'ى': 'ي', 'ً': 'ٗ', 'ٌ': 'ٞ', 'ٍ': 'ٖ', 'ٲ': 'ٰ', 'ٮ': 'ى' };
const DROP = new Set(['ـ', '‌']);

function lcsMap(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const map = new Int32Array(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { map[i] = j; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return { map, score: dp[0][0] };
}

const tajweed = JSON.parse(fs.readFileSync(path.join(CACHE, 'tajweed.json'), 'utf8')).verses;
const qpc = new Map(JSON.parse(fs.readFileSync(path.join(CACHE, 'qc-qpc-words-v2.json'), 'utf8')).map((v) => [v.key, v.words.filter((w) => !w[3]).map((w) => w[0])]));

const out = {};
let total = 0, low = 0;
for (const v of tajweed) {
  const words = qpc.get(v.verse_key);
  if (!words) continue;
  const html = v.text_uthmani_tajweed.replace(/<span class=end>[\s\S]*?<\/span>/g, '').trim();
  // نص QC مع مواضع الأحكام، بعد التوحيد (مع حفظ الفهارس الأصلية لا يلزم: نعمل على النص الموحّد)
  let plain = '';
  const spans = [];
  const re = /<tajweed class=([a-z_]+)>([\s\S]*?)<\/tajweed>|<[^>]+>|([^<]+)/g;
  let m;
  const norm = (t) => [...t].filter((c) => !DROP.has(c)).map((c) => EQUIV[c] || c).join('');
  while ((m = re.exec(html))) {
    if (m[1]) { const t = norm(m[2]); spans.push([plain.length, plain.length + t.length, m[1]]); plain += t; }
    else if (m[3]) plain += norm(m[3]);
  }
  plain = plain.replace(/\s+$/, '');
  const ref = words.join(' ');
  const { map, score } = lcsMap(plain, ref);
  if (score / Math.max(plain.length, ref.length) < 0.9) { low++; continue; }
  // حدود الكلمات في نص المجمع
  const starts = [];
  let pos = 0;
  for (const w of words) { starts.push(pos); pos += w.length + 1; }
  const wordAt = (j) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= j) k++; return k; };
  const ranges = [];
  for (const [s, e, rule] of spans) {
    const r = RULES.indexOf(rule);
    if (r < 0) continue;
    let ts = -1, te = -1;
    for (let i = s; i < e; i++) if (map[i] >= 0) { if (ts < 0) ts = map[i]; te = map[i]; }
    if (ts < 0) continue;
    te++;
    while (te < ref.length && /[ً-ٰٟۖ-ۭ]/.test(ref[te])) te++;
    // قد يعبر الحكم حدود كلمتين (الإدغام): نقسمه على الكلمات
    for (let k = wordAt(ts); k <= wordAt(te - 1); k++) {
      const ws = starts[k], we = ws + words[k].length;
      const a = Math.max(ts, ws) - ws, b = Math.min(te, we) - ws;
      if (b > a) ranges.push([k, a, b, r]);
    }
  }
  if (ranges.length) { out[v.verse_key] = ranges; total += ranges.length; }
}
fs.writeFileSync(path.join(ROOT, 'public/data/tajweed-qpc.json'), JSON.stringify({ rules: RULES, ayahs: out }));
console.log(`✓ تجويد الصفحات: ${total} موضع في ${Object.keys(out).length} آية، ${low} آية تجاوزناها لضعف المحاذاة، ${(fs.statSync(path.join(ROOT, 'public/data/tajweed-qpc.json')).size / 1024).toFixed(0)} KB`);
