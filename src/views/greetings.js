// بطاقات التهنئة: رمضان والعيدين والجمعة والعام الهجري، باسم المرسل، تُشارك صورة على واتساب
import { h, icon } from '../lib/dom.js';
import { mount, topbar, toast } from '../ui.js';

const CARDS = [
  { id: 'ramadan', name: 'رمضان', title: 'رمضان كريم', sub: 'أعاده الله عليكم بالخير واليُمن والبركات', bg: ['#231d4f', '#4a3a8c'], ink: '#f6d982' },
  { id: 'fitr', name: 'عيد الفطر', title: 'عيد فطر مبارك', sub: 'تقبّل الله منا ومنكم صالح الأعمال', bg: ['#0b5a46', '#13866a'], ink: '#f6e3a8' },
  { id: 'adha', name: 'عيد الأضحى', title: 'عيد أضحى مبارك', sub: 'تقبّل الله منا ومنكم، وكل عام وأنتم بخير', bg: ['#5a2a12', '#9a4d1f'], ink: '#fbe2b6' },
  { id: 'jumuah', name: 'الجمعة', title: 'جمعة طيبة', sub: 'لا تنسوا سورة الكهف، والصلاة على النبي ﷺ', bg: ['#0f3d5c', '#1d6a8f'], ink: '#d9eefa' },
  { id: 'hijri', name: 'العام الهجري', title: 'عام هجري سعيد', sub: 'جعله الله عام خير وطاعة وبركة', bg: ['#2f3a1c', '#5b6f2e'], ink: '#efe8b8' },
];

/** نجمة ثمانية (زخرفة إسلامية بسيطة) */
function star8(ctx, x, y, r, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (const rot of [0, Math.PI / 4]) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const t = rot + (i * Math.PI) / 2; const px = x + r * Math.cos(t), py = y + r * Math.sin(t); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

async function render(card, from) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  await Promise.all([document.fonts.load('80px "Amiri Quran"', 'رمضان'), document.fonts.load('600 40px "IBM Plex Sans Arabic"', 'تهنئة')]).catch(() => {});
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, card.bg[0]); g.addColorStop(1, card.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // زخارف
  for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) star8(ctx, 90 + i * 180, 100 + j * 190, 46, card.ink, 0.08);
  ctx.strokeStyle = card.ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; ctx.strokeRect(50, 50, W - 100, H - 100);
  ctx.globalAlpha = 0.3; ctx.strokeRect(66, 66, W - 132, H - 132); ctx.globalAlpha = 1;
  star8(ctx, W / 2, 330, 90, card.ink, 0.9);
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.fillStyle = card.ink;
  ctx.font = '150px "Amiri Quran", serif'; ctx.fillText(card.title, W / 2, 640);
  ctx.fillStyle = '#ffffff'; ctx.font = '500 46px "IBM Plex Sans Arabic", sans-serif';
  wrap(ctx, card.sub, W / 2, 780, W - 240, 72);
  if (from) { ctx.fillStyle = card.ink; ctx.font = '600 44px "IBM Plex Sans Arabic", sans-serif'; ctx.fillText(`مع تحيات: ${from}`, W / 2, 1060); }
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.font = '400 30px "IBM Plex Sans Arabic", sans-serif'; ctx.fillText('رتّل — القرآن الكريم', W / 2, H - 110); ctx.globalAlpha = 1;
  return c;
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

export function renderGreetings() {
  let card = CARDS[0];
  let canvas = null;
  const preview = h('div.card-preview.gr-preview');
  const name = h('input.note-input', { type: 'text', maxlength: '40', placeholder: 'اسمك (يظهر على البطاقة)', 'aria-label': 'اسم المرسل' });
  try { name.value = localStorage.getItem('qa:greetName') || ''; } catch { /* */ }
  let t = 0;
  const draw = async () => { canvas = await render(card, name.value.trim()); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', card.title); preview.replaceChildren(canvas); };
  name.addEventListener('input', () => { try { localStorage.setItem('qa:greetName', name.value.trim()); } catch { /* */ } clearTimeout(t); t = setTimeout(draw, 250); });
  const chips = h('div.notify-chips', CARDS.map((x) => h('button.pb-chip', { type: 'button', 'aria-pressed': String(x === card), onclick: (e) => { card = x; for (const b of chips.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); draw(); } }, x.name)));
  const share = async () => {
    if (!canvas) return;
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], `tahniah-${card.id}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: card.title }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل البطاقة');
  };
  mount(h('div.greet-page',
    topbar({ title: 'بطاقات التهنئة', back: '#/more' }),
    h('div.gr-layout',
      preview,
      h('section.card.form',
        h('div.field', h('span', 'المناسبة'), chips),
        h('label.field', h('span', 'من'), name),
        h('button.btn.block', { type: 'button', onclick: share }, icon('share'), navigator.canShare ? 'مشاركة البطاقة' : 'تنزيل البطاقة'))),
  ));
  draw();
}
