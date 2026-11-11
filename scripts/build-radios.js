#!/usr/bin/env node
/**
 * build-radios.js — إذاعات القرآن الكريم (بث مباشر)
 *   - إذاعة القرآن الكريم من القاهرة والسعودية (radiojar)
 *   - إذاعات mp3quran.net: العامة، التفسير، الرقية، ولكل قارئ إذاعة
 * المخرجات: public/data/radios.json = { featured: [...], reciters: [...] }
 */
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'public', 'data', 'radios.json');

const FEATURED = [
  { id: 'cairo', name: 'إذاعة القرآن الكريم من القاهرة', sub: 'البث المباشر للإذاعة المصرية', url: 'https://stream.radiojar.com/8s5u5tpdtwzuv' },
  { id: 'saudi', name: 'إذاعة القرآن الكريم من السعودية', sub: 'البث المباشر من الرياض', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
  { id: 'mix', name: 'تلاوات متنوعة', sub: 'لمختلف القراء على مدار الساعة', url: 'https://backup.qurango.net/radio/mix' },
  { id: 'salma', name: 'تلاوات خاشعة', sub: 'تلاوات هادئة مختارة', url: 'https://backup.qurango.net/radio/salma' },
  { id: 'tafseer', name: 'تفسير القرآن الكريم', sub: 'دروس التفسير', url: 'https://backup.qurango.net/radio/tafseer' },
  { id: 'mukhtasar', name: 'المختصر في التفسير', sub: 'تفسير مختصر للآيات', url: 'https://backup.qurango.net/radio/mukhtasartafsir' },
  { id: 'roqiah', name: 'الرقية الشرعية', sub: 'آيات الرقية', url: 'https://backup.qurango.net/radio/roqiah' },
];
// إذاعات ليست لقارئ واحد (تظهر في المختارة أو نتجاهلها)
const SKIP = /تفسير|الرقية|متنوعة|خاشعة|السعودية|ترجمة|Translation/;
// برامج وموضوعات (ليست لقارئ واحد)
const PROGRAM = /آيات|سورة|صحيح|رياض|الشمائل|صور من|فضل|كتاب|تراتيل|سيرة|فتاوى|أذكار|حديث|قصص|دروس|محاضرات|تكبيرات/;
// تمييز الروايات/الأداء من اسم الرابط عند تكرار اسم القارئ
const VARIANT = [[/mojawwad/, 'مجوّد'], [/warsh/, 'ورش'], [/khalaf/, 'خلف'], [/assosi/, 'السوسي'], [/aldori_an_abi_amr/, 'الدوري عن أبي عمرو'], [/aldori|aldorai/, 'الدوري'],
  [/thakwan/, 'ابن ذكوان'], [/albizi/, 'البزي'], [/asbahani/, 'الأصبهاني'], [/qalon|qaloon/, 'قالون']];

(async () => {
  const res = await fetch('https://www.mp3quran.net/api/v3/radios?language=ar');
  if (!res.ok) throw new Error('radios ' + res.status);
  const { radios } = await res.json();
  const used = new Set(FEATURED.map((r) => r.url));
  const clean = (n) => n.replace(/\*/g, '').replace(/^(الشيخ|شيخ|أذاعة|إذاعة)\s+/, '').replace(/[-–\s]+$/, '').replace(/\s*-\s*/g, ' - ').trim();
  const list = radios
    .filter((r) => r.url && /^https:/.test(r.url) && !used.has(r.url) && !SKIP.test(r.name))
    .map((r) => {
      const slug = r.url.split('/').pop();
      const v = VARIANT.find(([re]) => re.test(slug));
      return { id: 'm' + r.id, name: clean(r.name), sub: v ? v[1] : '', url: r.url, program: PROGRAM.test(r.name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.sub.localeCompare(b.sub, 'ar'));
  const reciters = list.filter((r) => !r.program).map(({ program, ...r }) => r);
  const programs = list.filter((r) => r.program).map(({ program, sub, ...r }) => r);
  fs.writeFileSync(OUT, JSON.stringify({ featured: FEATURED, reciters, programs }));
  console.log(`✓ ${FEATURED.length} مختارة، ${reciters.length} للقراء، ${programs.length} برامج`);
})().catch((e) => { console.error(e); process.exit(1); });
