-- The scheduled sports jobs read this vault entry, but it was never created,
-- so every run posted an empty key and got a 401. Generate it server-side.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SYNC_SPORTS_KEY') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'SYNC_SPORTS_KEY',
      'Shared key used by pg_cron to authenticate sports sync edge functions'
    );
  END IF;
END $$;