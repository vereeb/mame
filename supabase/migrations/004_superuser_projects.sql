-- =============================================================================
-- Promenade: Global superuser support for project creation
-- =============================================================================
-- Adds a global `profiles.is_superuser` flag and updates RLS so that:
-- - projects SELECT: project member OR global superuser
-- - projects INSERT/UPDATE/DELETE: global superuser only
-- - project_members manage: project admin/owner OR global superuser
-- =============================================================================

-- 1) Add superuser flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_superuser boolean NOT NULL DEFAULT false;

-- 2) Helper: check if a user is the global superuser
CREATE OR REPLACE FUNCTION public.is_superuser(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_superuser = true
  );
$$;

-- 3) Update RLS policies on public.projects (global action gates)
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Admins and owners can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and owners can update projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;

CREATE POLICY "Projects: select member or superuser"
  ON public.projects FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), id, 'viewer')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Projects: superuser insert"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_superuser(auth.uid()));

CREATE POLICY "Projects: superuser update"
  ON public.projects FOR UPDATE
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

CREATE POLICY "Projects: superuser delete"
  ON public.projects FOR DELETE
  USING (public.is_superuser(auth.uid()));

-- 4) Update RLS policies on public.project_members (superuser can manage)
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins and owners can manage project members" ON public.project_members;

CREATE POLICY "Project members: select member or superuser"
  ON public.project_members FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'viewer')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Project members: manage admin/owner or superuser"
  ON public.project_members
  FOR ALL
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'admin')
    OR public.is_superuser(auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id, 'admin')
    OR public.is_superuser(auth.uid())
  );

