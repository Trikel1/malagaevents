-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create scraping_sources table to manage sources
CREATE TABLE public.scraping_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    events_found INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on scraping_sources
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

-- Scraping sources policies
CREATE POLICY "Admins can manage scraping sources"
ON public.scraping_sources
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active sources"
ON public.scraping_sources
FOR SELECT
USING (is_active = true);

-- Add admin policies to events for management
CREATE POLICY "Admins can manage all events"
ON public.events
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies to event_submissions
CREATE POLICY "Admins can view all submissions"
ON public.event_submissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage submissions"
ON public.event_submissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert initial scraping sources
INSERT INTO public.scraping_sources (name, url, category) VALUES
('Agenda Municipal Málaga', 'https://www.malaga.eu/la-ciudad/agenda/', 'other'),
('Teatro Cervantes', 'https://www.teatrocervantes.es/programacion/', 'theater'),
('CAC Málaga', 'https://cacmalaga.eu/exposiciones/', 'exhibitions'),
('La Térmica', 'https://www.latermicamalaga.com/agenda/', 'music'),
('Museo Picasso Málaga', 'https://www.museopicassomalaga.org/actividades', 'exhibitions'),
('Centre Pompidou Málaga', 'https://centrepompidou-malaga.eu/actividades/', 'exhibitions'),
('Diputación de Málaga Cultura', 'https://www.malaga.es/cultura/agenda/', 'other'),
('Más Málaga', 'https://mmalaga.es/agenda/', 'other'),
('Más Málaga Conciertos', 'https://mmalaga.es/conciertos-malaga/', 'music'),
('Más Málaga Teatro', 'https://mmalaga.es/teatro-malaga/', 'theater'),
('Teatro Echegaray', 'https://www.teatroechegaray.es/programacion/', 'theater'),
('Fundación Unicaja', 'https://fundacionunicaja.com/agenda/', 'exhibitions');