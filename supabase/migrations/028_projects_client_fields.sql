-- Megrendelő (ordering party) contact fields
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_phone TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT;

COMMENT ON COLUMN public.projects.client_name IS 'Megrendelő neve';
COMMENT ON COLUMN public.projects.client_phone IS 'Megrendelő telefonszáma';
COMMENT ON COLUMN public.projects.client_email IS 'Megrendelő e-mail címe';
