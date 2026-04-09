-- =============================================================================
-- Owners (project_members.role = 'owner' on at least one project) can SELECT
-- all rows in public.projects — needed for the header dropdown and „Összes projekt”.
-- Other users still only see projects they belong to (viewer+).
-- =============================================================================

DROP POLICY IF EXISTS "Projects: select member or superuser" ON public.projects;

CREATE POLICY "Projects: select member or superuser"
  ON public.projects FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), id, 'viewer')
    OR public.is_superuser(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
  );
