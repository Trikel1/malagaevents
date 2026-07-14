
-- Fase 4: canonical registry additive fields on event_sources.
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS priority_tier text
    CHECK (priority_tier IS NULL OR priority_tier IN ('P0','P1','P2','P3')),
  ADD COLUMN IF NOT EXISTS protected_source boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_source_id uuid
    REFERENCES public.event_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_dry_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dry_run_status text,
  ADD COLUMN IF NOT EXISTS last_dry_run_result jsonb;

CREATE INDEX IF NOT EXISTS idx_event_sources_priority_tier
  ON public.event_sources(priority_tier) WHERE priority_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_sources_canonical
  ON public.event_sources(canonical_source_id) WHERE canonical_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_sources_protected
  ON public.event_sources(protected_source) WHERE protected_source = true;
