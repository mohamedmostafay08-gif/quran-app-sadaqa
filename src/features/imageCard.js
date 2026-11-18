// بطاقة صورة عامة للمشاركة (حديث اليوم، مواقيت الصلاة، الإنجازات) بمقاس ستوري ١٠٨٠×١٣٥٠
import { toast } from '../ui.js';

export const THEMES = {
  green: { bg: ['#0b5a46', '#13866a'], ink: '#f6e3a8', text: '#ffffff' },
  night: { bg: ['#231d4f', '#4a3a8c'], ink: '#f6d982', text: '#ffffff' },
  sand: { bg: ['#fbf6ea', '#f1e5c8'], ink: '#8a6a1f', text: '#1d2a24' },
};

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** يرسم البطاقة: { eyebrow, title, body, rows: [[الاسم، القيمة]], footer, theme, emoji } */
export async function renderImageCard({ eyebrow, title, body, rows, footer, theme = 'green', emoji }) {
  const W = 1080, H = 1350, th = THEMES[theme] || THEMES.green;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  await Promise.all([document.fonts.load('600 40px "IBM Plex Sans Arabic"', 'رتّل'), document.fonts.load('60px "Amiri Quran"', 'رتّل')]).catch(() => {});
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.strokeRect(50, 50, W - 100, H - 100); ctx.globalAlpha = 1;
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  let y = 190;
  if (emoji) { ctx.font = '120px sans-serif'; ctx.fillText(emoji, W / 2, y + 40); y += 170; }
  if (eyebrow) { ctx.fillStyle = th.ink; ctx.font = '600 40px "IBM Plex Sans Arabic", sans-serif'; ctx.fillText(eyebrow, W / 2, y); y += 90; }
  if (title) {
    ctx.fillStyle = th.text; ctx.font = '700 64px "IBM Plex Sans Arabic", sans-serif';
    for (const l of wrapLines(ctx, title, W - 220)) { ctx.fillText(l, W / 2, y); y += 86; }
    y += 20;
  }
  if (body) {
    ctx.fillStyle = th.text; ctx.font = '500 44px "IBM Plex Sans Arabic", sans-serif';
    let lines = wrapLines(ctx, body, W - 220);
    const max = rows ? 4 : 12;
    if (lines.length > max) lines = [...lines.slice(0, max - 1), lines[max - 1] + ' …'];
    for (const l of lines) { ctx.fillText(l, W / 2, y); y += 70; }
    y += 30;
  }
  if (rows) {
    const rowH = 104, x0 = 150, x1 = W - 150;
    for (const [label, value, hl] of rows) {
      ctx.globalAlpha = hl ? 0.22 : 0.1; ctx.fillStyle = th.text; ctx.fillRect(x0 - 20, y - 66, x1 - x0 + 40, rowH - 14); ctx.globalAlpha = 1;
      ctx.fillStyle = th.text; ctx.font = '600 50px "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right'; ctx.fillText(label, x1, y);
      ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.fillText(value, x0, y);
      ctx.textAlign = 'center'; y += rowH;
    }
  }
  ctx.fillStyle = th.text; ctx.globalAlpha = 0.75; ctx.font = '400 32px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(footer || 'رتّل — القرآن الكريم', W / 2, H - 100); ctx.globalAlpha = 1;
  return c;
}

/** مشاركة البطاقة صورة (أو تنزيلها إن لم تدعم المشاركة) */
export async function shareImageCard(opts, filename = 'rattil.png') {
  const canvas = await renderImageCard(opts);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: opts.title || '' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تنزيل الصورة');
}
