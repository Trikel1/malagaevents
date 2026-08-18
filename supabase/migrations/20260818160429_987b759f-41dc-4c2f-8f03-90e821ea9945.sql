SELECT net.http_post(
  url := 'https://nfmrmndskkbiwlnaiztw.supabase.co/functions/v1/sync-sports-normalized',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-sync-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SYNC_SPORTS_KEY' LIMIT 1)
  ),
  body := '{"all": true}'::jsonb,
  timeout_milliseconds := 600000
) AS request_id;