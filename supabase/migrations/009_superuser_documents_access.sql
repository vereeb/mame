-- =============================================================================
-- Promenade: Superuser access to documents and storage objects
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) public.documents RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view documents" ON public.documents;
DROP POLICY IF EXISTS "Members can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Members can update documents" ON public.documents;
DROP POLICY IF EXISTS "Members can delete documents" ON public.documents;

CREATE POLICY "Documents: select member or superuser"
  ON public.documents FOR SELECT
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'viewer')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Documents: insert member or superuser"
  ON public.documents FOR INSERT
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Documents: update member or superuser"
  ON public.documents FOR UPDATE
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  )
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  );

CREATE POLICY "Documents: delete member or superuser"
  ON public.documents FOR DELETE
  USING (
    public.user_has_project_access(auth.uid(), project_id, 'member')
    OR public.is_superuser(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2) storage.objects RLS for bucket project_files
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project members can read project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can delete project files" ON storage.objects;

CREATE POLICY "Project files: read member or superuser"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND (
      public.user_has_project_access(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        'viewer'
      )
      OR public.is_superuser(auth.uid())
    )
  );

CREATE POLICY "Project files: upload member or superuser"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project_files'
    AND (
      public.user_has_project_access(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        'member'
      )
      OR public.is_superuser(auth.uid())
    )
  );

CREATE POLICY "Project files: update member or superuser"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND (
      public.user_has_project_access(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        'member'
      )
      OR public.is_superuser(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'project_files'
    AND (
      public.user_has_project_access(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        'member'
      )
      OR public.is_superuser(auth.uid())
    )
  );

CREATE POLICY "Project files: delete member or superuser"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project_files'
    AND (
      public.user_has_project_access(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        'member'
      )
      OR public.is_superuser(auth.uid())
    )
  );
