// push-tick: تُستدعى كل دقيقة من pg_cron. تحسب مواقيت الصلاة لكل مشترك بمدينته وطريقته،
// وترسل إشعار الأذان عند دخول الوقت، وتذكير الورد في الموعد الذي اختاره.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { sendPush } from './webpush.js';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule } from 'npm:adhan@4.4.3';

const NAMES: Record<string, string> = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const WINDOW_BEFORE = 20_000, WINDOW_AFTER = 3 * 60_000; // نافذة الإرسال حول الموعد (يُشغَّل كل دقيقة)
const APP = 'https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/';

type Sub = { endpoint: string; p256dh: string; auth: string; lat: number; lng: number; tz: string; method: string; madhab: string; prayers: string[]; wird_time: string | null; last_sent: Record<string, string>; fails: number };

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

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: cfg, error: cfgErr } = await db.rpc('push_config');
  if (cfgErr || !cfg?.vapid_private) return new Response('config', { status: 500 });
  const vapid = { subject: APP, publicKey: cfg.vapid_public, privateKey: cfg.vapid_private };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  // إشعار تجريبي يطلبه المستخدم لجهازه (نقطة الإرسال سرية ولا يعرفها غيره؛ مرة كل ٣٠ ثانية)
  const body = await req.json().catch(() => ({}));
  if (body?.test_endpoint) {
    const { data: s } = await db.from('push_subs').select('*').eq('endpoint', body.test_endpoint).maybeSingle();
    if (!s) return new Response(JSON.stringify({ ok: false, error: 'not subscribed' }), { status: 404, headers: cors });
    const lastTest = Date.parse(s.last_sent?.test || 0);
    if (Date.now() - lastTest < 30_000) return new Response(JSON.stringify({ ok: false, error: 'too soon' }), { status: 429, headers: cors });
    const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: 'رتّل — إشعار تجريبي', body: 'التنبيهات تعمل على جهازك ✓ اضغط لسماع الأذان', url: '#/prayer?adhan=test', tag: 'test', adhan: true }), { vapid, ttl: 120 });
    await db.from('push_subs').update({ last_sent: { ...(s.last_sent || {}), test: new Date().toISOString() } }).eq('endpoint', s.endpoint);
    const ok = r.status >= 200 && r.status < 300;
    if (r.status === 404 || r.status === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    return new Response(JSON.stringify({ ok, status: r.status, error: ok ? undefined : r.text.slice(0, 200) }), { status: ok ? 200 : 502, headers: cors });
  }

  if (req.headers.get('x-tick-key') !== cfg.push_tick_key) return new Response('forbidden', { status: 403 });

  const now = new Date();
  const { data: subs, error } = await db.from('push_subs').select('*').limit(5000);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0, removed = 0;
  const jobs = (subs as Sub[]).map(async (s) => {
    const due: { key: string; tag: string; ttl?: number; payload: Record<string, unknown> }[] = [];
    let lp;
    try { lp = localParts(now, s.tz || 'UTC'); } catch { lp = localParts(now, 'UTC'); }
    if (s.prayers?.length && s.lat != null && s.lng != null) {
      const pt = prayerTimes(s, lp) as any;
      for (const k of s.prayers) {
        const t: Date = pt[k];
        if (!t) continue;
        const diff = now.getTime() - t.getTime();
        if (diff >= -WINDOW_BEFORE && diff < WINDOW_AFTER && s.last_sent?.[k] !== lp.date) {
          due.push({ key: k, tag: 'prayer-' + k, ttl: 600, payload: { title: `حان الآن موعد صلاة ${NAMES[k]}`, body: '«حيّ على الصلاة، حيّ على الفلاح» — اضغط لسماع الأذان', url: `#/prayer?adhan=${k}`, tag: 'prayer', adhan: true } });
        }
      }
    }
    if (s.wird_time && s.last_sent?.wird !== lp.date) {
      const [h, m] = s.wird_time.split(':').map(Number);
      const diff = lp.min - (h * 60 + m);
      if (diff >= 0 && diff < 6) due.push({ key: 'wird', tag: 'wird', payload: { title: 'موعد وردك اليومي', body: 'خصّص دقائق للقرآن الآن، ولو صفحة واحدة.', url: '#/khatma', tag: 'wird' } });
    }
    if (!due.length) return;
    const last = { ...(s.last_sent || {}) };
    let gone = false, failed = false;
    for (const d of due) {
      try {
        const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(d.payload), { vapid, topic: d.tag, ttl: d.ttl || 1800 });
        if (r.status === 404 || r.status === 410) { gone = true; break; }
        if (r.status >= 200 && r.status < 300) { last[d.key] = lp.date; sent++; }
        else { failed = true; console.error('push', r.status, r.text.slice(0, 200)); }
      } catch (e) { failed = true; console.error('push error', String(e)); }
    }
    if (gone || (failed && s.fails >= 20)) { await db.from('push_subs').delete().eq('endpoint', s.endpoint); removed++; return; }
    await db.from('push_subs').update({ last_sent: last, fails: failed ? s.fails + 1 : 0 }).eq('endpoint', s.endpoint);
  });
  await Promise.allSettled(jobs);
  return new Response(JSON.stringify({ subs: subs.length, sent, removed }), { headers: { 'Content-Type': 'application/json' } });
});
