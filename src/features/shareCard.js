// بطاقات مشاركة الآية صورةً (Canvas): ثلاثة مقاسات (منشور، مربع، ستوري)، وأربع خلفيات،
// وإطار مزخرف واسم السورة، ومع التفسير الميسر اختياريًا — مشاركة أو تنزيل PNG
import { h, ar, icon } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { sheet, toast } from '../ui.js';
import { getTafsir } from './extra.js';

export const CARD_THEMES = [
  { id: 'emerald', name: 'زمردي', bg: ['#0b3d33', '#14705c'], text: '#fdf8ec', sub: 'rgba(253,248,236,.82)', accent: '#e9c46a', pattern: 'rgba(233,196,106,.10)' },
  { id: 'night', name: 'ليلي', bg: ['#0d1321', '#1d2d50'], text: '#eef2ff', sub: 'rgba(238,242,255,.8)', accent: '#9fb8ff', pattern: 'rgba(159,184,255,.10)' },
  { id: 'paper', name: 'ورقي', bg: ['#f7efdc', '#eadcb8'], text: '#3b2c17', sub: 'rgba(59,44,23,.78)', accent: '#8f5f12', pattern: 'rgba(143,95,18,.10)' },
  { id: 'dawn', name: 'فجر', bg: ['#40234f', '#c2655a'], text: '#fff6ef', sub: 'rgba(255,246,239,.82)', accent: '#ffd6a0', pattern: 'rgba(255,214,160,.12)' },
];

// [المعرّف، الاسم، العرض، الارتفاع، أقصى أسطر للتفسير]
export const CARD_SIZES = [['post', 'منشور', 1080, 1350, 6], ['square', 'مربع', 1080, 1080, 4], ['story', 'ستوري', 1080, 1920, 10]];
const PAD = 110;

function drawPattern(ctx, color, W, H) {
  // نجوم ثمانية هندسية خفيفة
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const step = 180;
  for (let y = -step / 2; y < H + step; y += step) {
    for (let x = -step / 2; x < W + step; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2);
      ctx.save();
      ctx.translate(x + ox, y);
      for (const rot of [0, Math.PI / 4]) { ctx.save(); ctx.rotate(rot); ctx.strokeRect(-28, -28, 56, 56); ctx.restore(); }
      ctx.restore();
    }
  }
  ctx.restore();
}

/** نجمة ثمانية صغيرة (زخرفة الأركان والفواصل) */
function star(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (const rot of [0, Math.PI / 4]) { ctx.save(); ctx.rotate(rot); ctx.fillRect(-r / 2, -r / 2, r, r); ctx.restore(); }
  ctx.restore();
}

/** إطار مزدوج مع نجمة في كل ركن */
function drawFrame(ctx, W, H, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6; ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
  ctx.strokeRect(64, 64, W - 128, H - 128);
  ctx.globalAlpha = 0.9;
  for (const [x, y] of [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]]) star(ctx, x, y, 22, color);
  ctx.restore();
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** يقصّ الأسطر إلى حدٍّ أقصى ويختم بعلامة حذف */
function clampLines(ctx, lines, max, maxW) {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  let last = out[max - 1];
  while (last && ctx.measureText(last + ' …').width > maxW) last = last.split(' ').slice(0, -1).join(' ');
  out[max - 1] = last + ' …';
  return out;
}

export async function renderCard({ text, ref, theme, size = CARD_SIZES[0], surahName, tafsir }) {
  const [, , W, H, tafsirMax] = size;
  await document.fonts.load('60px "Amiri Quran"', 'بسم').catch(() => {});
  await document.fonts.load('600 30px "IBM Plex Sans Arabic"', 'سورة').catch(() => {});
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, theme.pattern, W, H);
  drawFrame(ctx, W, H, theme.accent);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  const maxW = W - PAD * 2;

  // رأس البطاقة: اسم السورة بين فاصلين
  const headY = H > W ? 210 : 170;
  if (surahName) {
    ctx.fillStyle = theme.accent;
    ctx.font = '52px "Amiri Quran", serif';
    ctx.fillText(`سورة ${surahName}`, W / 2, headY);
    const tw = ctx.measureText(`سورة ${surahName}`).width;
    ctx.fillRect(W / 2 - tw / 2 - 150, headY - 16, 110, 2);
    ctx.fillRect(W / 2 + tw / 2 + 40, headY - 16, 110, 2);
    star(ctx, W / 2 - tw / 2 - 30, headY - 15, 12, theme.accent);
    star(ctx, W / 2 + tw / 2 + 30, headY - 15, 12, theme.accent);
  }

  // التفسير (اختياري) أسفل الآية، بخط أصغر وعدد أسطر محدود لكل مقاس
  let tLines = [], tLh = 0;
  if (tafsir) {
    ctx.font = '400 30px "IBM Plex Sans Arabic", sans-serif';
    tLh = 30 * 1.75;
    tLines = clampLines(ctx, wrap(ctx, tafsir, maxW - 40), tafsirMax, maxW - 40);
  }
  const top = headY + 70, bottom = H - 230;
  const tafsirH = tLines.length ? tLines.length * tLh + 90 : 0;

  // أكبر خط يسمح بوضع الآية كلها في المساحة الباقية
  let fs = 68, lines, lh;
  const maxH = bottom - top - tafsirH;
  for (; fs >= 24; fs -= 2) {
    ctx.font = `${fs}px "Amiri Quran", serif`;
    lines = wrap(ctx, `﴿${text}﴾`, maxW);
    lh = fs * 2.05;
    if (lines.length * lh <= maxH) break;
  }
  const blockH = lines.length * lh + tafsirH;
  let y = top + (bottom - top - blockH) / 2 + lh * 0.65;
  ctx.fillStyle = theme.text;
  for (const l of lines) { ctx.fillText(l, W / 2, y); y += lh; }

  if (tLines.length) {
    y += 10;
    star(ctx, W / 2, y, 14, theme.accent);
    y += 60;
    ctx.fillStyle = theme.sub;
    ctx.font = '400 30px "IBM Plex Sans Arabic", sans-serif';
    for (const l of tLines) { ctx.fillText(l, W / 2, y); y += tLh; }
  }

  ctx.fillStyle = theme.accent;
  ctx.font = '600 34px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(ref, W / 2, H - 165);
  ctx.globalAlpha = 0.7;
  ctx.font = '400 24px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(tafsir ? '۞ رتّل — القرآن الكريم · التفسير الميسر' : '۞ رتّل — القرآن الكريم', W / 2, H - 108);
  ctx.globalAlpha = 1;
  return c;
}

const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };

export async function shareCardSheet(n, a) {
  const m = getSurahMeta(n);
  const text = (await getSurahText(n))[a - 1];
  const ref = `سورة ${m.nameAr}، الآية ${ar(a)}`;
  let theme = CARD_THEMES.find((t) => t.id === pref('qa:cardTheme')) || CARD_THEMES[0];
  let size = CARD_SIZES.find((s) => s[0] === pref('qa:cardSize')) || CARD_SIZES[0];
  let withTafsir = false, tafsir = null;
  const preview = h('div.card-preview');
  let canvas, seq = 0;
  const draw = async () => {
    const my = ++seq;
    const c = await renderCard({ text, ref, theme, size, surahName: m.nameAr, tafsir: withTafsir ? tafsir : null });
    if (my !== seq) return;
    canvas = c;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `بطاقة: ${ref}`);
    preview.replaceChildren(canvas);
  };
  const radios = (label, items, isOn, pick) => {
    const g = h('div.seg', { role: 'radiogroup', 'aria-label': label }, items.map((x) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(isOn(x)),
      onclick: (e) => { pick(x); for (const b of g.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
    }, x[1])));
    return g;
  };
  const sizes = radios('المقاس', CARD_SIZES, (s) => s === size, (s) => { size = s; setPref('qa:cardSize', s[0]); });
  const themes = h('div.swatches', { role: 'radiogroup', 'aria-label': 'الخلفية' }, CARD_THEMES.map((t) => h('button.swatch', {
    type: 'button', role: 'radio', 'aria-checked': String(t === theme), 'aria-label': t.name, title: t.name,
    style: { background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})` },
    onclick: (e) => { theme = t; setPref('qa:cardTheme', t.id); for (const b of themes.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
  })));
  const tafsirToggle = h('input', { type: 'checkbox', role: 'switch' });
  tafsirToggle.addEventListener('change', async () => {
    withTafsir = tafsirToggle.checked;
    if (withTafsir && tafsir == null) {
      try { tafsir = (await getTafsir(n, a)).text || ''; } catch { tafsir = ''; }
      if (!tafsir) { withTafsir = false; tafsirToggle.checked = false; toast('التفسير غير متاح بدون إنترنت'); return; }
    }
    draw();
  });
  const share = async () => {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const name = `quran-${n}-${a}${size[0] === 'post' ? '' : '-' + size[0]}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: ref }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل الصورة');
  };
  sheet({
    title: 'بطاقة مشاركة',
    content: () => h('div.form', preview,
      h('div.field', h('span', 'المقاس'), sizes),
      h('div.field', h('span', 'الخلفية'), themes),
      h('label.toggle', h('span', h('strong', 'مع التفسير الميسر'), h('small', 'معنى الآية تحتها بخط أصغر')), tafsirToggle),
      h('button.btn.block', { type: 'button', onclick: share }, icon('share'), navigator.canShare ? 'مشاركة الصورة' : 'تنزيل الصورة')),
  });
  draw();
}
