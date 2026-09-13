create table if not exists public.retail_feature_flags(
  shop_id uuid not null references public.shops(id) on delete cascade,
  flag text not null check(flag in ('accounting','gst','bulk_import','recurring_billing','ocr_jobs')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(shop_id,flag)
);
alter table public.retail_feature_flags enable row level security;
revoke all on public.retail_feature_flags from public,anon,authenticated;

create or replace function public.retail_feature_flags(p_token uuid,p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 return coalesce((select jsonb_object_agg(flag,enabled) from retail_feature_flags where shop_id=p_shop_id),'{}'::jsonb);
end $$;
revoke all on function public.retail_feature_flags(uuid,uuid) from public;
grant execute on function public.retail_feature_flags(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
