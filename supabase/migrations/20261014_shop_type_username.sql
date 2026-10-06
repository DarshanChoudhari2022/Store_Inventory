-- Clothing shop controls and safe owner username edits.
-- Shop type is stored in shops.settings so existing workspace snapshots keep using the same payload.

create index if not exists shops_lower_username_idx on public.shops(lower(username));

create or replace function public.preserve_shop_type_settings() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
 if old.settings ? 'shopType' and not (new.settings ? 'shopType') then
  new.settings := new.settings || jsonb_build_object('shopType', old.settings->>'shopType');
 end if;
 if not (new.settings ? 'shopType') then
  new.settings := new.settings || jsonb_build_object('shopType', 'general');
 end if;
 return new;
end $$;

drop trigger if exists shops_preserve_shop_type_settings on public.shops;
create trigger shops_preserve_shop_type_settings
before update of settings on public.shops
for each row execute function public.preserve_shop_type_settings();

drop function if exists public.admin_update_shop(uuid,uuid,text,text,boolean);

create or replace function public.admin_update_shop(
 p_token uuid,
 p_shop_id uuid,
 p_name text,
 p_area text,
 p_active boolean,
 p_username text default null,
 p_shop_type text default null
) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
 normalized_username text;
 requested_type text := coalesce(nullif(trim(p_shop_type), ''), 'general');
 current_shop shops%rowtype;
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(trim(coalesce(p_area,''))) not between 1 and 120 or p_active is null then raise exception 'Check shop details'; end if;
 if requested_type not in ('general','clothing') then raise exception 'Choose a valid shop type'; end if;
 select * into current_shop from shops where id=p_shop_id for update;
 if not found then raise exception 'Shop not found'; end if;
 normalized_username := lower(trim(coalesce(nullif(p_username, ''), current_shop.username)));
 if normalized_username !~ '^[a-z0-9][a-z0-9._-]{2,79}$' then raise exception 'Enter a valid shop username'; end if;
 perform pg_advisory_xact_lock(hashtextextended('username:'||normalized_username,0));
 if exists(select 1 from shops where lower(username)=normalized_username and id<>p_shop_id)
    or exists(select 1 from owner_accounts where lower(username)=normalized_username)
    or exists(select 1 from shop_staff where lower(username)=normalized_username) then
  raise exception 'Username already exists';
 end if;
 update shops
 set name=trim(p_name),
     area=trim(p_area),
     active=p_active,
     username=normalized_username,
     settings=coalesce(settings,'{}'::jsonb) || jsonb_build_object('shopType', requested_type)
 where id=p_shop_id
 returning * into current_shop;
 if not p_active then delete from app_sessions where shop_id=p_shop_id; end if;
 return jsonb_build_object('saved',true,'username',current_shop.username,'shopType',current_shop.settings->>'shopType');
end $$;

create or replace function public.list_shops(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 return coalesce((
  with product_counts as (
   select shop_id, count(*)::integer as item_count
   from items
   group by shop_id
  )
  select jsonb_agg(
   jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'area', s.area,
    'username', s.username,
    'active', s.active,
    'shopType', coalesce(nullif(s.settings->>'shopType',''), 'general'),
    'itemCount', coalesce(pc.item_count, 0)
   )
   order by s.created_at, s.id
  )
  from shops s
  left join product_counts pc on pc.shop_id = s.id
 ), '[]'::jsonb);
end $$;

revoke all on function public.preserve_shop_type_settings() from public,anon,authenticated;
revoke all on function public.admin_update_shop(uuid,uuid,text,text,boolean,text,text), public.list_shops(uuid) from public;
grant execute on function public.admin_update_shop(uuid,uuid,text,text,boolean,text,text), public.list_shops(uuid) to anon,authenticated;
notify pgrst,'reload schema';
