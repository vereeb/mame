-- Separate „general” uploads (Dokumentumok) from „invoice” uploads (Pénzügy → Számlák)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_category_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_category_check
  CHECK (category IN ('general', 'invoice'));

CREATE INDEX IF NOT EXISTS idx_documents_project_category
  ON public.documents(project_id, category);
