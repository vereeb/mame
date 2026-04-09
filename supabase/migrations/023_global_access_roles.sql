-- =============================================================================
-- Promenade: Global access roles (trade per-project laborer roles for simpler admin)
-- =============================================================================
-- - profiles.access_role: default permission for the logged-in user (site-wide).
-- - laborers.access_role: set in Admin / Munkavállalók; applies to any auth user
--   whose email matches the laborer. DB trigger syncs matching profiles.access_role.
-- - project_laborer_members: assignment only (no per-project role column).
-- - project_members.role column remains for legacy/defaults but is NOT used by RLS.

-- 1) profiles.access_role
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_role public.user_role NOT NULL DEFAULT 'member';

-- Backfill from strongest project_members role per user (if any)
UPDATE public.profiles p
SET access_role = s.role
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    role
  FROM public.project_members
  ORDER BY user_id,
    CASE role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      ELSE 1
    END DESC
) s
WHERE p.id = s.user_id;

-- 2) laborers.access_role
ALTER TABLE public.laborers
  ADD COLUMN IF NOT EXISTS access_role public.user_role NOT NULL DEFAULT 'member';

-- Backfill from strongest project_laborer_members.role per laborer (before column drop)
UPDATE public.laborers l
SET access_role = s.role
FROM (
  SELECT DISTINCT ON (laborer_id)
    laborer_id,
    role
  FROM public.project_laborer_members
  ORDER BY laborer_id,
    CASE role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      ELSE 1
    END DESC
) s
WHERE l.id = s.laborer_id;

-- Prefer laborer row when email matches an auth user (overwrites profile from step 1 for those users)
UPDATE public.profiles p
SET access_role = l.access_role
FROM public.laborers l
JOIN auth.users u ON lower(u.email) = lower(l.email)
WHERE p.id = u.id
  AND l.email IS NOT NULL;

-- 3) Drop per-project role on laborer assignments
ALTER TABLE public.project_laborer_members
  DROP COLUMN IF EXISTS role;

-- 4) Prevent non-superusers from changing profiles.access_role (client updates)
CREATE OR REPLACE FUNCTION public.profiles_lock_access_role_from_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.access_role IS DISTINCT FROM OLD.access_role
     AND NOT COALESCE(public.is_superuser(auth.uid()), false)
  THEN
    NEW.access_role := OLD.access_role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_access_role ON public.profiles;
CREATE TRIGGER profiles_lock_access_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_access_role_from_clients();

-- 5) When laborer access_role or email changes, sync matching profile (superuser edits in Admin)
CREATE OR REPLACE FUNCTION public.sync_profile_access_from_laborer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    UPDATE public.profiles p
    SET access_role = NEW.access_role
    FROM auth.users u
    WHERE u.id = p.id
      AND lower(u.email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS laborer_sync_profile_access ON public.laborers;
CREATE TRIGGER laborer_sync_profile_access
  AFTER INSERT OR UPDATE OF access_role, email ON public.laborers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_access_from_laborer();

-- 6) Project access: membership (binary) + global role from laborer (by email) or profile
CREATE OR REPLACE FUNCTION public.user_has_project_access(
  p_user_id UUID,
  p_project_id UUID,
  p_min_role user_role DEFAULT 'viewer'
)
RETURNS BOOLEAN AS $$
DECLARE
  eff_role public.user_role;
  role_order INT;
  min_order INT;
  user_email TEXT;
  in_project BOOLEAN;
BEGIN
  min_order := CASE p_min_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 2
    ELSE 1
  END;

  in_project := EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.user_id = p_user_id
      AND pm.project_id = p_project_id
  );

  IF NOT in_project THEN
    SELECT u.email INTO user_email
    FROM auth.users u
    WHERE u.id = p_user_id;

    IF user_email IS NULL THEN
      RETURN FALSE;
    END IF;

    in_project := EXISTS (
      SELECT 1
      FROM public.project_laborer_members plm
      JOIN public.laborers l ON l.id = plm.laborer_id
      WHERE plm.project_id = p_project_id
        AND l.email IS NOT NULL
        AND lower(l.email) = lower(user_email)
    );
  END IF;

  IF NOT in_project THEN
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
