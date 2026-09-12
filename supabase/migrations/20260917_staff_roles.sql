-- Cashier permissions for retail staff accounts.
alter table public.shop_staff add column if not exists role text not null default 'cashier' check(role in ('cashier','manager'));
alter table public.app_sessions add column if not exists staff_role text;

create or replace function public.login_user(p_username text,p_password text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare login_name text:=trim(coalesce(p_username,'')); key_hash text; attempts login_attempts%rowtype;
 owner_row owner_accounts%rowtype; shop_row shops%rowtype; staff_row shop_staff%rowtype; new_token uuid;
begin
 if length(login_name) not between 1 and 120 or octet_length(coalesce(p_password,'')) not between 1 and 72 then return jsonb_build_object('error','Invalid username or password'); end if;
 key_hash:=encode(digest(lower(login_name),'sha256'),'hex'); perform pg_advisory_xact_lock(hashtextextended('login:'||key_hash,0));
 delete from login_attempts where window_started < now()-interval '1 day'; insert into login_attempts(username_hash) values(key_hash) on conflict do nothing;
 select * into attempts from login_attempts where username_hash=key_hash for update;
 if attempts.window_started < now()-interval '15 minutes' then update login_attempts set failures=0,window_started=now() where username_hash=key_hash; attempts.failures:=0; end if;
 if attempts.failures>=10 then return jsonb_build_object('error','Too many sign-in attempts. Try again in 15 minutes.'); end if;
 select * into owner_row from owner_accounts where username=login_name and password_hash=crypt(p_password,password_hash);
 if found then delete from login_attempts where username_hash=key_hash; delete from app_sessions where expires_at<=now(); insert into app_sessions(role,owner_id) values('owner',owner_row.id) returning token into new_token; return jsonb_build_object('token',new_token,'role','owner'); end if;
 select * into shop_row from shops where username=login_name and active and password_hash=crypt(p_password,password_hash);
 if found then delete from login_attempts where username_hash=key_hash; delete from app_sessions where expires_at<=now(); insert into app_sessions(role,shop_id) values('shop',shop_row.id) returning token into new_token; return jsonb_build_object('token',new_token,'role','shop','shopId',shop_row.id,'shopName',shop_row.name,'staffRole','manager'); end if;
 select u.* into staff_row from shop_staff u join shops h on h.id=u.shop_id where u.username=login_name and u.active and h.active and u.password_hash=crypt(p_password,u.password_hash);
 if found then delete from login_attempts where username_hash=key_hash; delete from app_sessions where expires_at<=now(); insert into app_sessions(role,shop_id,staff_id,staff_role) values('shop',staff_row.shop_id,staff_row.id,staff_row.role) returning token into new_token; return jsonb_build_object('token',new_token,'role','shop','shopId',staff_row.shop_id,'staffName',staff_row.name,'staffRole',staff_row.role); end if;
 update login_attempts set failures=failures+1 where username_hash=key_hash; return jsonb_build_object('error','Invalid username or password');
end $$;

create or replace function public.manage_shop_staff(p_token uuid,p_shop_id uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare target shop_staff%rowtype; username_value text; password_value text; output jsonb; role_value text;
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not exists(select 1 from shops where id=p_shop_id) then raise exception 'Shop not found'; end if;
 if p_action='create' then
  username_value:=lower(trim(coalesce(p_data->>'username',''))); password_value:=p_data->>'password'; role_value:=coalesce(p_data->>'role','cashier');
  if username_value !~ '^[a-z0-9][a-z0-9._-]{2,79}$' or length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 or octet_length(coalesce(password_value,'')) not between 12 and 72 or role_value not in ('cashier','manager') then raise exception 'Enter a name, valid role, username and password of 12–72 bytes'; end if;
  perform pg_advisory_xact_lock(hashtextextended('username:'||username_value,0));
  if exists(select 1 from shops where lower(username)=username_value) or exists(select 1 from owner_accounts where lower(username)=username_value) or exists(select 1 from shop_staff where lower(username)=username_value) then raise exception 'Username already exists'; end if;
  insert into shop_staff(shop_id,name,username,password_hash,role) values(p_shop_id,trim(p_data->>'name'),username_value,crypt(password_value,gen_salt('bf')),role_value);
 elsif p_action in ('pause','resume','reset') then
  select * into target from shop_staff where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update; if not found then raise exception 'Staff account not found in this shop'; end if;
  if p_action='reset' then password_value:=p_data->>'password'; if octet_length(coalesce(password_value,'')) not between 12 and 72 then raise exception 'Password must be 12–72 bytes'; end if; update shop_staff set password_hash=crypt(password_value,gen_salt('bf')) where id=target.id;
  else update shop_staff set active=(p_action='resume') where id=target.id; end if; delete from app_sessions where staff_id=target.id;
 elsif p_action<>'list' or p_action is null then raise exception 'Unknown staff action'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'username',username,'role',role,'active',active) order by created_at),'[]') into output from shop_staff where shop_id=p_shop_id; return output;
end $$;
notify pgrst,'reload schema';
