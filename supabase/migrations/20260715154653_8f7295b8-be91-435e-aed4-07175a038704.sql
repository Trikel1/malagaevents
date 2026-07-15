DROP POLICY IF EXISTS "Config is publicly readable" ON public.app_config;
CREATE POLICY "Admins can read config"
  ON public.app_config
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));