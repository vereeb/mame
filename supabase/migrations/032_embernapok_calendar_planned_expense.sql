-- =============================================================================
-- Embernapok → Naptár: napi munkabér összesítés planned_expense eseményként
-- (projekt + nap), a munkavállalók napi bérének összege alapján.
-- =============================================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS embernapok_sync_key TEXT;

COMMENT ON COLUMN public.calendar_events.embernapok_sync_key IS
  'Ha kitöltött: esemény az Embernapok táblázatból szinkronizálva (project_id|work_date).';

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_embernapok_sync_key_uidx
  ON public.calendar_events (embernapok_sync_key)
  WHERE embernapok_sync_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_embernapok_planned_expense(p_project_id UUID, p_work_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total numeric(12, 2);
  descr text;
  sync_k text;
  updated_count int;
BEGIN
  sync_k := p_project_id::text || '|' || p_work_date::text;

  SELECT COALESCE(SUM(l.daily_wage), 0)
  INTO total
  FROM public.laborer_project_day_assignments a
  JOIN public.laborers l ON l.id = a.laborer_id
  WHERE a.project_id = p_project_id
    AND a.work_date = p_work_date;

  SELECT string_agg(
    l.name || ': ' || trim(to_char(l.daily_wage, 'FM999999990.00')) || ' Ft',
    E'\n' ORDER BY l.name
  )
  INTO descr
  FROM public.laborer_project_day_assignments a
  JOIN public.laborers l ON l.id = a.laborer_id
  WHERE a.project_id = p_project_id
    AND a.work_date = p_work_date;

  IF total IS NULL OR total <= 0 THEN
    DELETE FROM public.calendar_events WHERE embernapok_sync_key = sync_k;
    RETURN;
  END IF;

  UPDATE public.calendar_events
  SET
    amount = total,
    description = COALESCE(
      NULLIF(trim(descr), ''),
      'Összesen: ' || trim(to_char(total, 'FM999999990.00')) || ' Ft'
    ),
    event_date = p_work_date,
    project_id = p_project_id,
    event_type = 'planned_expense',
    title = 'Embernapok — munkabér',
    updated_at = now()
  WHERE embernapok_sync_key = sync_k;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.calendar_events (
    project_id,
    event_type,
    title,
    description,
    event_date,
    amount,
    embernapok_sync_key
  )
  VALUES (
    p_project_id,
    'planned_expense',
    'Embernapok — munkabér',
    COALESCE(
      NULLIF(trim(descr), ''),
      'Összesen: ' || trim(to_char(total, 'FM999999990.00')) || ' Ft'
    ),
    p_work_date,
    total,
    sync_k
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_laborer_assignment_refresh_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.upsert_embernapok_planned_expense(OLD.project_id, OLD.work_date);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.project_id IS DISTINCT FROM NEW.project_id OR OLD.work_date IS DISTINCT FROM NEW.work_date THEN
      PERFORM public.upsert_embernapok_planned_expense(OLD.project_id, OLD.work_date);
    END IF;
    PERFORM public.upsert_embernapok_planned_expense(NEW.project_id, NEW.work_date);
    RETURN NEW;
  ELSE
    PERFORM public.upsert_embernapok_planned_expense(NEW.project_id, NEW.work_date);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS laborer_project_day_assignments_refresh_calendar ON public.laborer_project_day_assignments;

CREATE TRIGGER laborer_project_day_assignments_refresh_calendar
  AFTER INSERT OR UPDATE OR DELETE ON public.laborer_project_day_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_laborer_assignment_refresh_calendar();

CREATE OR REPLACE FUNCTION public.trg_laborer_wage_refresh_embernapok_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.daily_wage IS DISTINCT FROM NEW.daily_wage) THEN
    FOR r IN
      SELECT DISTINCT project_id, work_date
      FROM public.laborer_project_day_assignments
      WHERE laborer_id = NEW.id
    LOOP
      PERFORM public.upsert_embernapok_planned_expense(r.project_id, r.work_date);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS laborers_wage_refresh_embernapok_calendar ON public.laborers;

CREATE TRIGGER laborers_wage_refresh_embernapok_calendar
  AFTER UPDATE OF daily_wage ON public.laborers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_laborer_wage_refresh_embernapok_calendar();

-- Meglévő bejegyzésekre visszamenőleges szinkron
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT project_id, work_date
    FROM public.laborer_project_day_assignments
  LOOP
    PERFORM public.upsert_embernapok_planned_expense(r.project_id, r.work_date);
  END LOOP;
END $$;
