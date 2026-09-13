create or replace function public.retail_contact_aging(p_token uuid,p_shop_id uuid,p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb; begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if not exists(select 1 from retail_contacts where id=p_contact_id and shop_id=p_shop_id and kind='customer') then raise exception 'Customer not found'; end if;
 select jsonb_build_object('current',coalesce(sum(case when coalesce(i.due_date,(i.created_at at time zone 'Asia/Kolkata')::date) >= (now() at time zone 'Asia/Kolkata')::date then greatest(i.total-i.paid,0) else 0 end),0),'days1to30',coalesce(sum(case when (now() at time zone 'Asia/Kolkata')::date-coalesce(i.due_date,(i.created_at at time zone 'Asia/Kolkata')::date) between 1 and 30 then greatest(i.total-i.paid,0) else 0 end),0),'days31to60',coalesce(sum(case when (now() at time zone 'Asia/Kolkata')::date-coalesce(i.due_date,(i.created_at at time zone 'Asia/Kolkata')::date) between 31 and 60 then greatest(i.total-i.paid,0) else 0 end),0),'over60',coalesce(sum(case when (now() at time zone 'Asia/Kolkata')::date-coalesce(i.due_date,(i.created_at at time zone 'Asia/Kolkata')::date)>60 then greatest(i.total-i.paid,0) else 0 end),0)) into result from retail_invoices i where i.shop_id=p_shop_id and i.customer_id=p_contact_id and i.method='credit' and not exists(select 1 from retail_returns r where r.invoice_id=i.id);
 return result;
end $$;
revoke all on function public.retail_contact_aging(uuid,uuid,uuid) from public;
grant execute on function public.retail_contact_aging(uuid,uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
