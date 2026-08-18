-- Server-only validator so the scheduled job and the sync engine agree on the
-- same shared key without duplicating it in two places that can drift apart.
CREATE OR REPLACE FUNCTION public.verify_sync_sports_key(_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  IF _key IS NULL OR length(_key) < 8 THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SPORTS_KEY'
  LIMIT 1;
  RETURN v_secret IS NOT NULL AND v_secret = _key;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_sync_sports_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_sync_sports_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_sync_sports_key(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sync_sports_key(text) TO service_role;