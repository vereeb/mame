-- =============================================================================
-- Promenade: Grant table privileges for admin-managed tables
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.laborers
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.project_laborer_members
  TO authenticated;
