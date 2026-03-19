-- =============================================================================
-- Promenade: Optional laborer email + project access by laborer assignment
-- =============================================================================

-- 1) Optional email on laborers
ALTER TABLE public.laborers
ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_laborers_email
  ON public.laborers (lower(email));

-- 2) Extend project access helper:
--    user can access project if they are:
--    - explicit project_member with required role, OR
--    - mapped laborer (by auth email) assigned to project via project_laborer_members
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

  -- Laborer-based access is viewer-level only.
  IF p_min_role <> 'viewer' THEN
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
