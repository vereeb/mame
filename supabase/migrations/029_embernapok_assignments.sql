-- =============================================================================
-- Embernapok: daily laborer ↔ project check-ins (owner-facing matrix)
-- =============================================================================

-- 1) Assignment facts: laborer L worked on project P on date D
CREATE TABLE IF NOT EXISTS public.laborer_project_day_assignments (
  laborer_id UUID NOT NULL REFERENCES public.laborers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (laborer_id, project_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_lpda_work_date
  ON public.laborer_project_day_assignments(work_date);
CREATE INDEX IF NOT EXISTS idx_lpda_project
  ON public.laborer_project_day_assignments(project_id);

ALTER TABLE public.laborer_project_day_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Laborer project day assignments: select owners" ON public.laborer_project_day_assignments;
DROP POLICY IF EXISTS "Laborer project day assignments: manage owners" ON public.laborer_project_day_assignments;

CREATE POLICY "Laborer project day assignments: select owners"
  ON public.laborer_project_day_assignments FOR SELECT
  USING (
    public.is_superuser(auth.uid())
    OR public.user_has_project_access(auth.uid(), project_id, 'owner')
  );

CREATE POLICY "Laborer project day assignments: manage owners"
  ON public.laborer_project_day_assignments FOR ALL
  USING (
    public.is_superuser(auth.uid())
    OR public.user_has_project_access(auth.uid(), project_id, 'owner')
  )
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR public.user_has_project_access(auth.uid(), project_id, 'owner')
  );

-- 2) Owners can read project_laborer_members for projects they own (matrix eligibility)
DROP POLICY IF EXISTS "Project laborer members: owners select" ON public.project_laborer_members;

CREATE POLICY "Project laborer members: owners select"
  ON public.project_laborer_members FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'owner')
  );

-- 3) Owners can read laborer rows linked via assignments on owned projects
DROP POLICY IF EXISTS "Laborers: owners view assigned laborers" ON public.laborers;

CREATE POLICY "Laborers: owners view assigned laborers"
  ON public.laborers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_laborer_members plm
      WHERE plm.laborer_id = laborers.id
        AND public.user_has_project_access(auth.uid(), plm.project_id, 'owner')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.laborer_project_day_assignments
  TO authenticated;
