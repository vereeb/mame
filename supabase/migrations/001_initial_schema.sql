-- =============================================================================
-- Promenade: Construction Management App - Initial Database Schema
-- =============================================================================
-- Run this in Supabase SQL Editor or via Supabase CLI migrations.
-- Assumes Supabase Auth is enabled; auth.users is managed by Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CUSTOM TYPES (Enums)
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE expense_category AS ENUM ('materials', 'services');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');

-- -----------------------------------------------------------------------------
-- 2. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 3. CORE TABLES
-- -----------------------------------------------------------------------------

-- Profiles: Extends Supabase auth.users with app-specific data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects: The central entity; all data is scoped by project_id
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project members: Links users to projects with roles (multi-user access)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);

-- Laborers: Workers on a project (names, daily wages)
CREATE TABLE public.laborers (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_wage NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laborers_project ON public.laborers(project_id);

-- Work logs: Daily work entries for laborers
CREATE TABLE public.work_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  laborer_id UUID NOT NULL REFERENCES public.laborers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hours_worked NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_logs_laborer ON public.work_logs(laborer_id);
CREATE INDEX idx_work_logs_date ON public.work_logs(work_date);

-- Expenses: Categorized by materials or services
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_category ON public.expenses(category);

-- Invoices: Billing tracking
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_project ON public.invoices(project_id);

-- Documents: References to uploaded .docx/.xlsx files (stored in Supabase Storage)
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('docx', 'xlsx')),
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project ON public.documents(project_id);

-- Calendar milestones
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  milestone_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project ON public.milestones(project_id);

-- -----------------------------------------------------------------------------
-- 4. HELPER: User has access to a project
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_project_access(
  p_user_id UUID,
  p_project_id UUID,
  p_min_role user_role DEFAULT 'viewer'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_val user_role;
  role_order INT;
  min_order INT;
BEGIN
  SELECT role INTO user_role_val
  FROM public.project_members
  WHERE user_id = p_user_id AND project_id = p_project_id;

  IF user_role_val IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: owner(4) > admin(3) > member(2) > viewer(1)
  role_order := CASE user_role_val
    WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
  END;
  min_order := CASE p_min_role
    WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 ELSE 1
  END;

  RETURN role_order >= min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laborers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Profiles: Users see only their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Projects: Access via project_members
CREATE POLICY "Users can view projects they are members of"
  ON public.projects FOR SELECT
  USING (public.user_has_project_access(auth.uid(), id, 'viewer'));

CREATE POLICY "Admins and owners can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); -- Fine-tune: e.g. only if user exists

CREATE POLICY "Admins and owners can update projects"
  ON public.projects FOR UPDATE
  USING (public.user_has_project_access(auth.uid(), id, 'admin'));

CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE
  USING (public.user_has_project_access(auth.uid(), id, 'owner'));

-- Project members: Members can view; admins/owners manage
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Admins and owners can manage project members"
  ON public.project_members FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'admin'));

-- Laborers: Scoped by project
CREATE POLICY "Members can view laborers"
  ON public.laborers FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can manage laborers"
  ON public.laborers FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));

-- Work logs: Via laborer -> project
CREATE POLICY "Members can view work logs"
  ON public.work_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.laborers l
      WHERE l.id = laborer_id
        AND public.user_has_project_access(auth.uid(), l.project_id, 'viewer')
    )
  );

CREATE POLICY "Members can manage work logs"
  ON public.work_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.laborers l
      WHERE l.id = laborer_id
        AND public.user_has_project_access(auth.uid(), l.project_id, 'member')
    )
  );

-- Expenses
CREATE POLICY "Members can view expenses"
  ON public.expenses FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can manage expenses"
  ON public.expenses FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));

-- Invoices
CREATE POLICY "Members can view invoices"
  ON public.invoices FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can manage invoices"
  ON public.invoices FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));

-- Documents
CREATE POLICY "Members can view documents"
  ON public.documents FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can manage documents"
  ON public.documents FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));

-- Milestones
CREATE POLICY "Members can view milestones"
  ON public.milestones FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Members can manage milestones"
  ON public.milestones FOR ALL
  USING (public.user_has_project_access(auth.uid(), project_id, 'member'));

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS: Auto-create profile on signup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. STORAGE BUCKET (Documents)
-- Run in Supabase Dashboard > Storage or via API if needed.
-- Bucket: documents, RLS via project_id in path or custom policies.
-- -----------------------------------------------------------------------------
