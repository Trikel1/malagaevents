CREATE TABLE public.sports_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sports_event_id uuid NOT NULL REFERENCES public.sports_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sports_event_id)
);

GRANT SELECT, INSERT, DELETE ON public.sports_favorites TO authenticated;
GRANT ALL ON public.sports_favorites TO service_role;

ALTER TABLE public.sports_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sports favorites"
ON public.sports_favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users add own sports favorites"
ON public.sports_favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own sports favorites"
ON public.sports_favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_sports_favorites_user ON public.sports_favorites(user_id);