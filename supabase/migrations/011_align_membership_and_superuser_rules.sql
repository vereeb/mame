-- =============================================================================
-- Promenade: Align access model with product rules
-- =============================================================================
-- Rules:
-- - Only info@mame.works is superuser
-- - Project members can see/select their projects
-- - Project members can see all docs in their project
-- - Only superuser can add/remove/update project members

-- ---------------------------------------------------------------------------
-- 1) Superuser identity
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET is_superuser = false
WHERE is_superuser = true;

UPDATE public.profiles
SET is_superuser = true
WHERE email = 'info@mame.works';

-- ---------------------------------------------------------------------------
-- 2) Project membership management (superuser only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project members: manage admin/owner or superuser" ON public.project_members;
DROP POLICY IF EXISTS "Project members: superuser manage" ON public.project_members;

CREATE POLICY "Project members: superuser manage"
  ON public.project_members
  FOR ALL
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) Project visibility
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project members: select member or superuser" ON public.project_members;
DROP POLICY IF EXISTS "Project members: select by member or superuser" ON public.project_members;

CREATE POLICY "Project members: select by member or superuser"
  ON public.project_members FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'viewer')
    OR public.is_superuser(auth.uid())
  );
