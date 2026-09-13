-- Bounded report export pages keep large shops responsive and memory-safe.
create or replace function public.retail_report_export_page(
  p_token uuid, p_shop_id uuid, p_from date, p_to date,
  p_offset integer default 0, p_limit integer default 500
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb; cashier boolean := exists(select 1 from app_sessions where token=p_token and staff_role='cashier');
begin
  if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 366 days'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>500 then raise exception 'Invalid export page'; end if;
  select jsonb_build_object(
    'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from (select i.* from retail_invoices i where i.shop_id=p_shop_id and i.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and i.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata') order by i.created_at desc,i.id limit p_limit offset p_offset) i),'[]'),
    'returns',case when p_offset=0 then coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('total',i.total,'tax',i.tax,'subtotal',i.subtotal,'cost',i.cost,'number',i.number) order by r.created_at desc,r.id) from retail_returns r join retail_invoices i on i.id=r.invoice_id where r.shop_id=p_shop_id and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and r.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]') else '[]'::jsonb end,
    'hasMore',(select count(*)>p_offset+p_limit from retail_invoices where shop_id=p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata'))
  ) into result;
  if cashier then result:=retail_redact_cost(result); end if;
  return result;
end $$;
revoke all on function retail_report_export_page(uuid,uuid,date,date,integer,integer) from public;
grant execute on function retail_report_export_page(uuid,uuid,date,date,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
