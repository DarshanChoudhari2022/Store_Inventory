-- Range filters use half-open IST timestamp bounds, allowing these indexes.
create index if not exists retail_invoices_shop_created_id on retail_invoices(shop_id,created_at desc,id);
create index if not exists retail_purchases_shop_created_id on retail_purchases(shop_id,created_at desc,id);
create index if not exists retail_payments_shop_created_id on retail_payments(shop_id,created_at desc,id);
create index if not exists retail_expenses_shop_created_id on retail_expenses(shop_id,created_at desc,id);
create index if not exists retail_returns_shop_created_id on retail_returns(shop_id,created_at desc,id);
create index if not exists retail_movements_shop_created_id on retail_movements(shop_id,created_at desc,id);
create index if not exists retail_items_shop_name_id on items(shop_id,name,id);
create index if not exists retail_contacts_shop_name_id on retail_contacts(shop_id,name,id);
