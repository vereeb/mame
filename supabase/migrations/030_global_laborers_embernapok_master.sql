-- =============================================================================
-- Embernapok as master: no persistent project↔laborer links in Admin.
-- Who works where/when = laborer_project_day_assignments only.
-- =============================================================================

-- Legacy links are removed; scheduling is done in Munkanapló → Embernapok.
DELETE FROM public.project_laborer_members;

UPDATE public.laborers
SET project_id = NULL
WHERE project_id IS NOT NULL;

-- Global laborer directory: anyone in at least one project (any role) or superuser
-- can read all laborer rows (project_id is no longer used for scoping).
DROP POLICY IF EXISTS "Laborers: project members read global directory" ON public.laborers;

CREATE POLICY "Laborers: project members read global directory"
  ON public.laborers FOR SELECT
  USING (
    public.is_superuser(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );
