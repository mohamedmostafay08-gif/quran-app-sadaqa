#!/usr/bin/env node
/**
 * build-extra.js — بيانات المرحلة 6 (التعمق). يُشغَّل بعد build-data.js.
 *
 * المصادر:
 *   - الصرف والجذور: Quranic Arabic Corpus v0.4 (GNU GPL) عبر نسخة mustafa0x/quran-morphology المصححة.
 *   - معنى الكلمة بالإنجليزية + علامات التجويد: Quran.com API v4.
 *   - التفسير الميسر (مجمع الملك فهد): Quran.com API v4 (tafsir 16).
 *
 * التجويد: نص Quran.com يختلف في بعض الرموز عن نص Tanzil، لذلك لا نعرض نصهم؛
 * نحاذي الحروف (LCS) وننقل مواضع الأحكام فقط على نص Tanzil الأصلي دون تغيير حرف.
 *
 * المخرجات (public/data):
 *   words/{n}.json   كلمات كل آية: [جذر، لمة، #نوع الكلمة، #سوابق/لواحق، معنى إنجليزي] (# = فهرس في words/labels.json)
 *   roots.json       الجذر → قائمة المواضع (s*1e6 + a*1e3 + w)
 *   tajweed.json     { rules: [...], ayahs: { "s:a": [[start,end,rule], ...] } }
 *   tafsir/{n}.json  التفسير الميسر لكل آية
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const OUT = path.join(ROOT, 'public', 'data');
const QC = 'https://api.quran.com/api/v4';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      throw new Error(res.status);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
}
async function cached(name, fn) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const data = await fn();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}
async function cachedText(name, url) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  console.log(`↓ ${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const t = await res.text();
  fs.writeFileSync(file, t);
  return t;
}

const uthmani = JSON.parse(fs.readFileSync(path.join(OUT, 'quran-uthmani.json'), 'utf8')).ayahs;
const surahs = JSON.parse(fs.readFileSync(path.join(OUT, 'surahs.json'), 'utf8'));

// علامات الوقف والرموز التي تأتي ككلمة مستقلة في نص Tanzil
const MARK_TOKEN = /^[ۖ-ۭ]+$/;
const tokens = (t) => t.split(' ');
const isWordToken = (tok) => !MARK_TOKEN.test(tok);

// ---------------- الصرف ----------------
const P_NAMES = {
  P: 'حرف جر', EMPH: 'لام التوكيد', IMPV: 'لام الأمر', PRP: 'لام التعليل', CONJ: 'حرف عطف', SUB: 'حرف مصدري',
  ACC: 'حرف نصب', AMD: 'حرف استدراك', ANS: 'حرف جواب', AVR: 'حرف ردع', CAUS: 'حرف سببية', CERT: 'حرف تحقيق',
  CIRC: 'واو الحال', COM: 'واو المعية', COND: 'حرف شرط', EQ: 'حرف تسوية', EXH: 'حرف تحضيض', EXL: 'حرف تفصيل',
  EXP: 'أداة استثناء', FUT: 'حرف استقبال', INC: 'حرف ابتداء', INT: 'حرف تفسير', INTG: 'حرف استفهام', NEG: 'حرف نفي',
  PREV: 'حرف كاف', PRO: 'حرف نهي', REM: 'حرف استئناف', RES: 'أداة حصر', RET: 'حرف إضراب', RSLT: 'حرف جواب الشرط',
  SUP: 'حرف زائد', SUR: 'حرف فجاءة', VOC: 'حرف نداء', INL: 'حروف مقطعة', ATT: 'حرف تنبيه', DET: 'أداة تعريف',
};
const N_NAMES = {
  PN: 'اسم علم', REL: 'اسم موصول', PRON: 'ضمير', ACT_PCPL: 'اسم فاعل', PASS_PCPL: 'اسم مفعول', VN: 'مصدر',
  T: 'ظرف زمان', LOC: 'ظرف مكان', DEM: 'اسم إشارة', INTG: 'اسم استفهام', COND: 'اسم شرط', NV: 'اسم فعل', IMPN: 'اسم فعل أمر',
};
const FORMS = ['', 'فَعَلَ', 'فَعَّلَ', 'فَاعَلَ', 'أَفْعَلَ', 'تَفَعَّلَ', 'تَفَاعَلَ', 'انْفَعَلَ', 'افْتَعَلَ', 'افْعَلَّ', 'اسْتَفْعَلَ', 'افْعَالَّ', 'افْعَوْعَلَ'];
const CASES = { NOM: 'مرفوع', ACC: 'منصوب', GEN: 'مجرور' };
const MOODS = { IND: 'مرفوع', SUBJ: 'منصوب', JUS: 'مجزوم' };

function describe(segs) {
  // segs: [{ tag, f: [features] }]
  const stem = segs.find((s) => !s.f.includes('PREF') && !s.f.includes('SUFF')) || segs[0];
  const f = stem.f;
  const get = (k) => (f.find((x) => x.startsWith(k + ':')) || '').slice(k.length + 1);
  let pos;
  if (stem.tag === 'V') {
    pos = f.includes('PERF') ? 'فعل ماضٍ' : f.includes('IMPF') ? 'فعل مضارع' : f.includes('IMPV') ? 'فعل أمر' : 'فعل';
    if (f.includes('PASS')) pos += ' مبني للمجهول';
    const vf = +get('VF');
    if (vf > 1 && FORMS[vf]) pos += ` · على وزن ${FORMS[vf]}`;
    const mood = f.find((x) => x.startsWith('MOOD:'));
    if (mood && MOODS[mood.slice(5)]) pos += ` · ${MOODS[mood.slice(5)]}`;
  } else if (stem.tag === 'N') {
    pos = N_NAMES[f[0]] || (f.includes('ADJ') ? 'صفة' : 'اسم');
    if (f.includes('ADJ') && !N_NAMES[f[0]]) pos = 'صفة';
    const c = f.find((x) => CASES[x]);
    if (c) pos += ` · ${CASES[c]}`;
  } else {
    pos = P_NAMES[f[0]] || 'حرف';
  }
  const pre = segs.filter((s) => s.f.includes('PREF')).map((s) => {
    const k = s.f[0];
    if (k === 'DET') return null;
    return P_NAMES[k] || null;
  }).filter(Boolean);
  const suf = segs.some((s) => s.f.includes('SUFF') && s.f[0] === 'PRON') ? 'متصل بضمير' : null;
  const extra = [pre.length ? `مسبوق ب${pre.join(' و')}` : null, suf].filter(Boolean).join('، ');
  return { root: get('ROOT'), lemma: get('LEM'), pos, extra };
}

async function buildMorphology() {
  const txt = await cachedText('morphology.txt', 'https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt');
  const words = new Map(); // "s:a" → Map(w → segs)
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    const [loc, , tag, feat] = line.split('\t');
    const [s, a, w] = loc.split(':').map(Number);
    const k = `${s}:${a}`;
    if (!words.has(k)) words.set(k, new Map());
    const m = words.get(k);
    if (!m.has(w)) m.set(w, []);
    m.get(w).push({ tag, f: feat.split('|') });
  }
  return words;
}

// ---------------- Quran.com ----------------
async function fetchGlosses() {
  return cached('qc-glosses.json', async () => {
    const out = {};
    for (let s = 1; s <= 114; s++) {
      process.stdout.write(`\r↓ معاني الكلمات: سورة ${s}/114 `);
      let page = 1;
      while (page) {
        const d = await getJSON(`${QC}/verses/by_chapter/${s}?words=true&word_fields=text_uthmani&per_page=50&page=${page}&fields=`);
        for (const v of d.verses) out[v.verse_key] = v.words.filter((w) => w.char_type_name === 'word').map((w) => (w.translation?.text || '').trim());
        page = d.pagination.next_page;
      }
    }
    process.stdout.write('\n');
    return out;
  });
}

async function fetchTafsir() {
  return cached('qc-muyassar.json', async () => {
    const out = {};
    for (let s = 1; s <= 114; s++) {
      process.stdout.write(`\r↓ التفسير الميسر: سورة ${s}/114 `);
      let page = 1;
      while (page) {
        const d = await getJSON(`${QC}/tafsirs/16/by_chapter/${s}?per_page=50&page=${page}`);
        for (const t of d.tafsirs) out[t.verse_key] = t.text;
        page = d.pagination?.next_page;
      }
    }
    process.stdout.write('\n');
    return out;
  });
}

async function fetchTajweed() {
  return cached('tajweed.json', async () => getJSON(`${QC}/quran/verses/uthmani_tajweed`));
}

const cleanHtml = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// ---------------- محاذاة التجويد (LCS) ----------------
function lcsMap(a, b) {
  // يرجع map[i] = j لكل حرف متطابق من a إلى b
  const n = a.length, m = b.length;
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint16Array(m + 1);
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i], next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }
  const map = new Int32Array(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { map[i] = j; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { map, score: dp[0][0] };
}

const RULES = ['ham_wasl', 'laam_shamsiyah', 'slnt', 'madda_normal', 'madda_permissible', 'madda_obligatory', 'madda_necessary',
  'qalaqah', 'ghunnah', 'ikhafa', 'ikhafa_shafawi', 'idgham_ghunnah', 'idgham_wo_ghunnah', 'idgham_shafawi',
  'idgham_mutajanisayn', 'idgham_mutaqaribayn', 'iqlab'];

function alignTajweed(html, ref) {
  html = html.replace(/<span class=end>[\s\S]*?<\/span>/g, '').trim();
  // تفكيك النص الموسوم إلى حروف مع القاعدة
  let plain = '';
  const spans = [];
  const re = /<tajweed class=([a-z_]+)>([\s\S]*?)<\/tajweed>|<[^>]+>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { spans.push([plain.length, plain.length + m[2].length, m[1]]); plain += m[2]; }
    else if (m[3]) plain += m[3];
  }
  plain = plain.replace(/\s+$/, '');
  const { map, score } = lcsMap(plain, ref);
  const quality = score / Math.max(plain.length, ref.length);
  const out = [];
  for (const [s, e, rule] of spans) {
    const r = RULES.indexOf(rule);
    if (r < 0) continue;
    let ts = -1, te = -1;
    for (let i = s; i < e && i < map.length; i++) if (map[i] >= 0) { if (ts < 0) ts = map[i]; te = map[i]; }
    if (ts < 0) continue;
    // نضم الحركات التالية لآخر حرف حتى لا ينفصل التشكيل عن حرفه
    te++;
    while (te < ref.length && /[ً-ٰٟۖ-ۭ]/.test(ref[te]) && (te - ts) < (e - s) + 3) te++;
    out.push([ts, te, r]);
  }
  return { ranges: out, quality };
}

// ---------------- main ----------------
async function main() {
  fs.mkdirSync(path.join(OUT, 'words'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'tafsir'), { recursive: true });

  const morph = await buildMorphology();
  const glosses = await fetchGlosses();
  const tafsir = await fetchTafsir();
  const tajweed = await fetchTajweed();

  // ---- الكلمات + الجذور ----
  const roots = {};
  let skipped = 0, glossMismatch = 0;
  // جدول مشترك للأوصاف المتكررة (نوع الكلمة / السوابق) لتصغير الملفات
  const table = [];
  const tIndex = new Map();
  const idx = (str) => { if (!tIndex.has(str)) { tIndex.set(str, table.length); table.push(str); } return tIndex.get(str); };
  for (let s = 1; s <= 114; s++) {
    const perAyah = [];
    uthmani[s - 1].forEach((text, i) => {
      const a = i + 1;
      const toks = tokens(text).filter(isWordToken);
      const m = morph.get(`${s}:${a}`);
      if (!m || m.size !== toks.length) { perAyah.push(null); skipped++; return; }
      const gl = glosses[`${s}:${a}`] || [];
      if (gl.length !== toks.length) glossMismatch++;
      const list = [];
      for (let w = 1; w <= toks.length; w++) {
        const d = describe(m.get(w));
        list.push([d.root, d.lemma, idx(d.pos), idx(d.extra), gl.length === toks.length ? gl[w - 1] : '']);
        if (d.root) (roots[d.root] ||= []).push(s * 1e6 + a * 1e3 + w);
      }
      perAyah.push(list);
    });
    fs.writeFileSync(path.join(OUT, 'words', `${s}.json`), JSON.stringify(perAyah));
  }
  fs.writeFileSync(path.join(OUT, 'words', 'labels.json'), JSON.stringify(table));
  console.log(`✓ الكلمات: ${114} ملف، ${skipped} آية بدون بيانات كلمات (اختلاف التقسيم)، ${glossMismatch} آية بدون معنى إنجليزي`);
  fs.writeFileSync(path.join(OUT, 'roots.json'), JSON.stringify(roots));
  console.log(`✓ الجذور: ${Object.keys(roots).length} جذر`);

  // ---- التفسير ----
  let tCount = 0;
  for (let s = 1; s <= 114; s++) {
    // التفسير الميسر يشرح أحيانًا عدة آيات معًا؛ الآيات التالية في المجموعة تأخذ { g: رقم أول آية }
    let lastA = 0;
    const arr = uthmani[s - 1].map((_, i) => {
      const t = tafsir[`${s}:${i + 1}`];
      if (t) { tCount++; lastA = i + 1; return cleanHtml(t); }
      return lastA ? lastA : '';
    });
    fs.writeFileSync(path.join(OUT, 'tafsir', `${s}.json`), JSON.stringify(arr));
  }
  console.log(`✓ التفسير الميسر: ${tCount}/6236 آية`);

  // ---- التجويد ----
  const ayahs = {};
  let low = 0, total = 0;
  for (const v of tajweed.verses) {
    const [s, a] = v.verse_key.split(':').map(Number);
    const ref = uthmani[s - 1][a - 1];
    const { ranges, quality } = alignTajweed(v.text_uthmani_tajweed, ref);
    if (quality < 0.9) { low++; continue; }
    if (ranges.length) ayahs[v.verse_key] = ranges;
    total += ranges.length;
  }
  fs.writeFileSync(path.join(OUT, 'tajweed.json'), JSON.stringify({ rules: RULES, ayahs }));
  console.log(`✓ التجويد: ${total} موضع، ${low} آية تجاوزناها لضعف المحاذاة`);

  // ملاحظة المصدر
  fs.writeFileSync(path.join(OUT, 'extra-notice.json'), JSON.stringify({
    morphology: 'Quranic Arabic Corpus v0.4 (GNU GPL) — corpus.quran.com, via github.com/mustafa0x/quran-morphology',
    glosses: 'Quran.com API v4 (word by word, English)',
    tajweed: 'Quran.com API v4 (uthmani_tajweed) — positions aligned onto Tanzil text',
    tafsir: 'التفسير الميسر — مجمع الملك فهد لطباعة المصحف الشريف، عبر Quran.com API',
    builtAt: new Date().toISOString().slice(0, 10),
  }));
  const size = (d) => fs.readdirSync(d).reduce((n, f) => n + fs.statSync(path.join(d, f)).size, 0);
  console.log(`  words: ${(size(path.join(OUT, 'words')) / 1024).toFixed(0)} KB, tafsir: ${(size(path.join(OUT, 'tafsir')) / 1024).toFixed(0)} KB, roots: ${(fs.statSync(path.join(OUT, 'roots.json')).size / 1024).toFixed(0)} KB, tajweed: ${(fs.statSync(path.join(OUT, 'tajweed.json')).size / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
