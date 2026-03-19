-- =============================================================================
-- Promenade: Make subcontractor tax number and registered office optional
-- =============================================================================

ALTER TABLE public.subcontractors
  ALTER COLUMN tax_number DROP NOT NULL,
  ALTER COLUMN registered_office DROP NOT NULL;
