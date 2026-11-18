-- مزامنة بين الأجهزة: البيانات تُشفَّر على الجهاز (AES-GCM بمفتاح مشتق من «رمز المزامنة») قبل رفعها،
-- والخادم لا يرى إلا نصًا مشفرًا ومعرّفًا مُجزّأً (SHA-256) — لا حسابات ولا بريد ولا أسماء.
create table if not exists public.sync_blobs (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  data text not null check (length(data) <= 2000000),
  updated_at timestamptz not null default now()
);
alter table public.sync_blobs enable row level security; -- لا سياسات: الوصول عبر الدوال فقط
revoke all on public.sync_blobs from anon, authenticated;

create or replace function public.sync_get(p_id text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object('data', data, 'updated_at', updated_at) from sync_blobs where id = p_id;
$$;

-- p_base: آخر نسخة رآها الجهاز؛ لو تغيّرت على الخادم بعدها يُرفض الحفظ ليدمج الجهاز أولًا
create or replace function public.sync_put(p_id text, p_data text, p_base timestamptz)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare cur timestamptz; t timestamptz := clock_timestamp();
begin
  if p_id !~ '^[0-9a-f]{64}$' then raise exception 'bad id'; end if;
  if p_data is null or length(p_data) > 2000000 then raise exception 'too large'; end if;
  select updated_at into cur from sync_blobs where id = p_id for update;
  if cur is not null and (p_base is null or cur > p_base) then raise exception 'conflict'; end if;
  insert into sync_blobs(id, data, updated_at) values (p_id, p_data, t)
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return t;
end; $$;

create or replace function public.sync_delete(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from sync_blobs where id = p_id;
$$;

revoke all on function public.sync_get(text), public.sync_put(text, text, timestamptz), public.sync_delete(text) from public;
grant execute on function public.sync_get(text), public.sync_put(text, text, timestamptz), public.sync_delete(text) to anon, authenticated;
