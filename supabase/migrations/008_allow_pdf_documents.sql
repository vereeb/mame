-- =============================================================================
-- Promenade: Allow PDF documents
-- =============================================================================

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_file_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('docx', 'xlsx', 'pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'));
