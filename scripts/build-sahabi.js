#!/usr/bin/env node
/**
 * build-sahabi.js — «صحابي اليوم»: سيرة مختصرة لصحابي كل يوم
 *   - مقدمة السيرة من ويكيبيديا العربية (CC BY-SA 4.0) مع رابط المقال
 *   - ومعها الأحاديث الصحيحة التي ورد فيها اسمه من مكتبة الأحاديث (HadeethEnc)
 * يُشغَّل بعد build-library.js. المخرجات: public/data/library/sahabi.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache', 'wiki-sahaba.json');
const OUT = path.join(ROOT, 'public', 'data', 'library', 'sahabi.json');

// [اسم المقال في ويكيبيديا العربية، الاسم المعروض، كلمات البحث عنه في الأحاديث]
const SAHABA = [
  ['أبو بكر الصديق', 'أبو بكر الصديق', ['أبو بكر', 'أبي بكر', 'أبا بكر']],
  ['عمر بن الخطاب', 'عمر بن الخطاب', ['عمر بن الخطاب', 'يا عمر']],
  ['عثمان بن عفان', 'عثمان بن عفان', ['عثمان']],
  ['علي بن أبي طالب', 'علي بن أبي طالب', ['علي بن أبي طالب', 'يا علي']],
  ['طلحة بن عبيد الله', 'طلحة بن عبيد الله', ['طلحة بن عبيد الله']],
  ['الزبير بن العوام', 'الزبير بن العوام', ['الزبير بن العوام', 'الزبير']],
  ['عبد الرحمن بن عوف', 'عبد الرحمن بن عوف', ['عبد الرحمن بن عوف']],
  ['سعد بن أبي وقاص', 'سعد بن أبي وقاص', ['سعد بن أبي وقاص']],
  ['سعيد بن زيد', 'سعيد بن زيد', ['سعيد بن زيد']],
  ['أبو عبيدة بن الجراح', 'أبو عبيدة بن الجراح', ['أبو عبيدة', 'أبا عبيدة']],
  ['خديجة بنت خويلد', 'خديجة بنت خويلد', ['خديجة']],
  ['عائشة بنت أبي بكر', 'عائشة أم المؤمنين', ['عائشة']],
  ['فاطمة الزهراء', 'فاطمة الزهراء', ['فاطمة']],
  ['حمزة بن عبد المطلب', 'حمزة بن عبد المطلب', ['حمزة']],
  ['العباس بن عبد المطلب', 'العباس بن عبد المطلب', ['العباس بن عبد المطلب', 'العباس']],
  ['جعفر بن أبي طالب', 'جعفر بن أبي طالب', ['جعفر']],
  ['الحسن بن علي', 'الحسن بن علي', ['الحسن بن علي']],
  ['الحسين بن علي', 'الحسين بن علي', ['الحسين بن علي']],
  ['بلال بن رباح', 'بلال بن رباح', ['بلال']],
  ['عمار بن ياسر', 'عمار بن ياسر', ['عمار']],
  ['سمية بنت خياط', 'سمية بنت خياط', ['سمية']],
  ['خباب بن الأرت', 'خباب بن الأرت', ['خباب']],
  ['صهيب الرومي', 'صهيب الرومي', ['صهيب']],
  ['سلمان الفارسي', 'سلمان الفارسي', ['سلمان']],
  ['أبو ذر الغفاري', 'أبو ذر الغفاري', ['أبو ذر', 'أبي ذر', 'أبا ذر']],
  ['مصعب بن عمير', 'مصعب بن عمير', ['مصعب']],
  ['عبد الله بن مسعود', 'عبد الله بن مسعود', ['ابن مسعود', 'عبد الله بن مسعود']],
  ['معاذ بن جبل', 'معاذ بن جبل', ['معاذ بن جبل', 'يا معاذ']],
  ['أبي بن كعب', 'أُبيّ بن كعب', ['أبي بن كعب', 'أُبي', 'أبا المنذر']],
  ['زيد بن ثابت', 'زيد بن ثابت', ['زيد بن ثابت']],
  ['أبو هريرة', 'أبو هريرة', ['أبو هريرة', 'أبي هريرة', 'أبا هريرة']],
  ['أنس بن مالك', 'أنس بن مالك', ['أنس']],
  ['عبد الله بن عباس', 'عبد الله بن عباس', ['ابن عباس']],
  ['عبد الله بن عمر', 'عبد الله بن عمر', ['ابن عمر']],
  ['عبد الله بن عمرو بن العاص', 'عبد الله بن عمرو بن العاص', ['عبد الله بن عمرو']],
  ['جابر بن عبد الله', 'جابر بن عبد الله', ['جابر بن عبد الله']],
  ['أبو سعيد الخدري', 'أبو سعيد الخدري', ['أبي سعيد الخدري', 'أبو سعيد']],
  ['أبو موسى الأشعري', 'أبو موسى الأشعري', ['أبي موسى', 'أبو موسى', 'أبا موسى']],
  ['خالد بن الوليد', 'خالد بن الوليد', ['خالد بن الوليد']],
  ['سعد بن معاذ', 'سعد بن معاذ', ['سعد بن معاذ']],
  ['سعد بن عبادة', 'سعد بن عبادة', ['سعد بن عبادة']],
  ['أسيد بن حضير', 'أسيد بن حضير', ['أسيد بن حضير']],
  ['أبو أيوب الأنصاري', 'أبو أيوب الأنصاري', ['أبي أيوب', 'أبو أيوب']],
  ['أبو طلحة الأنصاري', 'أبو طلحة الأنصاري', ['أبو طلحة', 'أبي طلحة']],
  ['أم سليم بنت ملحان', 'أم سليم', ['أم سليم']],
  ['أسماء بنت أبي بكر', 'أسماء بنت أبي بكر', ['أسماء بنت أبي بكر', 'ذات النطاقين']],
  ['أم سلمة', 'أم سلمة أم المؤمنين', ['أم سلمة']],
  ['حفصة بنت عمر', 'حفصة أم المؤمنين', ['حفصة']],
  ['زيد بن حارثة', 'زيد بن حارثة', ['زيد بن حارثة']],
  ['أسامة بن زيد', 'أسامة بن زيد', ['أسامة']],
  ['عبد الله بن رواحة', 'عبد الله بن رواحة', ['ابن رواحة', 'عبد الله بن رواحة']],
  ['حذيفة بن اليمان', 'حذيفة بن اليمان', ['حذيفة']],
  ['أبو الدرداء', 'أبو الدرداء', ['أبي الدرداء', 'أبو الدرداء']],
  ['عبادة بن الصامت', 'عبادة بن الصامت', ['عبادة بن الصامت']],
  ['كعب بن مالك', 'كعب بن مالك', ['كعب بن مالك']],
  ['حسان بن ثابت', 'حسان بن ثابت', ['حسان بن ثابت', 'لحسان', 'حسان']],
  ['عبد الله بن الزبير', 'عبد الله بن الزبير', ['عبد الله بن الزبير']],
  ['نسيبة بنت كعب', 'نسيبة بنت كعب (أم عمارة)', ['أم عمارة']],
  ['عثمان بن مظعون', 'عثمان بن مظعون', ['عثمان بن مظعون']],
  ['عكرمة بن أبي جهل', 'عكرمة بن أبي جهل', ['عكرمة']],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBatch(titles) {
  const url = new URL('https://ar.wikipedia.org/w/api.php');
  Object.entries({ action: 'query', prop: 'extracts|info', exintro: '1', explaintext: '1', exlimit: 'max', redirects: '1', inprop: 'url', format: 'json', titles: titles.join('|') })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'RattilQuranApp/1.0 (educational, non-commercial; https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/)' } }).catch(() => null);
    const txt = r ? await r.text() : '';
    if (r?.ok && txt.startsWith('{')) return JSON.parse(txt);
    const wait = 30000 * (i + 1);
    console.warn(`  محاولة ${i + 1}: ${r?.status || 'خطأ'} — انتظار ${wait / 1000} ث`);
    await sleep(wait);
  }
  throw new Error('ويكيبيديا لم تستجب');
}

(async () => {
  let wiki = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const need = SAHABA.map((s) => s[0]).filter((t) => !wiki[t]);
  for (let i = 0; i < need.length; i += 20) {
    const batch = need.slice(i, i + 20);
    const d = await fetchBatch(batch);
    const norm = Object.fromEntries((d.query.normalized || []).map((x) => [x.to, x.from]));
    const redir = Object.fromEntries((d.query.redirects || []).map((x) => [x.to, x.from]));
    for (const p of Object.values(d.query.pages)) {
      if (!p.extract) continue;
      let orig = p.title; orig = redir[orig] || orig; orig = norm[orig] || orig;
      wiki[orig] = { title: p.title, url: p.fullurl, extract: p.extract };
    }
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(wiki));
    console.log(`✓ دفعة ${i / 20 + 1}: ${batch.length}`);
    await sleep(8000);
  }
  // المقدمات القصيرة: نجلب المقال كاملًا (طلب لكل مقال، ببطء) ونأخذ ما قبل قسم المراجع
  for (const [title] of SAHABA) {
    const w = wiki[title];
    if (!w || w.full || w.extract.length >= 700) continue;
    const url = new URL('https://ar.wikipedia.org/w/api.php');
    Object.entries({ action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', redirects: '1', format: 'json', titles: w.title }).forEach(([k, v]) => url.searchParams.set(k, v));
    let d = null;
    for (let i = 0; i < 6 && !d; i++) {
      const r = await fetch(url, { headers: { 'User-Agent': 'RattilQuranApp/1.0 (educational, non-commercial)' } }).catch(() => null);
      const txt = r ? await r.text() : '';
      if (r?.ok && txt.startsWith('{')) d = JSON.parse(txt); else await sleep(30000 * (i + 1));
    }
    const full = d && Object.values(d.query.pages)[0].extract;
    if (full) { w.full = full.split(/\n(?:المراجع|مراجع|انظر أيضًا|انظر أيضا|وصلات خارجية|المصادر|مصادر|هوامش)\s*\n/)[0]; fs.writeFileSync(CACHE, JSON.stringify(wiki)); console.log('  + مقال كامل:', title); }
    await sleep(6000);
  }
  // الأحاديث التي ورد فيها اسم الصحابي (من مكتبتنا الصحيحة)
  const lib = ['sahaba', 'qisas'].flatMap((t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/library', t + '.json'), 'utf8')));
  const strip = (s) => s.replace(/[ً-ٰٟـ]/g, '');
  const out = [];
  for (const [title, name, keys] of SAHABA) {
    const w = wiki[title];
    if (!w) { console.warn('✗ بلا مقال:', title); continue; }
    // الفقرات (بلا عناوين الأقسام القصيرة)، بحد أقصى ~٢٢٠٠ حرف تنتهي عند نهاية فقرة
    const paras = (w.full || w.extract).split(/\n+/).map((x) => x.replace(/\s*\[\d+\]/g, '').trim()).filter((x) => x.length > 60);
    const pick = [];
    let n = 0;
    for (const p of paras) { if (n > 1400 || (n && n + p.length > 2200)) break; pick.push(p); n += p.length; }
    const bio = pick.join('\n\n');
    const B = '(^|[\\s«"(،.:؛!؟\\-])', E = '(?=$|[\\s»"),.:،؛!؟\\-])';
    const res = keys.map((k) => new RegExp(B + strip(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + E));
    const hadith = lib.filter((h) => {
      let t = strip(h.text);
      if (name === 'الزبير بن العوام') t = t.replace(/عبد الله بن الزبير|ابن الزبير/g, '');
      return res.some((re) => re.test(t));
    }).slice(0, 4).map((h) => h.id);
    out.push({ name, bio, url: w.url, hadith });
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✓ صحابي اليوم: ${out.length} صحابي`);
})().catch((e) => { console.error(e); process.exit(1); });
