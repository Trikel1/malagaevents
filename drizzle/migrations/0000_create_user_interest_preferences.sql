CREATE TABLE public.user_interest_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
  catalog_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interest_preferences TO authenticated;
GRANT ALL ON public.user_interest_preferences TO service_role;

ALTER TABLE public.user_interest_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own interests"
  ON public.user_interest_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests"
  ON public.user_interest_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interests"
  ON public.user_interest_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
  ON public.user_interest_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_interest_preferences_updated_at
  BEFORE UPDATE ON public.user_interest_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();