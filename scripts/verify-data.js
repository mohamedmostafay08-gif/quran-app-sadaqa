#!/usr/bin/env node
/**
 * verify-data.js — فحص سلامة نص المصحف وملفات البيانات، للقراءة فقط (لا يكتب أي ملف ولا يحتاج إنترنت).
 * يعيد تركيب النص العثماني مع البسملة ويطابق بصمة sha256 المسجّلة من Tanzil، ويتحقق من الأعداد والتفاسير المحلية،
 * ويتأكد أن ملفات public/data لم تتغير عن فرع main (ما عدا extras.json الذي يولّده stamp-sw.js).
 * التشغيل: node scripts/verify-data.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
let failed = 0;
const check = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) failed++; };

const surahs = read('public/data/surahs.json');
const uth = read('public/data/quran-uthmani.json');
const simple = read('public/data/quran-simple.json');
const meta = read('public/data/quran-meta.json');

const count = (q) => q.ayahs.reduce((n, s) => n + s.length, 0);
check(surahs.length === 114 && uth.ayahs.length === 114 && simple.ayahs.length === 114, 'عدد السور = 114');
check(count(uth) === 6236 && count(simple) === 6236, `عدد الآيات = ${count(uth)} (عثماني) و${count(simple)} (إملائي)`);
check(surahs.every((s, i) => s.ayahCount === uth.ayahs[i].length && s.ayahCount === simple.ayahs[i].length), 'عدد آيات كل سورة متطابق في الملفات الثلاثة');
check(surahs.filter((s) => s.basmala).length === 112, 'البسملة مفصولة كعنوان في 112 سورة');
check(meta.juz.length === 30 && meta.pages.length === 604 && meta.quarters.length === 240 && meta.sajdas.length === 15, 'الأجزاء 30 والصفحات 604 والأرباع 240 والسجدات 15');

const rebuilt = uth.ayahs.map((ay, i) => ay.map((t, j) => (j === 0 && surahs[i].basmala ? surahs[i].basmala + ' ' + t : t))).flat().join('\n');
const sha = crypto.createHash('sha256').update(rebuilt).digest('hex');
check(sha === uth.notice.sha256, `بصمة النص العثماني مطابقة لأصل Tanzil (sha256 ${sha.slice(0, 12)}…)`);

for (const dir of ['tafsir', 'tafsir-saadi']) {
  let ok = true;
  for (let s = 1; s <= 114; s++) {
    const t = read(`public/data/${dir}/${s}.json`);
    if (!Array.isArray(t) || t.length !== surahs[s - 1].ayahCount) { ok = false; console.log(`  ${dir}/${s}.json: ${t?.length} ≠ ${surahs[s - 1].ayahCount}`); }
  }
  check(ok, `${dir}: 114 ملفًا وعدد التفاسير يطابق عدد الآيات`);
}

try {
  const base = execSync('git merge-base HEAD origin/main', { cwd: ROOT }).toString().trim();
  const changed = execSync(`git diff --name-only ${base} -- public/data`, { cwd: ROOT }).toString().split('\n').filter((f) => f && f !== 'public/data/extras.json');
  check(changed.length === 0, changed.length ? `ملفات بيانات تغيّرت عن main: ${changed.join(', ')}` : 'لم يتغير أي ملف بيانات عن main');
} catch { console.log('… تخطّي مقارنة git (المستودع غير متاح)'); }

if (failed) { console.error(`\n${failed} فحص فشل`); process.exit(1); }
console.log('\nكل الفحوصات نجحت');
