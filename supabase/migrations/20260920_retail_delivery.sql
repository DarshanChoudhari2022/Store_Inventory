-- Repair sessions issued before role metadata was introduced.
update app_sessions s set staff_role=u.role from shop_staff u
where s.staff_id=u.id and s.staff_role is distinct from u.role;

create or replace function public.retail_delivery_settings(
 p_token uuid,p_shop_id uuid,p_id uuid,p_route text,p_skip_dates date[]
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
 if p_route is null or length(trim(p_route))>80 or p_skip_dates is null or cardinality(p_skip_dates)>366 or array_position(p_skip_dates,null) is not null then raise exception 'Use a route up to 80 characters and up to 366 valid skip dates'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 update retail_recurring set route=trim(p_route),skip_dates=array(select distinct d from unnest(p_skip_dates) d order by d)
 where id=p_id and shop_id=p_shop_id;
 if not found then raise exception 'Template not found'; end if;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.retail_delivery_settings(uuid,uuid,uuid,text,date[]) from public;
grant execute on function public.retail_delivery_settings(uuid,uuid,uuid,text,date[]) to anon,authenticated;

create or replace function public.retail_delivery_list(p_token uuid,p_shop_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare output jsonb;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
 if p_date is null or p_date<(now() at time zone 'Asia/Kolkata')::date or p_date>(now() at time zone 'Asia/Kolkata')::date+366 then raise exception 'Choose today or a date within the next year'; end if;
 -- Recursive stepping matches the billing engine's month-end clamping exactly.
 with recursive due as (
  select r.id,r.next_date as day,r.cadence from retail_recurring r
  join shops h on h.id=r.shop_id and h.active
  where r.shop_id=p_shop_id and r.active and r.next_date<=p_date
  union all
  select id,case cadence when 'daily' then day+1 when 'weekly' then day+7 else (day+interval '1 month')::date end,cadence from due where day<p_date
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'template',r.name,'route',r.route,'customer',c.name,'phone',c.phone,'address',c.address,'lines',r.lines,'date',p_date) order by r.route,c.name,r.id),'[]') into output
 from due d join retail_recurring r on r.id=d.id join retail_contacts c on c.id=r.customer_id and c.shop_id=p_shop_id
 where d.day=p_date and not p_date=any(r.skip_dates);
 return output;
end $$;
revoke all on function public.retail_delivery_list(uuid,uuid,date) from public;
grant execute on function public.retail_delivery_list(uuid,uuid,date) to anon,authenticated;
notify pgrst,'reload schema';
