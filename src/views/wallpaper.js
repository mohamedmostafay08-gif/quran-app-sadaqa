// خلفيات الموبايل: آية أو ذكر بخط المصحف، بمقاس شاشة الجهاز، مع ترك مساحة الساعة أعلى الشاشة
import { h, icon, ar } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { mount, topbar, toast } from '../ui.js';
import { getSelections } from './duas.js';
import { dayIndex } from './library.js';

const STYLES = [
  { id: 'night', name: 'ليلي', bg: ['#0e1a2b', '#1c2f4a'], ink: '#f3dfa2', sub: '#c9d4e3' },
  { id: 'green', name: 'أخضر', bg: ['#08392d', '#0f6b53'], ink: '#f6e3a8', sub: '#d6efe5' },
  { id: 'sand', name: 'رملي', bg: ['#f7efdc', '#e8d6ad'], ink: '#4a3410', sub: '#6d5a36' },
  { id: 'black', name: 'أسود', bg: ['#000000', '#141414'], ink: '#ffffff', sub: '#a5a5a5' },
];
const DHIKR = ['سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ'];

function lines(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}

async function render({ text, ref, style }) {
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 2)); // صورة حادة حتى على الشاشات العادية
  const W = Math.round(Math.min(1440, (screen.width || 390) * dpr)), H = Math.round(Math.min(3200, (screen.height || 844) * dpr));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  await document.fonts.load(`${Math.round(W / 12)}px "Amiri Quran"`, text).catch(() => {});
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, style.bg[0]); g.addColorStop(1, style.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  // الخط يصغر حتى يتسع النص في النصف السفلي (أعلى الشاشة متروك للساعة)
  let size = Math.round(W / 8), ls;
  for (; size > W / 26; size -= 4) { ctx.font = `${size}px "Amiri Quran", serif`; ls = lines(ctx, text, W * 0.8); if (ls.length * size * 1.9 < H * 0.42) break; }
  const lh = size * 1.9, top = H * 0.5 - (ls.length * lh) / 2 + H * 0.06;
  ctx.fillStyle = style.ink;
  ls.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
  if (ref) { ctx.fillStyle = style.sub; ctx.font = `600 ${Math.round(W / 30)}px "IBM Plex Sans Arabic", sans-serif`; ctx.fillText(ref, W / 2, top + ls.length * lh + W / 24); }
  return c;
}

export async function renderWallpaper(_p, query = {}) {
  let text, ref;
  if (query.s && query.a) {
    const s = +query.s, a = +query.a;
    text = `﴿${(await getSurahText(s))[a - 1]}﴾`; ref = `سورة ${getSurahMeta(s).nameAr} ${ar(a)}`;
  } else {
    try {
      const sel = await getSelections();
      const [s, a] = sel.dailyAyahs[dayIndex(sel.dailyAyahs.length)].split(':').map(Number);
      text = `﴿${(await getSurahText(s))[a - 1]}﴾`; ref = `سورة ${getSurahMeta(s).nameAr} ${ar(a)}`;
    } catch { text = DHIKR[0]; ref = ''; }
  }
  let style = STYLES[0], canvas;
  const preview = h('div.wp-preview');
  const draw = async () => { canvas = await render({ text, ref, style }); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'معاينة الخلفية'); preview.replaceChildren(canvas); };
  const styles = h('div.notify-chips', STYLES.map((x) => h('button.pb-chip', { type: 'button', 'aria-pressed': String(x === style), onclick: (e) => { style = x; for (const b of styles.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); draw(); } }, x.name)));
  const dhikr = h('div.notify-chips', DHIKR.map((d) => h('button.pb-chip.wp-dhikr', { type: 'button', onclick: () => { text = d; ref = ''; draw(); } }, d.split('،')[0])));
  const save = async () => {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'rattil-wallpaper.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل الخلفية');
  };
  mount(h('div.wallpaper-page',
    topbar({ title: 'خلفية للموبايل', back: '#/more' }),
    h('div.gr-layout',
      preview,
      h('section.card.form',
        h('div.field', h('span', 'اللون'), styles),
        h('div.field', h('span', 'أو اختر ذكرًا'), dhikr),
        h('p.small-note', 'لاختيار آية أخرى: اضغط على أي آية في المصحف ← «خلفية للموبايل».'),
        h('button.btn.block', { type: 'button', onclick: save }, icon('download'), 'حفظ الخلفية'),
        h('p.small-note', 'بعد الحفظ: افتح الصورة من المعرض واختر «تعيين كخلفية».'))),
  ));
  draw();
}
