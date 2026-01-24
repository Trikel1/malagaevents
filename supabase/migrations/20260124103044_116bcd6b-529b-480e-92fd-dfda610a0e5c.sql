-- Create users table for profile data
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  locale TEXT DEFAULT 'es',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE,
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  price_info TEXT,
  is_free BOOLEAN NOT NULL DEFAULT false,
  ticket_url TEXT,
  image_url TEXT,
  age_restriction TEXT,
  accessibility_info TEXT,
  capacity_info TEXT,
  tags TEXT[],
  source_type TEXT NOT NULL DEFAULT 'official_feed',
  source_ref TEXT,
  organizer_user_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events are publicly readable
CREATE POLICY "Events are publicly readable" ON public.events
  FOR SELECT USING (status = 'published');

-- Create pharmacies_guard table
CREATE TABLE public.pharmacies_guard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  source_ref TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pharmacies_guard
ALTER TABLE public.pharmacies_guard ENABLE ROW LEVEL SECURITY;

-- Pharmacies are publicly readable
CREATE POLICY "Pharmacies are publicly readable" ON public.pharmacies_guard
  FOR SELECT USING (true);

-- Create favorites table
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT favorites_user_event_unique UNIQUE (user_id, event_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Create tickets table (Mis entradas)
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  note TEXT,
  file_path TEXT,
  qr_text TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own tickets
CREATE POLICY "Users can insert own tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets
CREATE POLICY "Users can update own tickets" ON public.tickets
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own tickets
CREATE POLICY "Users can delete own tickets" ON public.tickets
  FOR DELETE USING (auth.uid() = user_id);

-- Create notification_prefs table
CREATE TABLE public.notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  enable_favorites BOOLEAN NOT NULL DEFAULT true,
  enable_categories BOOLEAN NOT NULL DEFAULT true,
  categories TEXT[],
  enable_nearby BOOLEAN NOT NULL DEFAULT true,
  radius_km NUMERIC NOT NULL DEFAULT 5,
  enable_daily_digest BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME
);

-- Enable RLS on notification_prefs
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification prefs
CREATE POLICY "Users can view own notification prefs" ON public.notification_prefs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own notification prefs
CREATE POLICY "Users can insert own notification prefs" ON public.notification_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification prefs
CREATE POLICY "Users can update own notification prefs" ON public.notification_prefs
  FOR UPDATE USING (auth.uid() = user_id);

-- Create event_submissions table for anti-spam tracking
CREATE TABLE public.event_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  submitter_email TEXT NOT NULL,
  submitter_user_id UUID REFERENCES public.users(id),
  captcha_passed BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on event_submissions
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;

-- Only the system can manage submissions (no public access)
-- We'll use service role for this table

-- Create storage bucket for tickets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tickets', 'tickets', false);

-- Storage policies for tickets bucket
CREATE POLICY "Users can upload own tickets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tickets' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own tickets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tickets' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own tickets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tickets' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, locale)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', COALESCE(NEW.raw_user_meta_data->>'locale', 'es'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();