create or replace function public.retail_session_profile(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare s app_sessions%rowtype; role_name text;
begin
 select * into s from app_sessions where token=p_token and expires_at>now();
 if not found then return null;end if;
 if s.role='owner' then
  if not exists(select 1 from owner_accounts where id=s.owner_id) then return null;end if;
 else
  if not can_access_shop(p_token,s.shop_id) then return null;end if;
 end if;
 role_name:=coalesce((select role from shop_staff where id=s.staff_id),'manager');
 return jsonb_build_object('role',s.role,'shopId',s.shop_id,'staffRole',role_name,'expiresAt',s.expires_at);
end $$;
revoke all on function retail_session_profile(uuid) from public;
grant execute on function retail_session_profile(uuid) to anon,authenticated;
