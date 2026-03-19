-- =============================================================================
-- Promenade: Allow laborers without direct project assignment
-- =============================================================================

ALTER TABLE public.laborers
  ALTER COLUMN project_id DROP NOT NULL;
