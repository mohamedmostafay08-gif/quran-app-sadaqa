// تطبيق الثيم قبل الرسم لتجنب الوميض (ملف منفصل حتى تسمح به سياسة أمان المحتوى)
try {
  var s = JSON.parse(localStorage.getItem('qa:boot') || '{}');
  if (s.theme) document.documentElement.dataset.theme = s.theme;
  if (s.variant) document.documentElement.dataset.variant = s.variant;
  if (s.fontScale) document.documentElement.style.setProperty('--quran-scale', s.fontScale);
} catch (e) {}
