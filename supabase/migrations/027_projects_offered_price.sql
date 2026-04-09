-- Optional contract / quoted price for dashboard and reporting
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS offered_price NUMERIC(12, 2);

COMMENT ON COLUMN public.projects.offered_price IS 'Ajánlati vagy szerződéses összeg (Ft)';
