// أدوات النص العربي: توحيد الحروف وإزالة التشكيل للبحث

// التشكيل وعلامات المصحف والتطويل
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/g;

export function stripDiacritics(s) {
  return s.replace(DIACRITICS, '');
}

/** توحيد للبحث: بدون تشكيل، الألفات → ا، ى → ي، ة → ه، ؤ → و، ئ → ي */
export function normalize(s) {
  return stripDiacritics(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** يحوّل الأرقام العربية-الهندية إلى لاتينية */
export function latinDigits(s) {
  return s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
