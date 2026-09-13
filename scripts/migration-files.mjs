// One ordered manifest for setup, release migration and integration fixtures.
export const migrationFiles = [
  'schema.sql',
  'inventory-operations.sql',
  'migrations/20260912_retail_pos.sql',
  'migrations/20260913_retail_scheduler.sql',
  'migrations/20260914_auth_limits.sql',
  'migrations/20260915_product_control.sql',
  'migrations/20260916_shop_staff.sql',
  'migrations/20260917_staff_roles.sql',
  'migrations/20260918_migration_ledger.sql',
  'migrations/20260919_scale_controls.sql',
  'migrations/20260920_retail_delivery.sql',
  'migrations/20260921_retail_quotes.sql',
  'migrations/20260922_session_profile.sql',
  'migrations/20260923_request_limits.sql',
  'migrations/20260924_history_indexes.sql',
];
