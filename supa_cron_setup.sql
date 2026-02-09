-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Function to atomically check and claim the email lock for a branch for a specific day
create or replace function claim_email_lock(p_branch_id uuid, p_today date)
returns boolean
language plpgsql
security definer
as $$
declare
  v_last_sent date;
begin
  -- Lock the row for update to prevent race conditions
  select last_sent_date into v_last_sent
  from branch_email_settings
  where branch_id = p_branch_id
  for update;

  -- If already sent today, return false
  if v_last_sent = p_today then
    return false;
  end if;

  -- Update last_sent_date to today
  update branch_email_settings
  set last_sent_date = p_today,
      updated_at = now()
  where branch_id = p_branch_id;

  return true;
end;
$$;

-- Grant access to authenticated users (or service role)
grant execute on function claim_email_lock to authenticated;
grant execute on function claim_email_lock to service_role;

-- Cron Schedule
-- IMPORTANT: Replace 'SERVICE_ROLE_KEY' with your actual Supabase Service Role Key (found in Project Settings -> API)

select cron.schedule(
  'send-refuel-reports-daily',
  '10 * * * *', -- This runs every hour at minute 10. Consider changing to a specific daily time like '55 11 * * *' (11:55 PM)
  $$
  select
    net.http_post(
        url:='https://rwnczolpsnkugzrkheps.supabase.co/functions/v1/send-refuel-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
