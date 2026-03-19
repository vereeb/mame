-- =============================================================================
-- Promenade: Fix RLS for documents INSERT/UPDATE/DELETE
-- =============================================================================

-- Existing policy uses FOR ALL + USING, which is not sufficient for INSERT.
DROP POLICY IF EXISTS "Members can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Members can view documents" ON public.documents;
DROP POLICY IF EXISTS "Members can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Members can update documents" ON public.documents;
DROP POLICY IF EXISTS "Members can delete documents" ON public.documents;

CREATE POLICY "Members can view documents"
  ON public.documents FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (public.user_has_project_access(auth.uid(), project_id, 'member'));

CREATE POLICY "Members can update documents"
  ON public.documents FOR UPDATE
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'))
  WITH CHECK (public.user_has_project_access(auth.uid(), project_id, 'member'));

CREATE POLICY "Members can delete documents"
  ON public.documents FOR DELETE
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));
