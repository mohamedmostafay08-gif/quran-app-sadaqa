-- الختمة الجماعية والمُهداة: بدون حسابات. الجداول مغلقة، والوصول عبر دوال محددة فقط.
create extension if not exists pgcrypto with schema extensions;

create table public.khatmat (
  id text primary key,
  title text not null check (char_length(title) between 1 and 120),
  dedication text check (dedication is null or char_length(dedication) <= 200),
  kind text not null default 'group' check (kind in ('group', 'dedicated')),
  round int not null default 1,
  completed_rounds int not null default 0,
  admin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.khatma_parts (
  khatma_id text not null references public.khatmat(id) on delete cascade,
  round int not null,
  part_no int not null check (part_no between 1 and 30),
  taker_name text check (taker_name is null or char_length(taker_name) <= 40),
  taker_hash text not null,
  status text not null default 'taken' check (status in ('taken', 'done')),
  taken_at timestamptz not null default now(),
  done_at timestamptz,
  primary key (khatma_id, round, part_no)
);
create index khatma_parts_taker on public.khatma_parts (taker_hash);

alter table public.khatmat enable row level security;
alter table public.khatma_parts enable row level security;
revoke all on public.khatmat, public.khatma_parts from anon, authenticated;

create or replace function public._hash(t text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;

create or replace function public.khatma_create(p_title text, p_dedication text, p_kind text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id text; v_admin text;
begin
  if p_title is null or char_length(trim(p_title)) = 0 then raise exception 'title required'; end if;
  v_id := encode(extensions.gen_random_bytes(6), 'hex');
  v_admin := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.khatmat (id, title, dedication, kind, admin_hash)
  values (v_id, left(trim(p_title), 120), nullif(left(trim(coalesce(p_dedication, '')), 200), ''),
          case when p_kind = 'dedicated' then 'dedicated' else 'group' end, public._hash(v_admin));
  return json_build_object('id', v_id, 'admin', v_admin);
end $$;

create or replace function public.khatma_get(p_id text, p_device text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', k.id, 'title', k.title, 'dedication', k.dedication, 'kind', k.kind,
    'round', k.round, 'completed_rounds', k.completed_rounds, 'created_at', k.created_at,
    'parts', coalesce((
      select json_agg(json_build_object('n', p.part_no, 'name', p.taker_name, 'status', p.status,
                                        'mine', p.taker_hash = public._hash(coalesce(p_device, ''))) order by p.part_no)
      from public.khatma_parts p where p.khatma_id = k.id and p.round = k.round), '[]'::json))
  from public.khatmat k where k.id = p_id
$$;

create or replace function public.khatma_take(p_id text, p_part int, p_name text, p_device text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_round int;
begin
  if p_device is null or char_length(p_device) < 16 then raise exception 'bad device'; end if;
  select round into v_round from public.khatmat where id = p_id for update;
  if v_round is null then raise exception 'not found'; end if;
  if (select count(*) from public.khatma_parts where khatma_id = p_id and round = v_round and taker_hash = public._hash(p_device)) >= 10 then
    raise exception 'too many parts';
  end if;
  insert into public.khatma_parts (khatma_id, round, part_no, taker_name, taker_hash)
  values (p_id, v_round, p_part, nullif(left(trim(coalesce(p_name, '')), 40), ''), public._hash(p_device));
  update public.khatmat set updated_at = now() where id = p_id;
  return public.khatma_get(p_id, p_device);
exception when unique_violation then
  raise exception 'part taken';
end $$;

create or replace function public.khatma_done(p_id text, p_part int, p_device text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_round int; v_done int;
begin
  select round into v_round from public.khatmat where id = p_id for update;
  update public.khatma_parts set status = 'done', done_at = now()
   where khatma_id = p_id and round = v_round and part_no = p_part and taker_hash = public._hash(p_device);
  if not found then raise exception 'not yours'; end if;
  select count(*) into v_done from public.khatma_parts where khatma_id = p_id and round = v_round and status = 'done';
  if v_done >= 30 then
    update public.khatmat set round = round + 1, completed_rounds = completed_rounds + 1, updated_at = now() where id = p_id;
  else
    update public.khatmat set updated_at = now() where id = p_id;
  end if;
  return public.khatma_get(p_id, p_device);
end $$;

create or replace function public.khatma_release(p_id text, p_part int, p_device text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_round int;
begin
  select round into v_round from public.khatmat where id = p_id;
  delete from public.khatma_parts
   where khatma_id = p_id and round = v_round and part_no = p_part and status = 'taken' and taker_hash = public._hash(p_device);
  if not found then raise exception 'not yours'; end if;
  return public.khatma_get(p_id, p_device);
end $$;

create or replace function public.khatma_delete(p_id text, p_admin text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.khatmat where id = p_id and admin_hash = public._hash(p_admin);
  return found;
end $$;

revoke all on function public._hash(text) from public, anon, authenticated;
revoke all on function public.khatma_create(text, text, text), public.khatma_get(text, text), public.khatma_take(text, int, text, text),
  public.khatma_done(text, int, text), public.khatma_release(text, int, text), public.khatma_delete(text, text) from public;
grant execute on function public.khatma_create(text, text, text), public.khatma_get(text, text), public.khatma_take(text, int, text, text),
  public.khatma_done(text, int, text), public.khatma_release(text, int, text), public.khatma_delete(text, text) to anon, authenticated;
