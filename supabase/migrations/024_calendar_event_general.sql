-- Add enum value for UI label „általános” (must be committed before use in a later migration).
ALTER TYPE public.calendar_event_type ADD VALUE IF NOT EXISTS 'general';
