create or replace function public.retail_feature_flag_set(p_token uuid,p_shop_id uuid,p_flag text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare flags jsonb;
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 if not exists(select 1 from shops where id=p_shop_id) then raise exception 'Shop not found'; end if;
 if p_flag not in ('accounting','gst','bulk_import','recurring_billing','ocr_jobs') then raise exception 'Unknown feature flag'; end if;
 insert into retail_feature_flags(shop_id,flag,enabled,updated_at)
 values(p_shop_id,p_flag,coalesce(p_enabled,false),now())
 on conflict(shop_id,flag) do update set enabled=excluded.enabled,updated_at=now();
 select coalesce(jsonb_object_agg(flag,enabled),'{}'::jsonb) into flags from retail_feature_flags where shop_id=p_shop_id;
 return flags;
end $$;
revoke all on function public.retail_feature_flag_set(uuid,uuid,text,boolean) from public;
grant execute on function public.retail_feature_flag_set(uuid,uuid,text,boolean) to anon,authenticated;

notify pgrst,'reload schema';
