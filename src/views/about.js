// عن التطبيق: المصادر والإصدارات والحقوق
import { h } from '../lib/dom.js';
import { getNotice } from '../data.js';
import { mount, topbar } from '../ui.js';

export const APP_VERSION = '1.0.0';

export function renderAbout() {
  const n = getNotice() || {};
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  mount(h('div.about',
    topbar({ title: 'عن التطبيق', back: '#/settings' }),
    h('section.card',
      h('h2', 'القرآن الكريم'),
      h('p', 'تطبيق ويب مجاني يعمل بدون إنترنت بعد أول فتح. كل بياناتك (العلامات والإعدادات والتنزيلات) محفوظة على جهازك فقط، ولا يوجد حسابات ولا تتبع.'),
      h('p.muted', `إصدار التطبيق ${APP_VERSION}`),
    ),
    h('section.card',
      h('h2', 'المصادر'),
      h('dl.sources',
        h('dt', 'نص المصحف'),
        h('dd', link('https://tanzil.net', 'مشروع تنزيل (Tanzil)'), ` — النص العثماني ${n.version ? `(${n.version})` : ''}، رخصة المشاع الإبداعي CC BY 3.0. النص منقول حرفيًا دون أي تعديل.`,
          n.sha256 ? h('code.hash', { dir: 'ltr' }, `sha256: ${n.sha256}`) : null),
        h('dt', 'وضع الصفحات (مصحف المدينة)'),
        h('dd', 'نص مجمع الملك فهد لطباعة المصحف الشريف وخط KFGQPC Uthmanic Script HAFS، مع ترتيب الأسطر والصفحات، عبر ', link('https://quran.com', 'Quran.com'), '.'),
        h('dt', 'بيانات الأجزاء والصفحات'),
        h('dd', link('https://tanzil.net/docs/quran_metadata', 'Tanzil Quran Metadata'), ' — ترقيم مصحف المدينة (٦٠٤ صفحات).'),
        h('dt', 'الصرف والجذور'),
        h('dd', link('https://corpus.quran.com', 'Quranic Arabic Corpus'), ' v0.4 (رخصة GNU GPL) بنسخة ', link('https://github.com/mustafa0x/quran-morphology', 'quran-morphology'), ' المصححة.'),
        h('dt', 'التفسير الميسر'),
        h('dd', 'مجمع الملك فهد لطباعة المصحف الشريف، عبر ', link('https://quran.com', 'Quran.com'), '.'),
        h('dt', 'أحكام التجويد ومعاني الكلمات (إنجليزي)'),
        h('dd', link('https://quran.com', 'Quran.com'), ' API — مواضع الأحكام تُنقل على نص Tanzil بالمحاذاة دون تغيير أي حرف.'),
        h('dt', 'التلاوات'),
        h('dd', link('https://mp3quran.net', 'mp3quran.net'), ' — تلاوة السورة كاملة متصلة، مع توقيت كل آية لتظليلها.'),
        h('dt', 'أسماء السور بالإنجليزية'),
        h('dd', link('https://quran.com', 'Quran.com'), ' API.'),
        h('dt', 'الأذكار'),
        h('dd', 'كتاب «حصن المسلم» لسعيد بن علي بن وهف القحطاني، عبر ', link('https://www.hisnmuslim.com', 'hisnmuslim.com'), '.'),
        h('dt', 'مواقيت الصلاة والقبلة'),
        h('dd', 'تُحسب على جهازك بمكتبة ', link('https://github.com/batoulapps/adhan-js', 'Adhan'), ' (رخصة MIT). التاريخ الهجري بتقويم أم القرى المدمج في المتصفح.'),
        h('dt', 'الخطوط'),
        h('dd', 'Amiri Quran و Noto Kufi Arabic — رخصة SIL Open Font License.'),
      ),
    ),
    h('section.card',
      h('h2', 'تنبيه'),
      h('p', 'بُذل الجهد في التحقق الآلي من النص (عدد السور والآيات وبصمة النص مقارنة بالمصدر). إن لاحظت أي خطأ فنرجو إبلاغنا فورًا.'),
    ),
  ));
}
