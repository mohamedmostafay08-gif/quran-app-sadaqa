// دروس المشايخ: سلاسل صوتية تعمل في مشغّل التطبيق (بالخلفية ومع الاستكمال)، ومرئية من القنوات الرسمية على يوتيوب
import { h, icon, ar } from '../lib/dom.js';
import * as settings from '../state.js';
import { mount, topbar, toast, empty } from '../ui.js';
import { player } from '../audio/player.js';
import { navigate } from '../router.js';

let dataP = null;
const load = () => (dataP ||= fetch(new URL('../../public/data/lessons.json', import.meta.url).href)
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { dataP = null; throw e; }));

// تقدّم الاستماع: { معرف الحلقة: [الثانية، المدة، وقت آخر استماع] }
const progress = () => settings.get('lessonProgress') || {};
const epId = (sid, i) => `${sid}:${i}`;
const fmt = (sec) => { sec = Math.round(sec); const m = Math.floor(sec / 60); return m >= 60 ? `${ar(Math.floor(m / 60))}:${String(m % 60).padStart(2, '0').replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])} س` : `${ar(m)} د`; };

let saver = 0;
/** يحفظ موضع الحلقة كل ١٠ ثوانٍ أثناء تشغيلها */
function trackProgress() {
  clearInterval(saver);
  saver = setInterval(() => {
    const p = player.position();
    if (!p.id?.startsWith('ls:')) { clearInterval(saver); saver = 0; return; }
    if (p.time < 5) return;
    const all = { ...progress() };
    const done = p.duration && p.time > p.duration - 30;
    all[p.id.slice(3)] = [done ? -1 : Math.round(p.time), Math.round(p.duration), Date.now()];
    const keys = Object.keys(all).sort((a, b) => all[b][2] - all[a][2]);
    for (const k of keys.slice(400)) delete all[k];
    settings.set('lessonProgress', all);
  }, 10000);
}

function program(data, s, i) {
  const ep = s.episodes[i];
  const sh = data.sheikhs[s.sheikh];
  const saved = progress()[epId(s.id, i)];
  return {
    id: 'ls:' + epId(s.id, i), ondemand: true, lesson: true,
    name: s.title, sub: `${sh.name} — ${ep[0]}`,
    info: `${s.title}، ${ep[0]} (${ar(i + 1)} من ${ar(s.episodes.length)})`,
    href: `#/lessons/${s.id}`, url: ep[1],
    startAt: saved && saved[0] > 0 ? saved[0] : 0,
    next: () => (i + 1 < s.episodes.length ? program(data, s, i + 1) : null),
  };
}
export function playEpisode(data, s, i) {
  player.playRadio(program(data, s, i));
  trackProgress();
  settings.set('lastLesson', { series: s.id, i, at: Date.now() });
}
// الحلقة التالية تبدأ تلقائيًا من المشغّل؛ نتابع حفظ تقدّمها أيضًا
player.subscribe?.((st) => { if (st?.radio?.lesson && st.status === 'playing') { const id = st.radio.id.slice(3); const [sid, i] = id.split(':'); const last = settings.get('lastLesson'); if (!last || last.series !== sid || last.i !== +i) settings.set('lastLesson', { series: sid, i: +i, at: Date.now() }); if (!saver) trackProgress(); } });

const seriesCard = (data, s) => {
  const sh = data.sheikhs[s.sheikh];
  const n = s.kind === 'audio' ? s.episodes.length : s.count;
  const p = progress();
  const heard = s.kind === 'audio' ? s.episodes.filter((_, i) => p[epId(s.id, i)]).length : 0;
  return h('a.card.ls-card', { href: `#/lessons/${s.id}` },
    h('span.ls-kind', { class: `ls-kind ${s.kind}`, 'aria-hidden': 'true' }, icon(s.kind === 'audio' ? 'play' : 'pages')),
    h('span.ls-t', h('strong', s.title), h('small', `${sh.name}${n ? ` · ${ar(n)} ${s.kind === 'audio' ? (n >= 3 && n <= 10 ? 'دروس' : 'درسًا') : (n >= 3 && n <= 10 ? 'مقاطع' : 'مقطعًا')}` : ''}${s.kind === 'video' ? ' · فيديو' : ''}`),
      heard ? h('span.ls-bar', h('span', { style: { width: `${Math.round((heard / n) * 100)}%` } })) : null),
    icon('back'));
};

export async function renderLessons(params, query = {}) {
  let data;
  try { data = await load(); } catch {
    return mount(h('div.lessons-page', topbar({ title: 'دروس المشايخ', back: '#/' }), h('section.card', empty('wifiOff', 'الدروس تحتاج اتصالًا بالإنترنت', 'افتحها وأنت متصل بالإنترنت.'))));
  }
  if (params.id) return renderSeries(data, params.id);
  const topic = query.t || null, sheikh = query.s || null;
  const list = data.series.filter((s) => (!topic || s.topic === topic) && (!sheikh || s.sheikh === sheikh));
  const last = settings.get('lastLesson');
  const lastS = last && data.series.find((s) => s.id === last.series);
  const link = (t, s) => `#/lessons${t || s ? '?' : ''}${t ? `t=${encodeURIComponent(t)}` : ''}${t && s ? '&' : ''}${s ? `s=${s}` : ''}`;
  mount(h('div.lessons-page',
    topbar({ title: 'دروس المشايخ', sub: 'تفسير وحديث وسيرة وفقه ومواعظ', back: '#/' }),
    lastS && lastS.kind === 'audio' && lastS.episodes[last.i] ? h('button.card.ls-continue', { type: 'button', onclick: () => playEpisode(data, lastS, last.i) },
      h('span.ls-kind.audio', icon('play')), h('span.ls-t', h('small', 'أكمل الاستماع'), h('strong', lastS.title), h('small', `${data.sheikhs[lastS.sheikh].name} — ${lastS.episodes[last.i][0]}`))) : null,
    h('div.ls-topics', { role: 'tablist', 'aria-label': 'الموضوعات' },
      h('a.pb-chip', { href: link(null, sheikh), 'aria-pressed': String(!topic) }, 'الكل'),
      ...data.topics.filter(([id]) => data.series.some((s) => s.topic === id)).map(([id, name]) => h('a.pb-chip', { href: link(id, sheikh), 'aria-pressed': String(topic === id) }, name))),
    h('div.ls-sheikhs', Object.entries(data.sheikhs).filter(([id]) => data.series.some((s) => s.sheikh === id)).map(([id, sh]) => h('a', { class: `ls-sh${sheikh === id ? ' on' : ''}`, href: link(topic, sheikh === id ? null : id) }, h('span.ls-av', { 'aria-hidden': 'true' }, (sh.short || sh.name).split(' ').pop().replace(/^ال/, '')[0]), h('small', sh.short || sh.name)))),
    list.length ? h('div.ls-list', list.map((s) => seriesCard(data, s))) : h('p.muted', 'لا توجد دروس بهذا الاختيار بعد.'),
  ));
}

function renderSeries(data, id) {
  const s = data.series.find((x) => x.id === id);
  if (!s) return navigate('/lessons', { replace: true });
  const sh = data.sheikhs[s.sheikh];
  const topicName = (data.topics.find((t) => t[0] === s.topic) || [])[1] || '';
  if (s.kind === 'video') {
    const frame = h('div.ls-video', h('iframe', {
      src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(s.playlist)}&rel=0&hl=ar`,
      title: s.title, loading: 'lazy', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin',
    }));
    return mount(h('div.lessons-page',
      topbar({ title: s.title, sub: `${sh.name} · ${topicName}`, back: '#/lessons' }),
      navigator.onLine ? frame : h('section.card', empty('wifiOff', 'الفيديو يحتاج اتصالًا بالإنترنت', '')),
      h('p.small-note', 'اضغط على أيقونة القائمة أعلى الفيديو لاختيار حلقة أخرى من السلسلة.'),
      h('a.btn.ghost.block', { href: `https://www.youtube.com/playlist?list=${encodeURIComponent(s.playlist)}`, target: '_blank', rel: 'noopener' }, 'افتح السلسلة في يوتيوب')));
  }
  const p = progress();
  const cur = player.position().id;
  const nextIdx = s.episodes.findIndex((_, i) => !p[epId(s.id, i)] || p[epId(s.id, i)][0] !== -1);
  mount(h('div.lessons-page',
    topbar({ title: s.title, sub: `${sh.name} · ${topicName}`, back: '#/lessons' }),
    h('section.card.ls-head',
      h('span', `${ar(s.episodes.length)} ${s.episodes.length >= 3 && s.episodes.length <= 10 ? 'دروس صوتية' : 'درسًا صوتيًا'}`),
      nextIdx >= 0 ? h('button.btn', { type: 'button', onclick: () => { playEpisode(data, s, nextIdx); toast('بدأ التشغيل'); rerenderSoon(); } }, icon('play'), nextIdx === 0 && !p[epId(s.id, 0)] ? 'ابدأ السلسلة' : `أكمل: ${s.episodes[nextIdx][0]}`) : h('span.hd-badge.hd-grade', 'أتممت السلسلة ✓')),
    h('ol.ls-eps', s.episodes.map(([t], i) => {
      const pr = p[epId(s.id, i)];
      const done = pr && pr[0] === -1;
      const playing = cur === 'ls:' + epId(s.id, i);
      return h('li', h('button', { type: 'button', class: `ls-ep${playing ? ' on' : ''}${done ? ' done' : ''}`, onclick: () => { playEpisode(data, s, i); rerenderSoon(); } },
        h('span.ls-n', done ? '✓' : ar(i + 1)),
        h('span.ls-t', h('strong', t), pr && !done && pr[1] ? h('span.ls-bar', h('span', { style: { width: `${Math.min(100, Math.round((pr[0] / pr[1]) * 100))}%` } })) : null, pr && !done && pr[0] >= 60 ? h('small', `توقفت عند ${fmt(pr[0])}`) : null),
        icon(playing ? 'pause' : 'play')));
    })),
    h('p.small-note', `المصدر: ${s.source || 'أرشيف الإنترنت'}`)));
}
const rerenderSoon = () => setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 400);
