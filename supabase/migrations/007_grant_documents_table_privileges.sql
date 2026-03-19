-- =============================================================================
-- Promenade: Ensure API role can access documents table
-- =============================================================================

-- Supabase requests from the app use anon/authenticated roles.
-- RLS policies decide row-level access, but table privileges must still be granted.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.documents
  TO authenticated;
