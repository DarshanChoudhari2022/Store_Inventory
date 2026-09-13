create or replace function public.retail_product_lookup(p_token uuid,p_shop_id uuid,p_query text,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb; cashier boolean:=exists(select 1 from app_sessions where token=p_token and staff_role='cashier');
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if p_query is null or length(trim(p_query))<1 or length(p_query)>200 or p_limit<1 or p_limit>50 then raise exception 'Invalid product search'; end if;
 select coalesce(jsonb_agg(to_jsonb(i)-'shop_id' order by (i.barcode=trim(p_query)) desc,lower(i.name),i.id),'[]') into result from (select * from items i where i.shop_id=p_shop_id and i.is_active and position(lower(trim(p_query)) in lower(concat_ws(' ',i.name,i.style_code,i.size,i.colour,i.barcode,i.category)))>0 order by (i.barcode=trim(p_query)) desc,lower(i.name),i.id limit p_limit) i;
 if cashier then result:=retail_redact_cost(jsonb_build_object('products',result))->'products'; end if;
 return result;
end $$;
revoke all on function public.retail_product_lookup(uuid,uuid,text,integer) from public;
grant execute on function public.retail_product_lookup(uuid,uuid,text,integer) to anon,authenticated;
notify pgrst,'reload schema';
