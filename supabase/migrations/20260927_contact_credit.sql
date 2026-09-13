alter table retail_contacts add column if not exists credit_limit numeric(14,2) check(credit_limit between 0 and 999999999999.99);
alter table retail_contacts add column if not exists payment_terms_days integer not null default 0 check(payment_terms_days between 0 and 365);
alter table retail_invoices add column if not exists due_date date;

create or replace function retail_contact_update(p_token uuid,p_shop_id uuid,p_request_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare old retail_requests%rowtype;payload jsonb:=jsonb_build_object('action','contact_edit','data',p_data);
 result jsonb;lim numeric:=nullif(p_data->>'creditLimit','')::numeric;terms integer:=(p_data->>'paymentTerms')::integer;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required';end if;
 if p_request_id is null then raise exception 'Request ID required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 select * into old from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then if old.payload<>payload then raise exception 'Request reused with different data';end if;return old.result;end if;
 if length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 or length(coalesce(p_data->>'phone',''))>30
  or length(coalesce(p_data->>'address',''))>500 or length(coalesce(p_data->>'gstin','')) not in (0,15)
  or terms is null or terms not between 0 and 365 or (lim is not null and (lim not between 0 and 999999999999.99 or round(lim,2)<>lim)) then raise exception 'Check contact details and credit terms';end if;
 update retail_contacts set name=trim(p_data->>'name'),phone=coalesce(p_data->>'phone',''),address=coalesce(p_data->>'address',''),
  gstin=upper(coalesce(p_data->>'gstin','')),credit_limit=lim,payment_terms_days=terms
 where id=(p_data->>'id')::uuid and shop_id=p_shop_id returning jsonb_build_object('id',id) into result;
 if not found then raise exception 'Contact not found';end if;
 insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,payload,result);
 return result;
end $$;
revoke all on function retail_contact_update(uuid,uuid,uuid,jsonb) from public;
grant execute on function retail_contact_update(uuid,uuid,uuid,jsonb) to anon,authenticated;

create or replace function retail_check_credit() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare c retail_contacts%rowtype;
begin
 if new.customer_id is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text,0));
 select * into c from retail_contacts where id=new.customer_id and shop_id=new.shop_id and kind='customer';
 if not found then raise exception 'Customer not found';end if;
 if new.total>new.paid and c.credit_limit is not null and retail_balance(c.id)+new.total-new.paid>c.credit_limit then
  raise exception 'Customer credit limit exceeded. Collect more payment or ask a manager to update the limit';
 end if;
 new.due_date:=coalesce(new.due_date,(new.created_at at time zone 'Asia/Kolkata')::date+c.payment_terms_days);
 return new;
end $$;
revoke all on function retail_check_credit() from public,anon,authenticated;
drop trigger if exists retail_check_credit on retail_invoices;
create trigger retail_check_credit before insert on retail_invoices for each row execute function retail_check_credit();
notify pgrst,'reload schema';
