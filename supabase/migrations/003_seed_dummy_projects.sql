-- =============================================================================
-- Promenade: Seed 2 dummy projects for testing Documents
-- =============================================================================

INSERT INTO public.projects (id, name, description, address, status, start_date, end_date)
VALUES
  (extensions.uuid_generate_v4(), 'Sample Project Alpha', 'Dummy project for testing', '123 Main St', 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months'),
  (extensions.uuid_generate_v4(), 'Sample Project Beta', 'Second dummy project', '456 Oak Ave', 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months');

-- Add first user (if any) as owner so projects appear in the dropdown.
-- If auth.users is empty: sign up in the app, then in SQL Editor replace
-- YOUR_USER_ID with your auth.users id (Dashboard > Authentication > Users):
--
--   INSERT INTO public.project_members (project_id, user_id, role)
--   SELECT p.id, 'YOUR_USER_ID'::uuid, 'owner'::user_role
--   FROM public.projects p
--   WHERE p.name IN ('Sample Project Alpha', 'Sample Project Beta')
--   ON CONFLICT (project_id, user_id) DO NOTHING;
--
INSERT INTO public.project_members (project_id, user_id, role)
SELECT p.id, u.id, 'owner'::user_role
FROM public.projects p
CROSS JOIN (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) u
WHERE p.name IN ('Sample Project Alpha', 'Sample Project Beta')
ON CONFLICT (project_id, user_id) DO NOTHING;
