// push-tick: تُستدعى كل دقيقة من pg_cron. تحسب مواقيت الصلاة لكل مشترك بمدينته وطريقته،
// وترسل إشعار الأذان عند دخول الوقت، وتذكير الورد في الموعد الذي اختاره،
// وتذكيرات الجمعة والصيام، والتنبيه قبل الأذان، وأذكار ما بعد الصلاة، وآية الصباح، وقيام الليل لمن فعّلها.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { sendPush } from './webpush.js';
import { createRateLimiter, clientIp, loadAll, pool } from './limits.js';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule } from 'npm:adhan@4.4.3';

const NAMES: Record<string, string> = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const WINDOW_BEFORE = 20_000, WINDOW_AFTER = 3 * 60_000; // نافذة الإرسال حول الموعد (يُشغَّل كل دقيقة)
const APP = 'https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/';

type Due = { key: string; tag: string; ttl?: number; mark?: string; payload: Record<string, unknown> };
type Sub = { endpoint: string; p256dh: string; auth: string; lat: number; lng: number; tz: string; method: string; madhab: string; prayers: string[]; wird_time: string | null; extras: string[] | null; last_sent: Record<string, string>; fails: number };

/** اليوم الهجري (أم القرى) لتاريخ محلي */
function hijriDay(d: Date, tz: string) {
  try { return +new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: tz, day: 'numeric' }).format(d); } catch { return 0; }
}
const arNum = (n: string | number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const weekday = (d: Date, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);

/** أجزاء التاريخ والوقت المحلي في منطقة زمنية */
function localParts(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, y: +p.year, m: +p.month, d: +p.day, hm: `${p.hour}:${p.minute}`, min: +p.hour * 60 + +p.minute };
}

function prayerTimes(s: Sub, lp: ReturnType<typeof localParts>) {
  const params = ((CalculationMethod as any)[s.method] || CalculationMethod.Egyptian)();
  params.madhab = s.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (Math.abs(s.lat) > 48) params.highLatitudeRule = HighLatitudeRule.recommended(new Coordinates(s.lat, s.lng));
  // adhan يأخذ اليوم من التاريخ المُعطى (الخادم يعمل بتوقيت UTC)
  return new PrayerTimes(new Coordinates(s.lat, s.lng), new Date(Date.UTC(lp.y, lp.m - 1, lp.d, 12)), params);
}

/** آيات اليوم من ملفات التطبيق المنشورة (تُحمَّل مرة لكل نسخة من الدالة) */
let ayahsCache: Promise<{ s: number; a: number; name: string; text: string }[] | null> | null = null;
const dailyAyahs = () => (ayahsCache ||= fetch(APP + 'public/data/daily-ayahs.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((x) => { if (!x) ayahsCache = null; return x; }));

// حماية: حدّ لطلبات الإشعار التجريبي لكل عنوان، ومنع تداخل دورتين في نفس النسخة
const testLimit = createRateLimiter({ perKey: 5, total: 120, windowMs: 60_000 });
let ticking = false;
const MAX_SUBS = +(Deno.env.get('PUSH_MAX_SUBS') || 50_000);
const TICK_BUDGET_MS = +(Deno.env.get('PUSH_TICK_BUDGET_MS') || 20_000); // pg_net ينتظر ٢٥ ثانية؛ لا نبدأ إرسالًا جديدًا بعد ٢٠
// الأسرار تُقرأ من Vault مرة كل ٥ دقائق لكل نسخة، لا مع كل طلب
let cfgCache: { at: number; cfg: any } | null = null;
const COLUMNS = 'endpoint,p256dh,auth,lat,lng,tz,method,madhab,prayers,wird_time,extras,last_sent,fails';

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });

  // نرفض أي طلب ليس دورة مجدولة ولا إشعارًا تجريبيًا قبل قراءة الأسرار من Vault
  const body = await req.json().catch(() => ({}));
  const isTick = req.headers.has('x-tick-key');
  const testEp = body?.test_endpoint;
  if (!isTick && !testEp) return new Response('forbidden', { status: 403 });
  if (!isTick && (typeof testEp !== 'string' || !testEp.startsWith('https://') || testEp.length > 1000)) return json({ ok: false, error: 'bad endpoint' }, 400);
  if (!isTick && !testLimit(clientIp(req.headers))) return json({ ok: false, error: 'too many requests' }, 429);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  if (!cfgCache || Date.now() - cfgCache.at > 300_000) {
    const { data, error: cfgErr } = await db.rpc('push_config');
    if (cfgErr || !data?.vapid_private) return new Response('config', { status: 500 });
    cfgCache = { at: Date.now(), cfg: data };
  }
  const cfg = cfgCache.cfg;
  const vapid = { subject: APP, publicKey: cfg.vapid_public, privateKey: cfg.vapid_private };

  // إشعار تجريبي يطلبه المستخدم لجهازه (نقطة الإرسال سرية ولا يعرفها غيره؛ مرة كل ٣٠ ثانية)
  if (!isTick) {
    const { data: s } = await db.from('push_subs').select('*').eq('endpoint', testEp).maybeSingle();
    if (!s) return json({ ok: false, error: 'not subscribed' }, 404);
    const lastTest = Date.parse(s.last_sent?.test || 0);
    if (Date.now() - lastTest < 30_000) return json({ ok: false, error: 'too soon' }, 429);
    const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: 'رتّل — إشعار تجريبي', body: 'التنبيهات تعمل على جهازك ✓ اضغط لسماع الأذان', url: '#/prayer?adhan=test', tag: 'test', adhan: true }), { vapid, ttl: 120 });
    await db.from('push_subs').update({ last_sent: { ...(s.last_sent || {}), test: new Date().toISOString() } }).eq('endpoint', s.endpoint);
    const ok = r.status >= 200 && r.status < 300;
    if (r.status === 404 || r.status === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    return json({ ok, status: r.status, error: ok ? undefined : r.text.slice(0, 200) }, ok ? 200 : 502);
  }

  if (req.headers.get('x-tick-key') !== cfg.push_tick_key) return new Response('forbidden', { status: 403 });
  if (ticking) return json({ skipped: 'previous tick still running' }, 202);
  ticking = true;
  try { return json(await tick(db, vapid)); } finally { ticking = false; }
});

async function tick(db: ReturnType<typeof createClient>, vapid: { subject: string; publicKey: string; privateKey: string }) {
  const started = Date.now();
  const now = new Date();
  // كل المشتركين على صفحات (بدل limit(5000) الذي كان يُسقط الزائد بصمت وبترتيب غير ثابت)
  const { rows: subs, error, truncated } = await loadAll((from, to) => db.from('push_subs').select(COLUMNS).order('endpoint').range(from, to), { pageSize: 1000, max: MAX_SUBS });
  if (error) throw new Error(error.message);
  if (truncated) console.error(`push-tick: وصل عدد المشتركين إلى الحد ${MAX_SUBS}؛ ارفع PUSH_MAX_SUBS أو قسّم الدورة`);
  else if (subs.length > MAX_SUBS * 0.8) console.warn(`push-tick: ${subs.length} مشترك (أكثر من ٨٠٪ من الحد ${MAX_SUBS})`);
  const aodList = await dailyAyahs();

  let sent = 0, removed = 0;
  // المرحلة الأولى (حساب فقط): ما المستحق لكل مشترك الآن
  const work: { s: Sub; due: Due[]; lp: ReturnType<typeof localParts> }[] = [];
  for (const s of subs as Sub[]) {
    const due: Due[] = [];
    let tz = s.tz || 'UTC', lp;
    try { lp = localParts(now, tz); } catch { tz = 'UTC'; lp = localParts(now, tz); } // منطقة زمنية غير صالحة
    if (s.prayers?.length && s.lat != null && s.lng != null) {
      const pt = prayerTimes(s, lp) as any;
      for (const k of s.prayers) {
        const t: Date = pt[k];
        if (!t) continue;
        const diff = now.getTime() - t.getTime();
        if (diff >= -WINDOW_BEFORE && diff < WINDOW_AFTER && s.last_sent?.[k] !== lp.date) {
          due.push({ key: k, tag: 'prayer-' + k, ttl: 600, payload: { title: `حان الآن موعد صلاة ${NAMES[k]}`, body: '«حيّ على الصلاة، حيّ على الفلاح» — اضغط لسماع الأذان', url: `#/prayer?adhan=${k}`, tag: 'prayer', adhan: true } });
        }
        // تنبيه قبل الأذان بعدد الدقائق المختار
        const pre = (s.extras || []).map((x) => /^pre(\d+)$/.exec(x)?.[1]).find(Boolean);
        if (pre) {
          const d2 = now.getTime() - (t.getTime() - +pre * 60_000);
          if (d2 >= -WINDOW_BEFORE && d2 < WINDOW_AFTER && s.last_sent?.['pre_' + k] !== lp.date) {
            due.push({ key: 'pre_' + k, tag: 'pre-' + k, ttl: 600, payload: { title: `باقي ${arNum(pre)} دقيقة على صلاة ${NAMES[k]}`, body: 'استعد للصلاة، وتوضأ إن لم تكن على وضوء.', url: '#/prayer', tag: 'pre' } });
          }
        }
        // أذكار ما بعد الصلاة (بعد الأذان بعشر دقائق تقريبًا)
        if ((s.extras || []).includes('after')) {
          const d3 = now.getTime() - (t.getTime() + 10 * 60_000);
          if (d3 >= 0 && d3 < WINDOW_AFTER && s.last_sent?.['after_' + k] !== lp.date) {
            due.push({ key: 'after_' + k, tag: 'after-' + k, ttl: 1800, payload: { title: 'الأذكار بعد الصلاة', body: `بعد صلاة ${NAMES[k]}: أستغفر الله ثلاثًا، وسبحان الله والحمد لله والله أكبر.`, url: '#/adhkar/25', tag: 'after' } });
          }
        }
      }
    }
    // أذكار الصباح (بعد الفجر بنصف ساعة) والمساء (بعد العصر بثلث ساعة)
    if ((s.extras || []).includes('adhkar') && s.lat != null && s.lng != null) {
      const pt = prayerTimes(s, lp) as any;
      for (const [key, t, off, title, url] of [['adhkar_sabah', pt.fajr, 30, 'أذكار الصباح', '#/adhkar/27?p=sabah'], ['adhkar_masa', pt.asr, 20, 'أذكار المساء', '#/adhkar/27?p=masa']] as const) {
        const d4 = now.getTime() - (t.getTime() + off * 60_000);
        if (d4 >= 0 && d4 < WINDOW_AFTER && s.last_sent?.[key] !== lp.date) due.push({ key, tag: key, ttl: 3600, payload: { title, body: 'حصّن يومك بالذكر؛ دقائق قليلة وأجر عظيم.', url, tag: key } });
      }
    }
    if (s.wird_time && s.last_sent?.wird !== lp.date) {
      const [h, m] = s.wird_time.split(':').map(Number);
      const diff = lp.min - (h * 60 + m);
      if (diff >= 0 && diff < 6) due.push({ key: 'wird', tag: 'wird', payload: { title: 'موعد وردك اليومي', body: 'خصّص دقائق للقرآن الآن، ولو صفحة واحدة.', url: '#/khatma', tag: 'wird' } });
    }
    // تذكيرات إضافية بتوقيت الجهاز (نافذة ٦ دقائق، مرة واحدة في اليوم لكل نوع)
    const ex = s.extras || [];
    const at = (hh: number, mm = 0) => { const diff = lp.min - (hh * 60 + mm); return diff >= 0 && diff < 6; };
    const wd = weekday(now, tz);
    if (ex.includes('kahf') && wd === 'Fri') {
      if (at(9) && s.last_sent?.kahf !== lp.date) due.push({ key: 'kahf', tag: 'kahf', payload: { title: 'يوم الجمعة', body: 'اقرأ سورة الكهف، وأكثر من الصلاة على النبي ﷺ.', url: '#/surah/18', tag: 'kahf' } });
      // آخر ساعة من يوم الجمعة (قبل المغرب بساعة) — «فالتمسوها آخر ساعة بعد العصر»
      if (s.lat != null && s.lng != null && s.last_sent?.jumuah_hour !== lp.date) {
        const mg = (prayerTimes(s, lp) as any).maghrib as Date;
        const diff = now.getTime() - (mg.getTime() - 60 * 60_000);
        if (diff >= 0 && diff < 6 * 60_000) due.push({ key: 'jumuah_hour', tag: 'jumuah', payload: { title: 'آخر ساعة من يوم الجمعة', body: 'ساعة يُرجى فيها إجابة الدعاء؛ فأكثر من الدعاء والصلاة على النبي ﷺ.', url: '#/prayer?tab=adhkar', tag: 'jumuah' } });
      }
    }
    if (ex.includes('fasting') && at(21) && s.last_sent?.fasting !== lp.date) {
      const hd = hijriDay(now, tz);
      const tomorrow = wd === 'Sun' ? 'الاثنين' : wd === 'Wed' ? 'الخميس' : null;
      const white = hd === 12;
      if (tomorrow || white) due.push({ key: 'fasting', tag: 'fasting', payload: { title: 'تذكير بالصيام', body: white ? 'تبدأ الأيام البيض غدًا (١٣ و١٤ و١٥ من الشهر الهجري).' : `غدًا يوم ${tomorrow}، يُستحب صيامه.`, url: '#/calendar', tag: 'fasting' } });
    }
    // آية الصباح (٨:٠٠ بتوقيت الجهاز): نفس آية اليوم التي يعرضها التطبيق
    if (ex.includes('aod') && at(8) && s.last_sent?.aod !== lp.date) {
      const list = aodList;
      if (list?.length) {
        const x = list[Math.floor(Date.UTC(lp.y, lp.m - 1, lp.d) / 86_400_000) % list.length];
        due.push({ key: 'aod', tag: 'aod', ttl: 4 * 3600, payload: { title: `آية اليوم — سورة ${x.name}`, body: `﴿${x.text}﴾`, url: `#/surah/${x.s}/${x.a}`, tag: 'aod' } });
      }
    }
    // قيام الليل والوتر: أول الثلث الأخير من الليل (بين مغرب الأمس وفجر اليوم)
    if (ex.includes('qiyam') && s.lat != null && s.lng != null) {
      for (const off of [0, 1]) { // الثلث الأخير قد يبدأ قبل منتصف الليل في بعض البلاد
        const base = new Date(Date.UTC(lp.y, lp.m - 1, lp.d + off, 12));
        const dayLp = { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() } as any;
        const prev = new Date(Date.UTC(dayLp.y, dayLp.m - 1, dayLp.d - 1, 12));
        const fajr = (prayerTimes(s, dayLp) as any).fajr as Date;
        const mg = (prayerTimes(s, { y: prev.getUTCFullYear(), m: prev.getUTCMonth() + 1, d: prev.getUTCDate() } as any) as any).maghrib as Date;
        const start = fajr.getTime() - (fajr.getTime() - mg.getTime()) / 3;
        const key = base.toISOString().slice(0, 10);
        const diff = now.getTime() - start;
        if (diff >= 0 && diff < WINDOW_AFTER && s.last_sent?.qiyam !== key) {
          due.push({ key: 'qiyam', tag: 'qiyam', ttl: 3600, payload: { title: 'الثلث الأخير من الليل', body: '«ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر» متفق عليه. صلِّ ركعتين، واختم بالوتر.', url: '#/prayer', tag: 'qiyam' }, mark: key });
        }
      }
    }
    if (due.length) work.push({ s, due, lp });
  }

  // المرحلة الثانية (شبكة): الإرسال بعدد محدود في نفس الوقت وبميزانية زمنية
  const { skipped } = await pool(work, 32, async ({ s, due, lp }) => {
    const last = { ...(s.last_sent || {}) };
    let gone = false, failed = false;
    for (const d of due) {
      try {
        const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(d.payload), { vapid, topic: d.tag, ttl: d.ttl || 1800 });
        if (r.status === 404 || r.status === 410) { gone = true; break; }
        if (r.status >= 200 && r.status < 300) { last[d.key] = d.mark || lp.date; sent++; }
        else { failed = true; console.error('push', r.status, r.text.slice(0, 200)); }
      } catch (e) { failed = true; console.error('push error', String(e)); }
    }
    if (gone || (failed && s.fails >= 20)) { await db.from('push_subs').delete().eq('endpoint', s.endpoint); removed++; return; }
    await db.from('push_subs').update({ last_sent: last, fails: failed ? s.fails + 1 : 0 }).eq('endpoint', s.endpoint);
  }, started + TICK_BUDGET_MS);
  // من لم يُرسَل له لم يُعلَّم، فيُعاد في الدقيقة التالية ضمن نافذة الموعد (٣ دقائق)
  if (skipped) console.error(`push-tick: انتهت الميزانية الزمنية؛ ${skipped} من ${work.length} مشترك مؤجّل للدورة التالية`);
  return { subs: subs.length, due: work.length, sent, removed, skipped, truncated, ms: Date.now() - started };
}
