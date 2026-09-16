-- Self-service password reset for shop users and the owner (super admin).
-- Both functions verify the current password before updating and revoke other sessions.

-- 1. Shop user changes their own password while logged in.
create or replace function public.reset_own_shop_password(
  p_token uuid,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sess app_sessions%rowtype;
  shop_row shops%rowtype;
begin
  -- Validate the session is a shop session
  select * into sess from app_sessions where token = p_token and expires_at > now();
  if not found or sess.role <> 'shop' then
    raise exception 'Shop session required';
  end if;

  -- Validate new password length
  if p_new_password is null or length(p_new_password) < 12 then
    raise exception 'VALIDATION';
  end if;

  -- Verify current password
  select * into shop_row
  from shops
  where id = sess.shop_id
    and password_hash = crypt(p_current_password, password_hash);

  if not found then
    raise exception 'Current password is incorrect';
  end if;

  -- Update password
  update shops
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = sess.shop_id;

  -- Revoke all other sessions for this shop (keep the current one)
  delete from app_sessions
  where shop_id = sess.shop_id
    and token <> p_token;

  return jsonb_build_object('ok', true, 'shopName', shop_row.name);
end;
$$;

-- 2. Owner (super admin) changes their own password while logged in.
create or replace function public.reset_owner_password(
  p_token uuid,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sess app_sessions%rowtype;
  owner_row owner_accounts%rowtype;
begin
  -- Validate the session is an owner session
  if not is_owner_session(p_token) then
    raise exception 'Owner access required';
  end if;

  select * into sess from app_sessions where token = p_token and expires_at > now();

  -- Validate new password length
  if p_new_password is null or length(p_new_password) < 12 then
    raise exception 'VALIDATION';
  end if;

  -- Verify current password against the first owner account
  -- (the system has a single owner account)
  select * into owner_row
  from owner_accounts
  where password_hash = crypt(p_current_password, password_hash)
  limit 1;

  if not found then
    raise exception 'Current password is incorrect';
  end if;

  -- Update password
  update owner_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = owner_row.id;

  -- Revoke all other owner sessions (keep the current one)
  delete from app_sessions
  where role = 'owner'
    and token <> p_token;

  return jsonb_build_object('ok', true);
end;
$$;

-- Permissions
revoke all on function public.reset_own_shop_password(uuid, text, text) from public;
revoke all on function public.reset_owner_password(uuid, text, text) from public;
grant execute on function public.reset_own_shop_password(uuid, text, text) to anon, authenticated;
grant execute on function public.reset_owner_password(uuid, text, text) to anon, authenticated;
