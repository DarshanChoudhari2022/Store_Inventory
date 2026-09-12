create extension if not exists pg_cron;
select cron.schedule('storestock-recurring-bills','*/5 * * * *','select public.retail_run_schedules();');
select cron.schedule('storestock-refresh-summary','*/15 * * * *','select public.retail_refresh_summary();');
