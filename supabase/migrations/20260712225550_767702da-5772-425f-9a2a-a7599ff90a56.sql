
CREATE TABLE public.ingestion_write_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.event_sources(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  phase text NOT NULL DEFAULT '3E-3A'
);

GRANT ALL ON public.ingestion_write_tokens TO service_role;

ALTER TABLE public.ingestion_write_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated: this table is intended to be accessed
-- ONLY by trusted edge functions using the service role key. RLS enabled + no
-- policies = zero access via the Data API.

CREATE INDEX ingestion_write_tokens_source_id_idx ON public.ingestion_write_tokens(source_id);
CREATE INDEX ingestion_write_tokens_expires_at_idx ON public.ingestion_write_tokens(expires_at);
CREATE INDEX ingestion_write_tokens_used_at_idx ON public.ingestion_write_tokens(used_at);
