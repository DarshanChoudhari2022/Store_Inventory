-- Delete confirmation is checked by the server, independently of the UI.
create table if not exists public.product_deletions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 item_id uuid not null, snapshot jsonb not null, actor_role text not null,
 owner_id uuid, created_at timestamptz not null default now()
);
alter table product_deletions enable row level security;
alter table product_deletions add column if not exists staff_id uuid;
revoke all on product_deletions from public,anon,authenticated;

create or replace function public.delete_item(p_token uuid,p_item_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin raise exception 'Password confirmation required. Reload the app.'; end $$;

create or replace function public.delete_item_confirmed(p_token uuid,p_item_id uuid,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare actor app_sessions%rowtype; target items%rowtype; expected_hash text;
 key_hash text; attempt login_attempts%rowtype;
begin
 select * into actor from app_sessions where token=p_token and expires_at>now();
 if not found then return jsonb_build_object('error','Session expired. Sign in again.'); end if;
 select * into target from items where id=p_item_id;
 if not found or not can_access_shop(p_token,target.shop_id) then return jsonb_build_object('error','Product unavailable or shop access denied.'); end if;
 if actor.role='owner' then
  if actor.owner_id is null then return jsonb_build_object('error','Sign out and sign in again before deleting a product.'); end if;
  select password_hash into expected_hash from owner_accounts where id=actor.owner_id;
 elsif actor.staff_id is not null then select password_hash into expected_hash from shop_staff where id=actor.staff_id and shop_id=actor.shop_id and active;
 else select password_hash into expected_hash from shops where id=actor.shop_id and active; end if;
 key_hash:=encode(digest('delete:'||coalesce(actor.owner_id,actor.staff_id,actor.shop_id)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(key_hash,0));
 insert into login_attempts(username_hash) values(key_hash) on conflict do nothing;
 select * into attempt from login_attempts where username_hash=key_hash for update;
 if attempt.window_started<now()-interval '15 minutes' then
  update login_attempts set failures=0,window_started=now() where username_hash=key_hash; attempt.failures:=0;
 end if;
 if attempt.failures>=5 then return jsonb_build_object('error','Too many password attempts. Try again in 15 minutes.'); end if;
 if expected_hash is null or octet_length(coalesce(p_password,'')) not between 1 and 72 or expected_hash is distinct from crypt(p_password,expected_hash) then
  update login_attempts set failures=failures+1 where username_hash=key_hash;
  return jsonb_build_object('error','Incorrect password. Product was not deleted.');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target.shop_id::text,0));
 if not can_access_shop(p_token,target.shop_id) then return jsonb_build_object('error','Shop access denied.'); end if;
 select * into target from items where id=p_item_id for update;
 if not found then return jsonb_build_object('error','Product already deleted. Reload the catalogue.'); end if;
 -- Retain products referenced by invoices so future returns remain possible.
 if exists(select 1 from retail_invoices i, jsonb_array_elements(i.lines) l where i.shop_id=target.shop_id and l->>'id'=p_item_id::text) then
  return jsonb_build_object('error','This product has bill history. Mark it inactive in Edit to stop selling it while preserving stock and returns.');
 end if;
 if exists(select 1 from retail_recurring r, jsonb_array_elements(r.lines) l where r.shop_id=target.shop_id and r.active and l->>'id'=p_item_id::text) then
  return jsonb_build_object('error','This product is used by a recurring bill. Disable that template first.');
 end if;
 insert into product_deletions(shop_id,item_id,snapshot,actor_role,owner_id,staff_id) values(target.shop_id,target.id,to_jsonb(target),actor.role,actor.owner_id,actor.staff_id);
 delete from items where id=p_item_id;
 delete from login_attempts where username_hash=key_hash;
 return jsonb_build_object('id',p_item_id,'deleted',true);
end $$;
revoke all on function public.delete_item_confirmed(uuid,uuid,text) from public;
grant execute on function public.delete_item_confirmed(uuid,uuid,text) to anon,authenticated;
-- Legacy sale RPCs must also respect the catalogue's availability switch.
create or replace function public.check_sale_product_active() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
 if exists(select 1 from items where id=new.item_id and not is_active) then raise exception 'Product is inactive'; end if;
 return new;
end $$;
revoke all on function public.check_sale_product_active() from public,anon,authenticated;
drop trigger if exists check_sale_product_active on sales;
create trigger check_sale_product_active before insert on sales for each row execute function public.check_sale_product_active();
notify pgrst,'reload schema';
