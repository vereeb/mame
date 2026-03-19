-- =============================================================================
-- Promenade: Bootstrap known admin account for local/dev
-- =============================================================================
-- Ensures the known admin can always see/select all existing projects.

-- 1) Mark the account as global superuser (if profile exists)
UPDATE public.profiles
SET is_superuser = true
WHERE email = 'verebence@gmail.com';

-- 2) Ensure owner membership on all projects for that account
INSERT INTO public.project_members (project_id, user_id, role)
SELECT p.id, u.id, 'owner'::public.user_role
FROM public.projects p
JOIN auth.users u ON u.email = 'verebence@gmail.com'
ON CONFLICT (project_id, user_id) DO UPDATE
SET role = EXCLUDED.role;
