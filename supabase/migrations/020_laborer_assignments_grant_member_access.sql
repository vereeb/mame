-- =============================================================================
-- Promenade: Laborer assignments grant member access
-- =============================================================================
-- Requirement:
-- Under Admin/Projects, when laborers are connected to projects, those
-- laborers should have "member-level" access for RLS checks.
--
-- Implementation:
-- Your RLS policies use `public.user_has_project_access(auth.uid(), project_id, p_min_role)`.
-- In migration `019_laborers_email_and_access.sql`, laborer-based access was
-- limited to viewer-only. This migration upgrades that behavior so assigned
-- laborers count as `member` (but still not `admin`/`owner`).

CREATE OR REPLACE FUNCTION public.user_has_project_access(
  p_user_id UUID,
  p_project_id UUID,
  p_min_role user_role DEFAULT 'viewer'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_val user_role;
  role_order INT;
  min_order INT;
  user_email TEXT;
BEGIN
  -- 1) Explicit project_members role (owner/admin/member/viewer)
  SELECT role INTO user_role_val
  FROM public.project_members
  WHERE user_id = p_user_id AND project_id = p_project_id;

  IF user_role_val IS NOT NULL THEN
    -- Role hierarchy: owner(4) > admin(3) > member(2) > viewer(1)
    role_order := CASE user_role_val
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
    END;
    min_order := CASE p_min_role
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
    END;
    RETURN role_order >= min_order;
  END IF;

  -- 2) Laborer-based access (mapped by auth email + project_laborer_members)
  -- Allow viewer/member, but not owner/admin.
  IF p_min_role <> 'viewer' AND p_min_role <> 'member' THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.project_laborer_members plm
    JOIN public.laborers l ON l.id = plm.laborer_id
    WHERE plm.project_id = p_project_id
      AND l.email IS NOT NULL
      AND lower(l.email) = lower(user_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

