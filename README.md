# رتّل — القرآن الكريم (تطبيق ويب PWA)

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
node scripts/build-mushaf-tajweed.js # ألوان التجويد على نص المجمع في وضع الصفحات
node scripts/build-tafsir-trans.js   # تفسير السعدي + ترجمات المعاني (تنزيل)
node scripts/build-radios.js        # الإذاعات: القاهرة والسعودية وإذاعات القراء (بث مباشر)
node scripts/build-seo.js      # صفحات ثابتة للسور (sura/) وsitemap.xml لمحركات البحث (SITE_URL لتغيير الرابط)
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

## الختمة الجماعية (السيرفر)
الميزة الوحيدة التي تحتاج إنترنت. تعمل على مشروع Supabase مجاني بدون حسابات:
- الجداول مقفولة تمامًا (RLS بدون سياسات وصلاحيات مسحوبة)، والتعامل عبر دوال `khatma_*` فقط.
- كل جهاز له معرّف سري محلي يُخزَّن في السيرفر مُجزّأً (sha256)، فلا يعلّم الجزء «تم» أو يتركه إلا صاحبه.
- منشئ الختمة يحصل على مفتاح إدارة للحذف. عند اكتمال الثلاثين جزءًا تبدأ دورة جديدة تلقائيًا.
- كود قاعدة البيانات: `supabase/migrations/20261111_group_khatma.sql`. الرابط والمفتاح العام في `src/features/group.js`.

## الإشعارات (الأذان والورد)
- الاشتراك يُحفظ عبر الدالتين `push_save` / `push_delete` (الموقع مقرّب لـ ٢ رقم عشري ≈ ١ كم).
- `pg_cron` يستدعي الدالة الطرفية `supabase/functions/push-tick` كل ٥ دقائق؛ تحسب المواقيت بمكتبة adhan وترسل بـ web-push.
- مفاتيح VAPID ومفتاح التشغيل محفوظة في Supabase Vault (`vapid_public`, `vapid_private`, `push_tick_key`)، والمفتاح العام نسخة منه في `src/features/push.js`.
- الكود: `supabase/migrations/20261111_push.sql`.

## الإحصائيات
عدّاد يومي مجمّع لكل ميزة (`daily_stats` عبر `stat_hit`)، بلا معرّفات، يرسله كل جهاز مرة في اليوم على الأكثر، ويمكن إيقافه من الإعدادات. للاطلاع: `select * from daily_stats order by day desc;` في محرر SQL.

## إضافة كروم (`extension/`)
آية اليوم، وبحث سريع، واختصارات للتطبيق، وكلمة `quran` في شريط العنوان (مثال: `quran 2:255` أو `quran الكهف`).
- التجربة محليًا: `chrome://extensions` ← تفعيل «وضع المطوّر» ← «تحميل إضافة غير مضغوطة» ← اختر مجلد `extension`.
- النشر: اضغط المجلد إلى zip وارفعه في [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (رسوم تسجيل لمرة واحدة).
- الإضافة لا تجمع أي بيانات ولا تطلب أي صلاحيات.

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
