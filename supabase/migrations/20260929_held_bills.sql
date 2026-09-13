create table if not exists retail_held_bills (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references shops(id),
 label text not null,draft jsonb not null,version integer not null default 1,
 status text not null default 'open' check(status in ('open','invoiced','cancelled')),
 invoice_id uuid references retail_invoices(id),updated_at timestamptz not null default now()
);
alter table retail_held_bills enable row level security;
revoke all on retail_held_bills from public,anon,authenticated;
create index if not exists held_bills_shop_open on retail_held_bills(shop_id,updated_at desc) where status='open';

create or replace function retail_hold(p_token uuid,p_shop_id uuid,p_request_id uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare held retail_held_bills%rowtype; old retail_requests%rowtype;payload jsonb:=jsonb_build_object('action','hold:'||p_action,'data',p_data);
 output jsonb;line jsonb;v_draft jsonb:=p_data->'draft';
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(h) order by updated_at desc) from retail_held_bills h where shop_id=p_shop_id and status='open'),'[]');end if;
 if p_request_id is null then raise exception 'Request ID required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 select * into old from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then if old.payload<>payload then raise exception 'Request reused with different details';end if;return old.result;end if;
 if nullif(p_data->>'id','') is not null then
  select * into held from retail_held_bills where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update;
  if not found or held.status<>'open' or held.version is distinct from (p_data->>'version')::integer then raise exception 'Held bill changed. Refresh and reopen it';end if;
 end if;
 if p_action='save' then
  if length(trim(coalesce(p_data->>'label',''))) not between 1 and 80 or v_draft is null or jsonb_typeof(v_draft)<>'object' or octet_length(v_draft::text)>200000
   or jsonb_typeof(v_draft->'cart') is distinct from 'array' then raise exception 'Enter a name and a valid cart';end if;
  if jsonb_array_length(v_draft->'cart') not between 1 and 200 then raise exception 'Hold between 1 and 200 product lines';end if;
  for line in select value from jsonb_array_elements(v_draft->'cart') loop
   if not exists(select 1 from items where id=(line->>'id')::uuid and shop_id=p_shop_id) then raise exception 'Product not found in this shop';end if;
  end loop;
  if nullif(v_draft->>'contactId','') is not null and not exists(select 1 from retail_contacts where id=(v_draft->>'contactId')::uuid and shop_id=p_shop_id and kind='customer') then raise exception 'Customer not found';end if;
  if held.id is null then
   if (select count(*) from retail_held_bills where shop_id=p_shop_id and status='open')>=50 then raise exception 'Finish or discard a held bill before adding more';end if;
   insert into retail_held_bills(shop_id,label,draft) values(p_shop_id,trim(p_data->>'label'),v_draft) returning * into held;
  else update retail_held_bills set label=trim(p_data->>'label'),draft=v_draft,version=version+1,updated_at=now() where id=held.id returning * into held;end if;
 elsif p_action='cancel' and held.id is not null then
  update retail_held_bills set status='cancelled',version=version+1,updated_at=now() where id=held.id returning * into held;
 else raise exception 'Unknown held bill action';end if;
 output:=to_jsonb(held);insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,payload,output);return output;
end $$;
revoke all on function retail_hold(uuid,uuid,uuid,text,jsonb) from public;
grant execute on function retail_hold(uuid,uuid,uuid,text,jsonb) to anon,authenticated;

create or replace function retail_counter_checkout(p_token uuid,p_shop_id uuid,p_request_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare held retail_held_bills%rowtype;output jsonb;existing retail_requests%rowtype;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 select * into existing from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 -- Let the inner checkout verify the complete retry payload before returning it.
 if p_data->'held'->>'id' is not null and existing.request_id is null then
  select * into held from retail_held_bills where id=(p_data->'held'->>'id')::uuid and shop_id=p_shop_id for update;
  if not found or held.status<>'open' or held.version is distinct from (p_data->'held'->>'version')::integer then raise exception 'Held bill changed or was already invoiced. Refresh the held bills list';end if;
 end if;
 if p_data->>'method'='split' then output:=retail_split_checkout(p_token,p_shop_id,p_request_id,p_data);
 else output:=retail_action(p_token,p_shop_id,p_request_id,'checkout',p_data);end if;
 if held.id is not null then update retail_held_bills set status='invoiced',invoice_id=(output->>'id')::uuid,version=version+1,updated_at=now() where id=held.id;end if;
 return output;
end $$;
revoke all on function retail_counter_checkout(uuid,uuid,uuid,jsonb) from public;
grant execute on function retail_counter_checkout(uuid,uuid,uuid,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
