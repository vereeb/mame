-- =============================================================================
-- Promenade: Subcontractors master data (superuser-managed)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subcontractors (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  registered_office TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subcontractors: superuser select" ON public.subcontractors;
DROP POLICY IF EXISTS "Subcontractors: superuser manage" ON public.subcontractors;

CREATE POLICY "Subcontractors: superuser select"
  ON public.subcontractors FOR SELECT
  USING (public.is_superuser(auth.uid()));

CREATE POLICY "Subcontractors: superuser manage"
  ON public.subcontractors FOR ALL
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.subcontractors
  TO authenticated;
