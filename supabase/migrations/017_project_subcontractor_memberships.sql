-- =============================================================================
-- Promenade: Project <-> Subcontractor memberships
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_subcontractor_members (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, subcontractor_id)
);

CREATE INDEX IF NOT EXISTS idx_project_subcontractor_members_project
  ON public.project_subcontractor_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_subcontractor_members_subcontractor
  ON public.project_subcontractor_members(subcontractor_id);

ALTER TABLE public.project_subcontractor_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project subcontractor members: superuser select" ON public.project_subcontractor_members;
DROP POLICY IF EXISTS "Project subcontractor members: superuser manage" ON public.project_subcontractor_members;

CREATE POLICY "Project subcontractor members: superuser select"
  ON public.project_subcontractor_members FOR SELECT
  USING (public.is_superuser(auth.uid()));

CREATE POLICY "Project subcontractor members: superuser manage"
  ON public.project_subcontractor_members FOR ALL
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.project_subcontractor_members
  TO authenticated;
