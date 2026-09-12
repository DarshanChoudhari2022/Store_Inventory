-- Explicit opt-in; existing recurring templates remain manual.
alter table retail_recurring add column if not exists automatic boolean not null default false;
alter table retail_recurring add column if not exists last_attempt_at timestamptz;
alter table retail_recurring add column if not exists last_error text;

create or replace function public.retail_schedule(p_token uuid,p_shop_id uuid,p_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) or not exists(select 1 from shops where id=p_shop_id and active) then raise exception 'Shop access required'; end if;
 update retail_recurring set automatic=p_enabled,last_error=null,last_attempt_at=null where id=p_id and shop_id=p_shop_id;
 if not found then raise exception 'Template not found'; end if;
end $$;
revoke all on function public.retail_schedule(uuid,uuid,uuid,boolean) from public;
grant execute on function public.retail_schedule(uuid,uuid,uuid,boolean) to anon,authenticated;

-- Only the database scheduler/admin can call this; no browser/service secret is exposed.
create or replace function public.retail_run_schedules() returns integer
language plpgsql security definer set search_path=public,extensions as $$
declare candidate record; r retail_recurring%rowtype; session_token uuid; request_id uuid; generated integer:=0;
begin
 for candidate in select t.id,t.shop_id from retail_recurring t join shops s on s.id=t.shop_id
 where s.active and t.active and t.automatic and t.next_date <= (now() at time zone 'Asia/Kolkata')::date
 and (t.last_error is null or t.last_attempt_at < now()-interval '15 minutes') order by t.shop_id,t.id limit 100 loop
  perform pg_advisory_xact_lock(hashtextextended(candidate.shop_id::text,0));
  select * into r from retail_recurring where id=candidate.id and active and automatic and next_date <= (now() at time zone 'Asia/Kolkata')::date for update;
  if not found or not exists(select 1 from shops where id=candidate.shop_id and active) then continue; end if;
  session_token:=null;
  begin
   insert into app_sessions(role,shop_id,expires_at) values('shop',r.shop_id,now()+interval '5 minutes') returning token into session_token;
   request_id:=md5('retail-schedule:'||r.id::text||':'||r.next_date::text)::uuid;
   perform retail_action(session_token,r.shop_id,request_id,'recurring_run',jsonb_build_object('id',r.id));
   delete from app_sessions where token=session_token;
   update retail_recurring set last_attempt_at=now(),last_error=null where id=r.id;
   generated:=generated+1;
  exception when others then
   -- The invoice/stock writes and temporary session roll back together.
   update retail_recurring set last_attempt_at=now(),last_error=left(sqlerrm,500) where id=r.id;
  end;
 end loop;
 return generated;
end $$;
revoke all on function public.retail_run_schedules() from public,anon,authenticated;
notify pgrst,'reload schema';
