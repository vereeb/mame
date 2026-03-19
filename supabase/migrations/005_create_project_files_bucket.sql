-- =============================================================================
-- Promenade: Create storage bucket for project documents/photos
-- =============================================================================

-- Create bucket used by src/app/documents/page.tsx
INSERT INTO storage.buckets (id, name, public)
VALUES ('project_files', 'project_files', false)
ON CONFLICT (id) DO NOTHING;

-- Ensure policies are idempotent on re-run
DROP POLICY IF EXISTS "Project members can read project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can delete project files" ON storage.objects;

-- Expected object key format:
--   project_files/{project_id}/{uuid}_{filename}

CREATE POLICY "Project members can read project files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND public.user_has_project_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'viewer'
    )
  );

CREATE POLICY "Project members can upload project files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project_files'
    AND public.user_has_project_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'member'
    )
  );

CREATE POLICY "Project members can update project files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND public.user_has_project_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'member'
    )
  )
  WITH CHECK (
    bucket_id = 'project_files'
    AND public.user_has_project_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'member'
    )
  );

CREATE POLICY "Project members can delete project files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND public.user_has_project_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'member'
    )
  );
