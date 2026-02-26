
-- Create pharmacies_directory table for full province coverage
CREATE TABLE IF NOT EXISTS public.pharmacies_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  municipality text NOT NULL DEFAULT 'Málaga',
  province text NOT NULL DEFAULT 'Málaga',
  phone text,
  lat numeric,
  lng numeric,
  dedupe_key text UNIQUE,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for pharmacies_directory
ALTER TABLE public.pharmacies_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacies directory publicly readable" ON public.pharmacies_directory FOR SELECT USING (true);

-- Add municipality column to pharmacies_guard
ALTER TABLE public.pharmacies_guard ADD COLUMN IF NOT EXISTS municipality text DEFAULT 'Málaga';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pharmacies_directory_municipality ON public.pharmacies_directory(municipality);
CREATE INDEX IF NOT EXISTS idx_pharmacies_directory_dedupe ON public.pharmacies_directory(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_pharmacies_guard_municipality ON public.pharmacies_guard(municipality);
