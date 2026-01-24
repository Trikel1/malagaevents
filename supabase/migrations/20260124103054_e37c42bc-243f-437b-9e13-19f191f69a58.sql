-- Add RLS policy for event_submissions (read-only for submitter)
CREATE POLICY "Submitters can view own submissions" ON public.event_submissions
  FOR SELECT USING (auth.uid() = submitter_user_id);