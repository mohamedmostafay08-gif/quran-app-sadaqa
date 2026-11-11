# القرآن الكريم — تطبيق ويب (PWA)

مصحف كامل يعمل بدون إنترنت بعد أول فتح، مع تلاوات أشهر القراء، والختمة، والحفظ والمراجعة، والتجويد الملوّن، وكلمة بكلمة.
بدون باك إند، وبدون حسابات أو تتبع. كل بيانات المستخدم محفوظة على جهازه في IndexedDB.

## التشغيل محليًا

```bash
python3 -m http.server 8080
```

ثم افتح http://localhost:8080. الـ Service Worker يعمل على `localhost` أو `https` فقط.

## بناء البيانات

```bash
node scripts/build-data.js     # نص المصحف + الأجزاء/الصفحات مع فحوصات آلية (Node 18+)
node scripts/build-extra.js    # الصرف والجذور، التفسير الميسر، التجويد، معاني الكلمات
node scripts/build-reciters.js # قائمة القراء من mp3quran (التي لها توقيت آيات لكل السور)
node scripts/build-mushaf.js   # وضع الصفحات: نص مجمع الملك فهد مرتبًا بالصفحة والسطر (604 × 15)
node scripts/build-adhkar.js   # الأذكار من حصن المسلم (hisnmuslim.com)
node scripts/stamp-sw.js       # تحديث قائمة الكاش ورقم الإصدار في sw.js — شغّله قبل كل نشر
```

المصادر المحمّلة تتخزن في `scripts/.cache/` (خارج git).

### فحوصات النص (build-data.js)
- 114 سورة، 6236 آية، 604 صفحة، 30 جزء، 240 ربع، 15 سجدة.
- عدد آيات كل سورة يطابق Tanzil و Quran.com.
- البسملة تُفصل كعنوان مع تحقق عكسي حرفي، وبصمة sha256 للنص كاملًا تطابق الأصل.

## الهيكل

```
index.html, manifest.webmanifest, sw.js
public/data/      بيانات JSON الثابتة (نص، فهارس، كلمات، تفسير، تجويد، جذور، قراء)
public/fonts/     Amiri Quran + Noto Kufi Arabic
src/main.js       البداية والراوتر
src/data.js       نص المصحف (IndexedDB) والصفحات/الأجزاء
src/audio/        المشغل، Media Session، مؤقت النوم، شريط التشغيل
src/offline/      التنزيل، التنزيل التلقائي، المساحة
src/features/     العلامات، الملاحظات، الختمة، SRS، التجويد/الكلمات، بطاقات المشاركة
src/views/        الشاشات
```

## النشر
أي استضافة ملفات ثابتة (Cloudflare Pages أو GitHub Pages أو Netlify). المجلد الجذر هو مجلد النشر، ولا يحتاج خطوة build.
شغّل `node scripts/stamp-sw.js` قبل كل نشر حتى يتحدث الكاش عند المستخدمين.

## المصادر والتراخيص
- نص المصحف: [Tanzil Project](https://tanzil.net), Uthmani 1.1, CC BY 3.0. النص منقول حرفيًا دون تعديل.
- الصرف والجذور: [Quranic Arabic Corpus](https://corpus.quran.com) v0.4, GNU GPL (نسخة [mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology)).
- التفسير الميسر، ومواضع التجويد، ومعاني الكلمات بالإنجليزية: [Quran.com API](https://quran.com).
- الصوت: [mp3quran.net](https://mp3quran.net) — تلاوة السورة كاملة متصلة مع توقيت كل آية (ayat_timing) لتظليلها. يُحمَّل وقت التشغيل ولا يُضمَّن في المشروع.
- وضع الصفحات: نص مجمع الملك فهد (text_qpc_hafs) وترتيب الأسطر من Quran.com، بخط KFGQPC Uthmanic Script HAFS.
- الأذكار: كتاب «حصن المسلم» عبر hisnmuslim.com.
- مواقيت الصلاة والقبلة: مكتبة [Adhan](https://github.com/batoulapps/adhan-js) (MIT) على الجهاز. التاريخ الهجري بتقويم أم القرى في المتصفح.
- الخطوط: Amiri Quran و Noto Kufi Arabic، رخصة SIL OFL.

> بما أن بيانات الصرف مرخصة GPL، فالأسلم نشر كود المشروع برخصة متوافقة (GPL-3.0).
