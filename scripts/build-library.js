#!/usr/bin/env node
/**
 * build-library.js — مكتبة الأحاديث: أحاديث صحيحة مختارة بنصها وتخريجها وشرحها
 * المصدر: موسوعة الأحاديث النبوية HadeethEnc.com (مشروع مركز رواد الترجمة)،
 * ونأخذ فقط ما حكمه «صحيح»، ونقدّم «المتفق عليه» أولًا.
 * المخرجات: public/data/library/{topic}.json  + public/data/library/index.json
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data', 'library');
const CACHE = path.join(__dirname, '.cache', 'hadeethenc');
const API = 'https://hadeethenc.com/api/v1';

// الموضوعات وتصنيفاتها في الموسوعة (ومعها كلمات تصفية عند الحاجة)
const TOPICS = [
  { id: 'salah', title: 'فضل الصلاة', icon: 'mosque', cats: [457, 469, 456] },
  { id: 'wudu', title: 'الوضوء وفضله', icon: 'drop', cats: [441, 442, 443, 444, 445] },
  { id: 'akhlaq', title: 'الأخلاق', icon: 'heart', cats: [282] },
  // الصبر ليس له تصنيف مستقل: نبحث في الفضائل والآداب والعقيدة عن نص الحديث نفسه (لا الشرح)
  { id: 'sabr', title: 'الصبر', icon: 'leaf', cats: [5, 3], matchText: /صَ?بَ?رَ?|الصَّبْر|الصبر|يَصْبِر|يصبر|صابر|فَاصْبِر|فاصبر|احتسب|احْتَسَب|ابتلي|ابْتَلَى|البلاء|الْبَلَاء|مصيبة|مُصِيبَة|أَصَابَتْهُ|أصابته/ },
  { id: 'quran', title: 'فضل القرآن', icon: 'book', cats: [39, 40, 272, 31] },
  { id: 'ilm', title: 'فضل العلم والعلماء', icon: 'lamp', cats: [270, 629] },
  { id: 'sahaba', title: 'فضائل الصحابة', icon: 'star', cats: [101, 276, 631, 103, 275], maxLen: 700 },
  // قصص الصحابة: الروايات الطويلة (قصص كاملة) من فضائلهم والسيرة
  { id: 'qisas', title: 'قصص الصحابة', icon: 'users', cats: [101, 276, 631, 103, 275, 367], minLen: 700 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url, cacheName) {
  const file = cacheName && path.join(CACHE, cacheName);
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        if (file) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, JSON.stringify(d)); }
        return d;
      }
      throw new Error(r.status);
    } catch (e) { if (i === 4) throw new Error(`${url}: ${e.message}`); await sleep(1000 * 2 ** i); }
  }
}

async function listCategory(cat) {
  const ids = [];
  for (let page = 1; ; page++) {
    const d = await getJSON(`${API}/hadeeths/list/?language=ar&category_id=${cat}&page=${page}&per_page=100`, `list-${cat}-${page}.json`);
    ids.push(...d.data.map((x) => x.id));
    if (page >= +d.meta.last_page) break;
  }
  return ids;
}

const clean = (s) => (s || '').replace(/‌/g, '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  const detail = new Map();
  const getOne = async (id) => {
    if (!detail.has(id)) detail.set(id, getJSON(`${API}/hadeeths/one/?language=ar&id=${id}`, `one-${id}.json`));
    return detail.get(id);
  };
  for (const t of TOPICS) {
    const ids = [...new Set((await Promise.all(t.cats.map(listCategory))).flat())];
    const items = [];
    // تنزيل التفاصيل على دفعات صغيرة احترامًا للخادم
    for (let i = 0; i < ids.length; i += 6) {
      const batch = await Promise.all(ids.slice(i, i + 6).map(getOne));
      for (const h of batch) {
        if (!/^صحيح/.test((h.grade || '').trim())) continue; // الصحيح فقط
        const len = (h.hadeeth || '').replace(/[\u064B-\u065F\u0670]/g, '').length;
        if (t.minLen && len < t.minLen) continue;
        if (t.maxLen && len >= t.maxLen) continue;
        if (t.matchText) {
          // نطابق على النص بعد حذف التشكيل حتى تتطابق الكلمات بأي ضبط
          const plain = (h.hadeeth + ' ' + h.title).replace(/[\u064B-\u065F\u0670\u0640]/g, '');
          if (!/صبر|يصبر|صابر|فاصبر|احتسب|ابتلي|ابتلى|البلاء|مصيبة|أصابته/.test(plain)) continue;
        }
        items.push({
          id: +h.id,
          title: clean(h.title),
          text: clean(h.hadeeth),
          by: clean(h.attribution),
          grade: clean(h.grade),
          agreed: /متفق عليه/.test(h.attribution || ''),
          explain: clean(h.explanation),
          hints: (h.hints || []).map(clean).filter(Boolean),
          words: (h.words_meanings || []).map((w) => [clean(w.word), clean(w.meaning)]).filter(([a, b]) => a && b),
          ref: clean(h.reference),
        });
      }
      process.stdout.write(`\r${t.title}: ${Math.min(i + 6, ids.length)}/${ids.length}   `);
    }
    // المتفق عليه أولًا، ثم ما في البخاري ثم مسلم، ثم الباقي
    const rank = (x) => (x.agreed ? 0 : /البخاري/.test(x.by) ? 1 : /مسلم/.test(x.by) ? 2 : 3);
    items.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
    const seen = new Set();
    for (let i = items.length - 1; i >= 0; i--) { const k = items[i].title.replace(/[\u064B-\u065F\u0670\s]/g, ''); if (seen.has(k)) items.splice(i, 1); else seen.add(k); }
    items.reverse(); items.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
    fs.writeFileSync(path.join(OUT, `${t.id}.json`), JSON.stringify(items));
    index.push({ id: t.id, title: t.title, icon: t.icon, count: items.length, agreed: items.filter((x) => x.agreed).length });
    process.stdout.write(`\n✓ ${t.title}: ${items.length} حديث صحيح (${items.filter((x) => x.agreed).length} متفق عليه)\n`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));

  // ---- دليل الوضوء والصلاة: كل خطوة ومعها نص دليلها من الموسوعة ----
  const guide = JSON.parse(fs.readFileSync(path.join(__dirname, 'fiqh-guide.src.json'), 'utf8'));
  const ev = {};
  const ids = new Set(guide.sections.flatMap((sec) => [...(sec.evidence || []), ...sec.steps.flatMap((st) => st.e || [])]));
  for (const id of ids) {
    const h = await getOne(String(id));
    if (!h?.hadeeth) throw new Error('دليل غير موجود: ' + id);
    if (!/^(صحيح|حسن)/.test((h.grade || '').trim())) throw new Error(`دليل ليس صحيحًا ولا حسنًا: ${id} (${h.grade})`);
    ev[id] = { id: +h.id, title: clean(h.title), text: clean(h.hadeeth), by: clean(h.attribution), grade: clean(h.grade), agreed: /متفق عليه/.test(h.attribution || ''), explain: clean(h.explanation), hints: (h.hints || []).map(clean).filter(Boolean), words: (h.words_meanings || []).map((w) => [clean(w.word), clean(w.meaning)]).filter(([a, b]) => a && b), ref: clean(h.reference) };
  }
  fs.writeFileSync(path.join(OUT, 'fiqh.json'), JSON.stringify({ ...guide, evidence: ev }));
  console.log(`✓ دليل الوضوء والصلاة: ${guide.sections.length} أقسام، ${ids.size} دليل`);
}
main().catch((e) => { console.error(e); process.exit(1); });
