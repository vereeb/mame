-- Migrate existing rows (separate migration: PG requires commit after ADD VALUE before using 'general').
UPDATE public.calendar_events
SET event_type = 'general'::public.calendar_event_type
WHERE event_type = 'reminder'::public.calendar_event_type;
