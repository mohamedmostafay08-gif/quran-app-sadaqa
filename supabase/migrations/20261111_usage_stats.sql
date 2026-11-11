-- إحصائيات استخدام مجمّعة تحترم الخصوصية: عدّاد يومي لكل حدث فقط.
-- لا معرّف للجهاز ولا عنوان IP ولا وقت دقيق؛ كل جهاز يرسل الحدث مرة واحدة في اليوم على الأكثر.
create table if not exists public.daily_stats (
  day date not null,
  event text not null,
  count integer not null default 0,
  primary key (day, event)
);
alter table public.daily_stats enable row level security;
revoke all on public.daily_stats from anon, authenticated;

create or replace function public.stat_hit(p_events text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array['open','open_installed','listen','read','pages','tafsir','translation','prayer','group','memorize','share_audio','push_on','radio'];
  e text;
begin
  if p_events is null or array_length(p_events, 1) is null or array_length(p_events, 1) > 13 then return; end if;
  foreach e in array p_events loop
    if e = any(allowed) then
      insert into public.daily_stats(day, event, count) values (current_date, e, 1)
      on conflict (day, event) do update set count = public.daily_stats.count + 1;
    end if;
  end loop;
end;
$$;
revoke all on function public.stat_hit(text[]) from public;
grant execute on function public.stat_hit(text[]) to anon, authenticated;
