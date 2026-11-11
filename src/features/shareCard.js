// بطاقات مشاركة: صورة للآية بخلفيات جميلة (Canvas) — مشاركة أو تنزيل PNG
import { h, ar, icon } from '../lib/dom.js';
import { getSurahMeta, getSurahText } from '../data.js';
import { sheet, toast } from '../ui.js';

export const CARD_THEMES = [
  { id: 'emerald', name: 'زمردي', bg: ['#0b3d33', '#14705c'], text: '#fdf8ec', accent: '#e9c46a', pattern: 'rgba(233,196,106,.10)' },
  { id: 'night', name: 'ليلي', bg: ['#0d1321', '#1d2d50'], text: '#eef2ff', accent: '#9fb8ff', pattern: 'rgba(159,184,255,.10)' },
  { id: 'paper', name: 'ورقي', bg: ['#f7efdc', '#eadcb8'], text: '#3b2c17', accent: '#8f5f12', pattern: 'rgba(143,95,18,.10)' },
  { id: 'dawn', name: 'فجر', bg: ['#40234f', '#c2655a'], text: '#fff6ef', accent: '#ffd6a0', pattern: 'rgba(255,214,160,.12)' },
];

const W = 1080, H = 1350, PAD = 110;

function drawPattern(ctx, color) {
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
      for (const rot of [0, Math.PI / 4]) {
        ctx.save(); ctx.rotate(rot); ctx.strokeRect(-28, -28, 56, 56); ctx.restore();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
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

export async function renderCard({ text, ref, theme }) {
  await document.fonts.load('60px "Amiri Quran"', 'بسم').catch(() => {});
  await document.fonts.load('600 30px "Noto Kufi Arabic"', 'سورة').catch(() => {});
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, theme.pattern);

  // إطار
  ctx.strokeStyle = theme.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, W - 100, H - 100);
  ctx.globalAlpha = 1;

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.text;

  // أكبر خط يسمح بوضع الآية كلها
  let size = 68, lines, lh;
  const maxH = H - PAD * 2 - 220;
  for (; size >= 26; size -= 2) {
    ctx.font = `${size}px "Amiri Quran", serif`;
    lines = wrap(ctx, `﴿${text}﴾`, W - PAD * 2);
    lh = size * 2.05;
    if (lines.length * lh <= maxH) break;
  }
  const blockH = lines.length * lh;
  let y = (H - blockH) / 2 + lh * 0.6 - 40;
  for (const l of lines) { ctx.fillText(l, W / 2, y); y += lh; }

  ctx.fillStyle = theme.accent;
  ctx.font = '600 34px "Noto Kufi Arabic", sans-serif';
  ctx.fillText(ref, W / 2, H - 170);
  ctx.globalAlpha = 0.7;
  ctx.font = '400 24px "Noto Kufi Arabic", sans-serif';
  ctx.fillText('۞ رتّل — القرآن الكريم', W / 2, H - 110);
  ctx.globalAlpha = 1;
  return c;
}

export async function shareCardSheet(n, a) {
  const m = getSurahMeta(n);
  const text = (await getSurahText(n))[a - 1];
  const ref = `سورة ${m.nameAr}، الآية ${ar(a)}`;
  let theme = CARD_THEMES[0];
  const preview = h('div.card-preview');
  let canvas;
  const draw = async () => {
    canvas = await renderCard({ text, ref, theme });
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `بطاقة: ${ref}`);
    preview.replaceChildren(canvas);
  };
  const themes = h('div.swatches', { role: 'radiogroup', 'aria-label': 'الخلفية' }, CARD_THEMES.map((t) => h('button.swatch', {
    type: 'button', role: 'radio', 'aria-checked': String(t === theme), 'aria-label': t.name, title: t.name,
    style: { background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})` },
    onclick: (e) => { theme = t; for (const b of themes.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); draw(); },
  })));
  const filename = `quran-${n}-${a}.png`;
  const share = async () => {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: ref }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل الصورة');
  };
  sheet({
    title: 'بطاقة مشاركة',
    content: () => h('div.form', preview, h('div.field', h('span', 'الخلفية'), themes),
      h('button.btn.block', { type: 'button', onclick: share }, icon('share'), navigator.canShare ? 'مشاركة الصورة' : 'تنزيل الصورة')),
  });
  draw();
}
