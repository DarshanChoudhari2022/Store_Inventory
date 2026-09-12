create extension if not exists pg_cron;
select cron.schedule('storestock-recurring-bills','*/5 * * * *','select public.retail_run_schedules();');
