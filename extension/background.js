// كلمة «quran» في شريط العنوان: quran 2:255 أو quran الكهف أو quran الرحمن الرحيم
import { getData, resolve, ar, normalize } from './common.js';

chrome.omnibox.setDefaultSuggestion({ description: 'افتح في رتّل: رقم آية (٢:٢٥٥)، أو اسم سورة، أو كلمات للبحث' });

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const { surahs } = await getData();
  const q = normalize(text).replace(/^ال/, '');
  if (!q) return suggest([]);
  const list = surahs.filter((s) => normalize(s.nameAr).replace(/^ال/, '').startsWith(q)).slice(0, 5)
    .map((s) => ({ content: String(s.id), description: `سورة ${s.nameAr} (${ar(s.ayahCount)} آية)` }));
  suggest(list);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const { surahs } = await getData();
  const url = resolve(text, surahs);
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
