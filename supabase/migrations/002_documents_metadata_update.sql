-- =============================================================================
-- Promenade: Extend documents table for display_name and photo support
-- =============================================================================

-- Add new columns (original_name = uploaded filename, display_name = user-editable label)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill from file_name if it exists (from 001 schema)
UPDATE public.documents
SET original_name = file_name,
    display_name = file_name
WHERE file_name IS NOT NULL AND (original_name IS NULL OR display_name IS NULL);

-- Drop old file_name column
ALTER TABLE public.documents DROP COLUMN IF EXISTS file_name;

-- Set defaults for new inserts
ALTER TABLE public.documents ALTER COLUMN original_name SET DEFAULT '';
ALTER TABLE public.documents ALTER COLUMN display_name SET DEFAULT '';

-- Drop existing file_type constraint and add extended one (docs, sheets, photos)
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('docx', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'heic'));

-- =============================================================================
-- Storage: Create project_files bucket via Supabase Dashboard or API
-- Path pattern: project_files/{project_id}/{uuid}_{filename}
-- RLS: Users can read/write only within projects they have access to
-- =============================================================================
