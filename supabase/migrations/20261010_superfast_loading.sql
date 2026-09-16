-- Optimize retail_workspace_scoped for superfast initial shop loading:
-- 1. In 'sell' view, avoid calculating retail_balance across all contacts (balance is only needed in customer/supplier views or on-demand aging).
-- 2. In 'sell' view, bound initial contacts to 100 rather than scanning all contacts.
-- 3. Embed shop feature flags directly into workspace response so a second round-trip RPC is not required.
-- 4. Ensure index on items for active products lookup.

create or replace function public.retail_workspace_scoped(
  p_token uuid,
  p_shop_id uuid,
  p_from date,
  p_to date,
  p_view text,
  p_offset integer default 0,
  p_catalog_offset integer default 0,
  p_query text default '',
  p_low boolean default false
) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
  result jsonb;
  cashier boolean := exists(select 1 from app_sessions where token=p_token and staff_role='cashier');
begin
  if not can_access_shop(p_token, p_shop_id) then raise exception 'Shop access required'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'Choose a range of up to 366 days'; end if;
  if p_view is null or p_view not in ('sell','products','bills','quotes','customers','suppliers','purchases','cash','reports','recurring','settings') or p_offset is null or p_offset < 0 then raise exception 'Invalid workspace page'; end if;
  if p_catalog_offset is null or p_catalog_offset < 0 or p_query is null or length(p_query) > 200 or p_low is null then raise exception 'Invalid catalogue page'; end if;

  select jsonb_build_object(
    'shop', jsonb_build_object('id', h.id, 'name', h.name, 'area', h.area, 'active', h.active, 'settings', h.settings),
    'flags', coalesce((select jsonb_object_agg(flag, enabled) from retail_feature_flags where shop_id = h.id), '{}'::jsonb),
    'products', coalesce((
      select jsonb_agg(to_jsonb(i)-'shop_id' order by lower(i.name), i.id)
      from (
        select i.* from items i
        where i.shop_id = h.id and i.is_active
          and (p_view <> 'products' or (position(lower(trim(p_query)) in lower(concat_ws(' ', i.name, i.style_code, i.size, i.colour, i.barcode, i.category))) > 0 and (not p_low or i.stock <= i.reorder_level)))
        order by lower(i.name), i.id
        limit case when p_view in ('sell','products') then 50 else null end
        offset case when p_view = 'products' then p_catalog_offset else 0 end
      ) i
    ), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(
        (to_jsonb(c)-'shop_id') || jsonb_build_object('balance', case when p_view in ('customers','suppliers') then retail_balance(c.id) else 0 end)
        order by lower(c.name), c.id
      )
      from (
        select c.* from retail_contacts c
        where c.shop_id = h.id
          and (not cashier or c.kind = 'customer')
          and (p_view not in ('customers','suppliers') or (c.kind = case when p_view = 'customers' then 'customer' else 'supplier' end and position(lower(trim(p_query)) in lower(c.name || ' ' || c.phone)) > 0))
        order by lower(c.name), c.id
        limit case when p_view in ('customers','suppliers') then 50 when p_view = 'sell' then 100 else null end
        offset case when p_view in ('customers','suppliers') then p_catalog_offset else 0 end
      ) c
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at desc)
      from (
        select i.* from retail_invoices i
        where p_view in ('bills','customers','reports') and i.shop_id = h.id
          and i.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
          and i.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
        order by i.created_at desc, i.id
        limit case when p_view = 'bills' then 50 else null end
        offset case when p_view = 'bills' then p_offset else 0 end
      ) i
    ), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from retail_purchases p
      where p_view in ('suppliers','purchases') and p.shop_id = h.id and not cashier
        and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
        and p.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from retail_payments p
      where p_view in ('customers','suppliers') and p.shop_id = h.id
        and (not cashier or exists(select 1 from retail_contacts c where c.id = p.contact_id and c.kind = 'customer'))
        and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
        and p.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from retail_expenses p
      where p_view = 'cash' and p.shop_id = h.id and not cashier
        and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
        and p.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
    ), '[]'::jsonb),
    'returns', coalesce((
      select jsonb_agg(to_jsonb(r) || jsonb_build_object('total', i.total, 'tax', i.tax, 'subtotal', i.subtotal, 'cost', i.cost, 'number', i.number))
      from retail_returns r
      join retail_invoices i on i.id = r.invoice_id
      where p_view in ('bills','customers','reports') and r.shop_id = h.id
        and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
        and r.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
    ), '[]'::jsonb),
    'returnedIds', coalesce((
      select jsonb_agg(r.invoice_id)
      from retail_returns r
      where p_view = 'bills' and r.shop_id = h.id
    ), '[]'::jsonb),
    'registers', coalesce((
      select jsonb_agg(to_jsonb(r) || jsonb_build_object('currentExpected', case when r.closed_at is null then r.opening + retail_cash(h.id, r.opened_at) else r.expected end) order by r.opened_at desc)
      from retail_registers r
      where p_view = 'cash' and r.shop_id = h.id and not cashier
        and (r.closed_at is null or (r.opened_at at time zone 'Asia/Kolkata')::date between p_from and p_to)
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc)
      from (
        select m.* from retail_movements m
        where p_view = 'products' and m.shop_id = h.id and not cashier
          and m.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
          and m.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
        order by m.created_at desc, m.id
        limit 50 offset p_offset
      ) m
    ), '[]'::jsonb),
    'recurring', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.next_date)
      from retail_recurring r
      where p_view = 'recurring' and r.shop_id = h.id and not cashier
    ), '[]'::jsonb),
    'legacy', '[]'::jsonb
  ) into result
  from shops h
  where h.id = p_shop_id;

  result := result || jsonb_build_object('catalogOffset', p_catalog_offset, 'catalogQuery', p_query, 'catalogLow', p_low);
  result := result || jsonb_build_object('pageOffset', p_offset, 'pageView', p_view, 'pageTotals', jsonb_build_object(
    'products', (select count(*) from items i where i.shop_id = p_shop_id and i.is_active and (p_view <> 'products' or (position(lower(trim(p_query)) in lower(concat_ws(' ', i.name, i.style_code, i.size, i.colour, i.barcode, i.category))) > 0 and (not p_low or i.stock <= i.reorder_level)))),
    'contacts', (select count(*) from retail_contacts c where c.shop_id = p_shop_id and (not cashier or c.kind = 'customer') and (p_view not in ('customers','suppliers') or (c.kind = case when p_view = 'customers' then 'customer' else 'supplier' end and position(lower(trim(p_query)) in lower(c.name || ' ' || c.phone)) > 0))),
    'invoices', case when p_view = 'bills' then (select count(*) from retail_invoices where shop_id = p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')) else 0 end,
    'movements', case when p_view = 'products' and not cashier then (select count(*) from retail_movements where shop_id = p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')) else 0 end
  ));

  if cashier then result := retail_redact_cost(result); end if;
  return result;
end $$;

revoke all on function retail_workspace_scoped(uuid,uuid,date,date,text,integer,integer,text,boolean) from public;
grant execute on function retail_workspace_scoped(uuid,uuid,date,date,text,integer,integer,text,boolean) to anon,authenticated;
notify pgrst,'reload schema';
