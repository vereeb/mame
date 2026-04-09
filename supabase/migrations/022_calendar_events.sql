-- =============================================================================
-- Promenade: Calendar events (Planned expense/income, Deadline, Reminder)
-- =============================================================================

CREATE TYPE public.calendar_event_type AS ENUM (
  'planned_expense',
  'planned_income',
  'deadline',
  'reminder'
);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type public.calendar_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  amount NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_project_date
  ON public.calendar_events(project_id, event_date);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar events: select member or superuser"
  ON public.calendar_events FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'viewer')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Calendar events: manage member or superuser"
  ON public.calendar_events FOR ALL
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.calendar_events
  TO authenticated;
