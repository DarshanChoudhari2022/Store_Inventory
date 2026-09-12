-- Individual operator accounts with full access to exactly one shop.
-- Cashier-only permissions are not represented by this role.
create or replace function public.check_login_name_unique() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare candidate text:=lower(trim(new.username));
begin
 perform pg_advisory_xact_lock(hashtextextended('username:'||candidate,0));
 if exists(select 1 from owner_accounts where lower(trim(username))=candidate and (tg_table_name<>'owner_accounts' or id<>new.id))
 or exists(select 1 from shops where lower(trim(username))=candidate and (tg_table_name<>'shops' or id<>new.id))
 or exists(select 1 from shop_staff where lower(trim(username))=candidate and (tg_table_name<>'shop_staff' or id<>new.id)) then raise exception 'Username already exists'; end if;
 return new;
end $$;
revoke all on function public.check_login_name_unique() from public,anon,authenticated;
drop trigger if exists check_login_name_unique on shops;
create trigger check_login_name_unique before insert or update of username on shops for each row execute function public.check_login_name_unique();
drop trigger if exists check_login_name_unique on owner_accounts;
create trigger check_login_name_unique before insert or update of username on owner_accounts for each row execute function public.check_login_name_unique();
drop trigger if exists check_login_name_unique on shop_staff;
create trigger check_login_name_unique before insert or update of username on shop_staff for each row execute function public.check_login_name_unique();
create or replace function public.manage_shop_staff(p_token uuid,p_shop_id uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare target shop_staff%rowtype; username_value text; password_value text; output jsonb;
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not exists(select 1 from shops where id=p_shop_id) then raise exception 'Shop not found'; end if;
 if p_action='create' then
  username_value:=lower(trim(coalesce(p_data->>'username',''))); password_value:=p_data->>'password';
  if username_value !~ '^[a-z0-9][a-z0-9._-]{2,79}$' or length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 or octet_length(coalesce(password_value,'')) not between 12 and 72 then raise exception 'Enter a name, a 3–80 character username and a password of 12–72 bytes'; end if;
  perform pg_advisory_xact_lock(hashtextextended('username:'||username_value,0));
  if exists(select 1 from shops where lower(username)=username_value) or exists(select 1 from owner_accounts where lower(username)=username_value) or exists(select 1 from shop_staff where lower(username)=username_value) then raise exception 'Username already exists'; end if;
  insert into shop_staff(shop_id,name,username,password_hash) values(p_shop_id,trim(p_data->>'name'),username_value,crypt(password_value,gen_salt('bf')));
 elsif p_action in ('pause','resume','reset') then
  select * into target from shop_staff where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update;
  if not found then raise exception 'Staff account not found in this shop'; end if;
  if p_action='reset' then
   password_value:=p_data->>'password';
   if octet_length(coalesce(password_value,'')) not between 12 and 72 then raise exception 'Password must be 12–72 bytes'; end if;
   update shop_staff set password_hash=crypt(password_value,gen_salt('bf')) where id=target.id;
  else update shop_staff set active=(p_action='resume') where id=target.id; end if;
  delete from app_sessions where staff_id=target.id;
 elsif p_action<>'list' or p_action is null then raise exception 'Unknown staff action'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'username',username,'active',active) order by created_at),'[]') into output from shop_staff where shop_id=p_shop_id;
 return output;
end $$;
revoke all on function public.manage_shop_staff(uuid,uuid,text,jsonb) from public;
grant execute on function public.manage_shop_staff(uuid,uuid,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
