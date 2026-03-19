-- =============================================================================
-- Promenade: Add project kind (Sajat projekt / Alvallalkozo)
-- =============================================================================

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS project_kind TEXT NOT NULL DEFAULT 'Sajat projekt';

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_project_kind_check;

ALTER TABLE public.projects
ADD CONSTRAINT projects_project_kind_check
CHECK (project_kind IN ('Sajat projekt', 'Alvallalkozo'));
