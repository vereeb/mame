-- =============================================================================
-- Fix user_has_project_access: honor project_members.role again.
-- 023 used only profiles/laborer access_role for role level, so real project
-- Owners (project_members.role = owner) with profile access_role = member
-- failed owner-level RLS (e.g. laborer_project_day_assignments).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_project_access(
  p_user_id UUID,
  p_project_id UUID,
  p_min_role user_role DEFAULT 'viewer'
)
RETURNS BOOLEAN AS $$
DECLARE
  pm_role public.user_role;
  role_order INT;
  min_order INT;
  eff_role public.user_role;
BEGIN
  min_order := CASE p_min_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 2
    ELSE 1
  END;

  -- Explicit project membership: per-project role is authoritative.
  SELECT role INTO pm_role
  FROM public.project_members
  WHERE user_id = p_user_id AND project_id = p_project_id;

  IF pm_role IS NOT NULL THEN
    role_order := CASE pm_role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      ELSE 1
    END;
    RETURN role_order >= min_order;
  END IF;

  -- Laborer mapped by email and listed on project (legacy / optional plm rows).
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_laborer_members plm
    JOIN public.laborers l ON l.id = plm.laborer_id
    JOIN auth.users u ON u.id = p_user_id
    WHERE plm.project_id = p_project_id
      AND l.email IS NOT NULL
      AND lower(l.email) = lower(u.email)
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT l.access_role INTO eff_role
  FROM public.laborers l
  JOIN auth.users u ON lower(u.email) = lower(l.email)
  WHERE u.id = p_user_id
  ORDER BY
    CASE l.access_role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;

  IF eff_role IS NULL THEN
    SELECT p.access_role INTO eff_role
    FROM public.profiles p
    WHERE p.id = p_user_id;
  END IF;

  IF eff_role IS NULL THEN
    eff_role := 'viewer'::public.user_role;
  END IF;

  role_order := CASE eff_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 2
    ELSE 1
  END;

  RETURN role_order >= min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
