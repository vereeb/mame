-- =============================================================================
-- Promenade: Laborer roles per project
-- =============================================================================
-- Goal:
-- Under Admin/Projektek, superuser assigns a laborer to a project and chooses
-- that laborer's role (viewer/member/admin/owner).
--
-- RLS integration:
-- `public.user_has_project_access(auth.uid(), project_id, min_role)` is used by
-- all project-scoped policies. We update it so laborer assignments contribute
-- role-based access instead of fixed viewer/member behavior.

-- 1) Add role to the join table (per-project laborer role)
ALTER TABLE public.project_laborer_members
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'member';

-- 2) Update project access helper to honor the laborer role
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
  -- Explicit project membership role takes precedence.
  SELECT role INTO user_role_val
  FROM public.project_members
  WHERE user_id = p_user_id AND project_id = p_project_id;

  IF user_role_val IS NOT NULL THEN
    role_order := CASE user_role_val
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
    END;

    min_order := CASE p_min_role
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
    END;

    RETURN role_order >= min_order;
  END IF;

  -- Otherwise, laborer assignments map by laborers.email => auth.users.email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  min_order := CASE p_min_role
    WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.project_laborer_members plm
    JOIN public.laborers l ON l.id = plm.laborer_id
    WHERE plm.project_id = p_project_id
      AND l.email IS NOT NULL
      AND lower(l.email) = lower(user_email)
      AND (
        CASE plm.role
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'member' THEN 2
          ELSE 1
        END
      ) >= min_order
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

