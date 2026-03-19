-- =============================================================================
-- Promenade: Project <-> Laborer memberships for admin multi-select
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Join table for assigning multiple laborers to a project
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_laborer_members (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  laborer_id UUID NOT NULL REFERENCES public.laborers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, laborer_id)
);

CREATE INDEX IF NOT EXISTS idx_project_laborer_members_project
  ON public.project_laborer_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_laborer_members_laborer
  ON public.project_laborer_members(laborer_id);

ALTER TABLE public.project_laborer_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project laborer members: superuser select" ON public.project_laborer_members;
DROP POLICY IF EXISTS "Project laborer members: superuser manage" ON public.project_laborer_members;

CREATE POLICY "Project laborer members: superuser select"
  ON public.project_laborer_members FOR SELECT
  USING (public.is_superuser(auth.uid()));

CREATE POLICY "Project laborer members: superuser manage"
  ON public.project_laborer_members FOR ALL
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Laborers policies: keep project-scoped behavior, add superuser override
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view laborers" ON public.laborers;
DROP POLICY IF EXISTS "Members can manage laborers" ON public.laborers;
DROP POLICY IF EXISTS "Laborers: view member or superuser" ON public.laborers;
DROP POLICY IF EXISTS "Laborers: manage member or superuser" ON public.laborers;

CREATE POLICY "Laborers: view member or superuser"
  ON public.laborers FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'viewer')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Laborers: manage member or superuser"
  ON public.laborers FOR ALL
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  );
