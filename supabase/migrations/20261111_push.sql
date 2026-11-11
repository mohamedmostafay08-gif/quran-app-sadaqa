-- إشعارات الأذان والورد (Web Push)
-- الاشتراك: نقطة الإرسال (endpoint) هي نفسها المفتاح السري للجهاز؛ الموقع يُحفظ مقرّبًا (~١ كم) لحساب المواقيت فقط.
-- المفاتيح الخاصة (VAPID) ومفتاح التشغيل الدوري محفوظة في Supabase Vault، لا في الكود.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  lat numeric(6,2),
  lng numeric(6,2),
  tz text,
  method text,
  madhab text,
  prayers text[] not null default '{}',
  wird_time text,                     -- HH:MM بتوقيت الجهاز
  last_sent jsonb not null default '{}',
  fails int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

create or replace function public.push_save(p_sub jsonb, p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  ep text := p_sub->>'endpoint';
  pr text[] := array(select x from jsonb_array_elements_text(coalesce(p_prefs->'prayers', '[]')) x where x in ('fajr','dhuhr','asr','maghrib','isha'));
  wt text := nullif(p_prefs->>'wird_time', '');
begin
  if ep is null or ep !~ '^https://' or length(ep) > 1000 then raise exception 'bad endpoint'; end if;
  if wt is not null and wt !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'bad time'; end if;
  if cardinality(pr) = 0 and wt is null then delete from push_subs where endpoint = ep; return; end if;
  insert into push_subs(endpoint, p256dh, auth, lat, lng, tz, method, madhab, prayers, wird_time)
  values (ep, p_sub->'keys'->>'p256dh', p_sub->'keys'->>'auth',
          round((p_prefs->>'lat')::numeric, 2), round((p_prefs->>'lng')::numeric, 2),
          left(p_prefs->>'tz', 64), left(p_prefs->>'method', 32), left(p_prefs->>'madhab', 10), pr, wt)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat, lng = excluded.lng,
    tz = excluded.tz, method = excluded.method, madhab = excluded.madhab, prayers = excluded.prayers, wird_time = excluded.wird_time,
    fails = 0, updated_at = now();
end; $$;

create or replace function public.push_delete(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subs where endpoint = p_endpoint;
$$;

-- للدالة الطرفية فقط (service_role): الإعدادات السرية
create or replace function public.push_config()
returns jsonb language sql security definer set search_path = public, vault as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
  where name in ('vapid_public', 'vapid_private', 'push_tick_key');
$$;

revoke all on function public.push_save(jsonb, jsonb) from public;
revoke all on function public.push_delete(text) from public;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_save(jsonb, jsonb) to anon, authenticated;
grant execute on function public.push_delete(text) to anon, authenticated;
grant execute on function public.push_config() to service_role;

-- كل ٥ دقائق: استدعاء الدالة الطرفية التي تحسب المواقيت وترسل الإشعارات
-- (المفاتيح تُضاف إلى Vault مرة واحدة خارج هذا الملف: vapid_public, vapid_private, push_tick_key)
select cron.schedule('push-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://lskfbmkesxxgqytjsftk.supabase.co/functions/v1/push-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tick-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_tick_key')),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
$$);
