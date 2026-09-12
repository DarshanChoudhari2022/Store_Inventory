alter table public.app_sessions add column if not exists owner_id uuid references public.owner_accounts(id);
create table if not exists public.shop_staff (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 name text not null, username text not null unique, password_hash text not null,
 active boolean not null default true, created_at timestamptz not null default now()
);
alter table shop_staff enable row level security;
revoke all on shop_staff from public,anon,authenticated;
alter table app_sessions add column if not exists staff_id uuid references shop_staff(id) on delete cascade;
create or replace function can_access_shop(p_token uuid,p_shop_id uuid) returns boolean language sql security definer set search_path=public,extensions as $$
 select exists(select 1 from app_sessions s join shops h on h.id=p_shop_id where s.token=p_token and s.expires_at>now() and (s.role='owner' or (s.role='shop' and s.shop_id=p_shop_id and h.active and (s.staff_id is null or exists(select 1 from shop_staff u where u.id=s.staff_id and u.shop_id=p_shop_id and u.active)))));
$$;
create table if not exists public.login_attempts (
 username_hash text primary key, failures integer not null default 0, window_started timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public,anon,authenticated;

-- Failures return an error value so the throttle update commits. Raising an
-- exception would roll the counter back and defeat the limit.
create or replace function public.login_user(p_username text,p_password text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare login_name text:=trim(coalesce(p_username,'')); key_hash text; attempts login_attempts%rowtype;
 owner_row owner_accounts%rowtype; shop_row shops%rowtype; staff_row shop_staff%rowtype; new_token uuid;
begin
 if length(login_name) not between 1 and 120 or octet_length(coalesce(p_password,'')) not between 1 and 72 then return jsonb_build_object('error','Invalid username or password'); end if;
 key_hash:=encode(digest(lower(login_name),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('login:'||key_hash,0));
 delete from login_attempts where window_started < now()-interval '1 day';
 insert into login_attempts(username_hash) values(key_hash) on conflict do nothing;
 select * into attempts from login_attempts where username_hash=key_hash for update;
 if attempts.window_started < now()-interval '15 minutes' then
  update login_attempts set failures=0,window_started=now() where username_hash=key_hash;
  attempts.failures:=0;
 end if;
 if attempts.failures>=10 then return jsonb_build_object('error','Too many sign-in attempts. Try again in 15 minutes.'); end if;
 select * into owner_row from owner_accounts where username=login_name and password_hash=crypt(p_password,password_hash);
 if found then
  delete from login_attempts where username_hash=key_hash;
  delete from app_sessions where expires_at<=now();
  insert into app_sessions(role,owner_id) values('owner',owner_row.id) returning token into new_token;
  return jsonb_build_object('token',new_token,'role','owner');
 end if;
 select * into shop_row from shops where username=login_name and active and password_hash=crypt(p_password,password_hash);
 if found then
  delete from login_attempts where username_hash=key_hash;
  delete from app_sessions where expires_at<=now();
  insert into app_sessions(role,shop_id) values('shop',shop_row.id) returning token into new_token;
  return jsonb_build_object('token',new_token,'role','shop','shopId',shop_row.id,'shopName',shop_row.name);
 end if;
 select u.* into staff_row from shop_staff u join shops h on h.id=u.shop_id where u.username=login_name and u.active and h.active and u.password_hash=crypt(p_password,u.password_hash);
 if found then
  delete from login_attempts where username_hash=key_hash;
  delete from app_sessions where expires_at<=now();
  insert into app_sessions(role,shop_id,staff_id) values('shop',staff_row.shop_id,staff_row.id) returning token into new_token;
  return jsonb_build_object('token',new_token,'role','shop','shopId',staff_row.shop_id,'staffName',staff_row.name);
 end if;
 update login_attempts set failures=failures+1 where username_hash=key_hash;
 return jsonb_build_object('error','Invalid username or password');
end $$;
revoke all on function public.login_user(text,text) from public;
grant execute on function public.login_user(text,text) to anon,authenticated;
notify pgrst,'reload schema';
