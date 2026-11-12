// عن التطبيق: المصادر والإصدارات والحقوق
import { h } from '../lib/dom.js';
import { mount, topbar } from '../ui.js';

export const APP_VERSION = '1.0.0';

export function renderAbout() {
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  const src = (title, ...body) => [h('dt', title), h('dd', ...body)];
  mount(h('div.about',
    topbar({ title: 'عن التطبيق', back: '#/more' }),
    h('section.card',
      h('h2', 'رتّل — القرآن الكريم'),
      h('p', 'تطبيق مجاني لقراءة القرآن الكريم والاستماع إليه، مع مواقيت الصلاة والأذان والأذكار ومكتبة من الأحاديث الصحيحة وسير الصحابة. يعمل بدون إنترنت، وبياناتك محفوظة على جهازك فقط.'),
      h('p', 'إن لاحظت أي خطأ فنرجو إبلاغنا.'),
    ),
    h('section.card.credit-card',
      h('h2', 'التواصل والدعم'),
      h('p.credit-by', { dir: 'ltr' }, 'Powered by ', h('strong', 'Mohamed Mostafa')),
      h('p.credit-phone', { dir: 'ltr' }, '01120339097'),
      h('div.btn-row.credit-actions',
        h('a.btn', { href: 'https://wa.me/201120339097', target: '_blank', rel: 'noopener' }, 'واتساب'),
        h('a.btn.ghost', { href: 'tel:+201120339097' }, 'اتصال')),
    ),
    // ذكر المصادر واجب بشروط تراخيصها، فيبقى مطويًا في آخر الصفحة
    h('details.card.sources-fold',
      h('summary', 'المصادر'),
      h('dl.sources',
        ...src('نص المصحف', link('https://tanzil.net', 'مشروع تنزيل'), ' (CC BY 3.0)، ومصحف المدينة من مجمع الملك فهد عبر ', link('https://quran.com', 'Quran.com'), '.'),
        ...src('التفسير والترجمات', 'التفسير الميسر وتفسير السعدي عبر ', link('https://quran.com', 'Quran.com'), '، وترجمات المعاني من ', link('https://tanzil.net/trans/', 'تنزيل'), '.'),
        ...src('الصرف والجذور', link('https://corpus.quran.com', 'Quranic Arabic Corpus'), ' (GNU GPL).'),
        ...src('التلاوات والإذاعات', link('https://mp3quran.net', 'mp3quran.net'), '، وإذاعتا القاهرة والسعودية.'),
        ...src('الأذان', 'الأذان المصري (الشيخ محمد رفعت) وأذان الحرم من ', link('https://archive.org', 'أرشيف الإنترنت'), '، والأذان الهادئ من ', link('https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg', 'ويكيميديا كومنز'), '.'),
        ...src('المكتبة', link('https://hadeethenc.com', 'موسوعة الأحاديث النبوية'), '، وسير الصحابة من ', link('https://ar.wikipedia.org', 'ويكيبيديا'), ' (CC BY-SA 4.0).'),
        ...src('الأذكار', '«حصن المسلم» عبر ', link('https://www.hisnmuslim.com', 'hisnmuslim.com'), '.'),
        ...src('مواقيت الصلاة', link('https://github.com/batoulapps/adhan-js', 'Adhan'), ' (MIT).'),
        ...src('الخطوط', 'Amiri Quran و Noto Kufi Arabic (SIL OFL).'),
      ),
    ),
  ));
}
