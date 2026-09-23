-- Fast owner dashboards for 500+ shops:
-- avoid one count subquery per shop and reuse the report projection for today's owner totals.
create index if not exists items_shop_stock_reorder_idx on public.items(shop_id, stock, reorder_level);
create index if not exists shops_created_id_idx on public.shops(created_at, id);

create or replace function public.list_shops(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 return coalesce((
  with product_counts as (
   select shop_id, count(*)::integer as item_count
   from items
   group by shop_id
  )
  select jsonb_agg(
   jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'area', s.area,
    'username', s.username,
    'active', s.active,
    'itemCount', coalesce(pc.item_count, 0)
   )
   order by s.created_at, s.id
  )
  from shops s
  left join product_counts pc on pc.shop_id = s.id
 ), '[]'::jsonb);
end $$;

create or replace function public.owner_summary(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare d date := (now() at time zone 'Asia/Kolkata')::date;
begin
 if not is_owner_session(p_token) then raise exception 'Owner access required'; end if;
 return jsonb_build_object(
  'shopCount', (select count(*) from shops),
  'revenue', coalesce((select sum(sales) from retail_report_daily where day = d), 0),
  'profit', coalesce((select sum(gross) from retail_report_daily where day = d), 0),
  'inventoryValue', coalesce((select sum(stock * buying_price) from items), 0),
  'lowStockCount', (select count(*) from items where stock <= reorder_level)
 );
end $$;

revoke all on function public.list_shops(uuid), public.owner_summary(uuid) from public;
grant execute on function public.list_shops(uuid), public.owner_summary(uuid) to anon,authenticated;
notify pgrst,'reload schema';
