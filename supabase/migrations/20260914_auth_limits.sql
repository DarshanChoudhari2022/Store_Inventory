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
 owner_row owner_accounts%rowtype; shop_row shops%rowtype; new_token uuid;
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
  insert into app_sessions(role) values('owner') returning token into new_token;
  return jsonb_build_object('token',new_token,'role','owner');
 end if;
 select * into shop_row from shops where username=login_name and active and password_hash=crypt(p_password,password_hash);
 if found then
  delete from login_attempts where username_hash=key_hash;
  delete from app_sessions where expires_at<=now();
  insert into app_sessions(role,shop_id) values('shop',shop_row.id) returning token into new_token;
  return jsonb_build_object('token',new_token,'role','shop','shopId',shop_row.id,'shopName',shop_row.name);
 end if;
 update login_attempts set failures=failures+1 where username_hash=key_hash;
 return jsonb_build_object('error','Invalid username or password');
end $$;
revoke all on function public.login_user(text,text) from public;
grant execute on function public.login_user(text,text) to anon,authenticated;
notify pgrst,'reload schema';
