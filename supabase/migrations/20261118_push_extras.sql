-- تذكيرات إضافية: سورة الكهف يوم الجمعة وساعة الإجابة، وصيام الاثنين والخميس والأيام البيض
alter table public.push_subs add column if not exists extras text[] not null default '{}';

create or replace function public.push_save(p_sub jsonb, p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  ep text := p_sub->>'endpoint';
  pr text[] := array(select x from jsonb_array_elements_text(coalesce(p_prefs->'prayers', '[]')) x where x in ('fajr','dhuhr','asr','maghrib','isha'));
  ex text[] := array(select x from jsonb_array_elements_text(coalesce(p_prefs->'extras', '[]')) x where x in ('kahf','fasting'));
  wt text := nullif(p_prefs->>'wird_time', '');
begin
  if ep is null or ep !~ '^https://' or length(ep) > 1000 then raise exception 'bad endpoint'; end if;
  if wt is not null and wt !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'bad time'; end if;
  if cardinality(pr) = 0 and wt is null and cardinality(ex) = 0 then delete from push_subs where endpoint = ep; return; end if;
  insert into push_subs(endpoint, p256dh, auth, lat, lng, tz, method, madhab, prayers, wird_time, extras)
  values (ep, p_sub->'keys'->>'p256dh', p_sub->'keys'->>'auth',
          round((p_prefs->>'lat')::numeric, 2), round((p_prefs->>'lng')::numeric, 2),
          left(p_prefs->>'tz', 64), left(p_prefs->>'method', 32), left(p_prefs->>'madhab', 10), pr, wt, ex)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat, lng = excluded.lng,
    tz = excluded.tz, method = excluded.method, madhab = excluded.madhab, prayers = excluded.prayers, wird_time = excluded.wird_time,
    extras = excluded.extras, fails = 0, updated_at = now();
end; $$;
revoke all on function public.push_save(jsonb, jsonb) from public;
grant execute on function public.push_save(jsonb, jsonb) to anon, authenticated;
