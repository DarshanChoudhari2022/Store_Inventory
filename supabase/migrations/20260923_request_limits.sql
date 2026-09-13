-- Shared limits survive worker/server restarts and apply across app instances.
create table if not exists public.retail_request_windows (
 scope text primary key,
 window_start timestamptz not null,
 requests integer not null check(requests>0)
);
alter table public.retail_request_windows enable row level security;
revoke all on public.retail_request_windows from public,anon,authenticated;

create or replace function public.retail_request_limit(p_token uuid,p_shop_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare s app_sessions%rowtype; bucket text; used integer; ceiling integer;
begin
 select * into s from app_sessions where token=p_token and expires_at>now();
 if not found then raise exception 'Session expired';end if;
 if p_shop_id is not null and not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if s.role='shop' and not can_access_shop(p_token,s.shop_id) then raise exception 'Shop access required';end if;
 -- Shop requests share one budget; owner directory operations have their own budget.
 bucket:=case when coalesce(p_shop_id,s.shop_id) is not null then 'shop:'||coalesce(p_shop_id,s.shop_id)::text else 'owner:'||s.owner_id::text end;
 ceiling:=600;
 insert into retail_request_windows(scope,window_start,requests) values(bucket,date_trunc('minute',now()),1)
 on conflict(scope) do update set
  requests=case when retail_request_windows.window_start=excluded.window_start then least(retail_request_windows.requests+1,601) else 1 end,
  window_start=excluded.window_start
 returning requests into used;
 return jsonb_build_object('allowed',used<=ceiling,'retryAfter',greatest(1,ceil(extract(epoch from date_trunc('minute',now())+interval '1 minute'-now())))::integer);
end $$;
revoke all on function public.retail_request_limit(uuid,uuid) from public;
grant execute on function public.retail_request_limit(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
