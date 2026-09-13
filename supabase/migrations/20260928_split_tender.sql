alter table retail_invoices add column if not exists tenders jsonb not null default '{}';
alter table retail_invoices drop constraint if exists retail_invoices_method_check;
alter table retail_invoices add constraint retail_invoices_method_check check(method in ('cash','upi','card','credit','split'));

create or replace function retail_split_checkout(p_token uuid,p_shop_id uuid,p_request_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare old retail_requests%rowtype;payload jsonb:=jsonb_build_object('action','split_checkout','data',p_data);
 result jsonb;v_tenders jsonb:=p_data->'tenders';entry record;amount numeric;paid numeric:=0;parts integer:=0;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if p_request_id is null then raise exception 'Request ID required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 select * into old from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if old.payload<>payload then raise exception 'Request reused with different details';end if;
  result:=old.result;
 else
  if v_tenders is null or jsonb_typeof(v_tenders)<>'object' then raise exception 'Enter split payment amounts';end if;
  for entry in select * from jsonb_each_text(v_tenders) loop
   amount:=entry.value::numeric;
   if entry.key not in ('cash','upi','card') or amount is null or amount not between 0 and 9999999999.99 or round(amount,2)<>amount then raise exception 'Invalid split payment';end if;
   paid:=paid+amount;if amount>0 then parts:=parts+1;end if;
  end loop;
  if parts<2 then raise exception 'Use at least two payment methods for a split bill';end if;
  result:=retail_action(p_token,p_shop_id,md5('split:'||p_request_id::text)::uuid,'checkout',
    (p_data-'tenders')||jsonb_build_object('method','cash','paid',paid));
  update retail_invoices set method='split',tenders=v_tenders where id=(result->>'id')::uuid and shop_id=p_shop_id returning to_jsonb(retail_invoices.*) into result;
  insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,payload,result);
 end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then return retail_redact_cost(result);end if;
 return result;
end $$;
revoke all on function retail_split_checkout(uuid,uuid,uuid,jsonb) from public;
grant execute on function retail_split_checkout(uuid,uuid,uuid,jsonb) to anon,authenticated;

create or replace function public.retail_cash(p_shop uuid,p_since timestamptz) returns numeric language sql security definer set search_path=public,extensions as $$
 select coalesce((select sum(case when method='cash' then paid when method='split' then coalesce((tenders->>'cash')::numeric,0) else 0 end) from retail_invoices where shop_id=p_shop and created_at>=p_since),0)
 -coalesce((select sum(paid) from retail_purchases where shop_id=p_shop and method='cash' and created_at>=p_since),0)
 +coalesce((select sum(case when c.kind='customer' then p.amount else -p.amount end) from retail_payments p join retail_contacts c on c.id=p.contact_id where p.shop_id=p_shop and p.method='cash' and p.created_at>=p_since),0)
 -coalesce((select sum(amount) from retail_expenses where shop_id=p_shop and method='cash' and created_at>=p_since),0)
 -coalesce((select sum(refund) from retail_returns where shop_id=p_shop and method='cash' and created_at>=p_since),0);
$$;
revoke all on function retail_cash(uuid,timestamptz) from public,anon,authenticated;
notify pgrst,'reload schema';
