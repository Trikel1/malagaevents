DROP POLICY IF EXISTS "Anyone can view active sources" ON public.scraping_sources;
CREATE POLICY "Admins can view scraping sources"
ON public.scraping_sources
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));