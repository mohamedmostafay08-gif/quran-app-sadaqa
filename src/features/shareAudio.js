// مشاركة مقطع صوتي لآية: نقتطع من ملف السورة الكامل الجزء الخاص بالآية فقط (طلب Range)
// بدل تنزيل السورة كلها. ملفات MP3 تتكوّن من إطارات مستقلة، فأي مقطع منها يعمل في المشغّلات.
import { h, ar } from '../lib/dom.js';
import { sheet, toast } from '../ui.js';
import * as settings from '../state.js';
import { getReciter, getTimings, surahUrl, timedFallback } from '../audio/player.js';
import { getSurahMeta } from '../data.js';
import { AUDIO_CACHE } from '../offline/storage.js';

const PAD = 0.25; // ثانية قبل وبعد الآية

/** مدة الملف بالثواني من بيانات الصوت (بدون تنزيله) */
function durationOf(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = 'metadata';
    const done = () => { const d = a.duration; a.removeAttribute('src'); a.load(); isFinite(d) && d > 0 ? resolve(d) : reject(new Error('duration')); };
    a.addEventListener('loadedmetadata', done, { once: true });
    a.addEventListener('error', () => reject(new Error('audio')), { once: true });
    a.src = url;
  });
}

/** يرجع ملف MP3 لآية (أو نطاق آيات) */
export async function ayahClip(s, from, to = from, reciterId = settings.get('reciter')) {
  const rid = timedFallback(reciterId);
  const url = surahUrl(rid, s);
  const t = await getTimings(rid, s);
  const t0 = Math.max(0, t[from][0] - PAD), t1 = t[to][1] + PAD;

  // لو السورة منزّلة: نقتطع من النسخة المحلية
  let blob = null;
  if ('caches' in self) {
    const cached = await (await caches.open(AUDIO_CACHE)).match(url);
    if (cached) blob = await cached.blob();
  }
  const duration = await durationOf(blob ? URL.createObjectURL(blob) : url);
  let part;
  if (blob) {
    part = blob.slice(Math.floor(blob.size * t0 / duration), Math.ceil(blob.size * Math.min(1, t1 / duration)), 'audio/mpeg');
  } else {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const total = +((probe.headers.get('Content-Range') || '').split('/')[1] || 0);
    if (!total) throw new Error('range');
    const b0 = Math.floor(total * t0 / duration), b1 = Math.min(total - 1, Math.ceil(total * t1 / duration));
    const res = await fetch(url, { headers: { Range: `bytes=${b0}-${b1}` } });
    if (res.status !== 206) throw new Error('range ' + res.status);
    part = await res.blob();
  }
  const name = `rattil-${s}-${from}${to !== from ? '-' + to : ''}.mp3`;
  return { file: new File([part], name, { type: 'audio/mpeg' }), reciter: getReciter(rid), fellBack: rid !== reciterId, seconds: t1 - t0 };
}

export function shareAudioSheet(s, a) {
  const meta = getSurahMeta(s);
  const ref = `سورة ${meta.nameAr}، الآية ${ar(a)}`;
  const body = h('div.share-audio', h('div.spinner', { 'aria-label': 'جارٍ تجهيز المقطع' }), h('p.muted', 'جارٍ تجهيز المقطع…'));
  sheet({ title: 'مقطع صوتي من الآية', content: () => body });
  ayahClip(s, a).then(({ file, reciter, fellBack, seconds }) => {
    const url = URL.createObjectURL(file);
    const text = `${ref} — بصوت ${reciter.nameAr}\nمن تطبيق «رتّل»: ${location.origin}${location.pathname}#/surah/${s}/${a}`;
    const canShare = navigator.canShare?.({ files: [file] });
    body.replaceChildren(...[
      h('p', h('strong', ref), h('br'), h('small.muted', `بصوت ${reciter.nameAr}، ${ar(Math.round(seconds))} ثانية، ${ar((file.size / 1048576).toFixed(1))} م.ب`)),
      fellBack ? h('p.small-note', 'القارئ المختار بلا توقيت للآيات، فاستخدمنا صوتًا آخر.') : null,
      h('audio', { controls: true, src: url, preload: 'auto', style: 'width:100%' }),
      h('div.btn-row',
        canShare ? h('button.btn', { type: 'button', onclick: () => navigator.share({ files: [file], title: ref, text }).catch(() => {}) }, 'مشاركة') : null,
        h('a.btn' + (canShare ? '.ghost' : ''), { href: url, download: file.name }, 'تنزيل الملف'),
      ),
    ].filter(Boolean));
  }).catch(() => {
    body.replaceChildren(h('p.muted', navigator.onLine ? 'تعذر تجهيز المقطع لهذا القارئ. جرّب قارئًا آخر.' : 'تجهيز المقطع يحتاج اتصالًا، أو أن تكون السورة منزّلة.'));
    toast('تعذر تجهيز المقطع');
  });
}
