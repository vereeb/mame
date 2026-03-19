# Promenade - Detailed Architecture README (Video Spec)

This file is intended for an LLM that will generate a 5-10 minute explanatory animation video.
It focuses heavily on architecture and end-to-end logic (data flow, permissions, runtime behavior),
with only superficial UI walkthrough so a viewer can understand the whole system.

---

## 0) Video Goal (What the other LLM should produce)

Produce a narrated animation that explains:
1. How the Next.js frontend is structured (pages, shared layout, global providers).
2. How authentication and role checks work (global superuser vs project-scoped users).
3. How project selection works and how it scopes data queries.
4. How Supabase RLS enforces access (table-by-table concepts, helper function, role hierarchy).
5. How the Documents feature works end-to-end:
   - listing & filtering
   - uploading (including storage object path rules)
   - inserting metadata rows
   - viewing via signed URLs / Office viewer
   - renaming metadata
6. How the Admin feature works end-to-end (superuser-only CRUD and join-table assignments).
7. What is placeholder vs implemented (Dashboard, Finance, Calendar are mostly placeholders).

The animation should show "who does what, which data changes, and why access is allowed/blocked".

---

## 1) Tech Stack and Runtime Shape

Frontend:
- Next.js 14 App Router
- React client components for interactive UI
- Tailwind CSS (Material Design 3-inspired tokens)

Backend:
- Supabase
  - PostgreSQL database
  - Supabase Auth
  - Supabase Storage for uploaded documents/photos

Core interaction model:
- The frontend is intentionally light on authorization logic.
- Access control is primarily enforced by Supabase RLS policies.
- The frontend still performs project scoping in queries (for user experience),
  but the "real guarantee" is RLS.

---

## 2) Frontend Architecture (Next.js App Router)

### 2.1 Root layout and global UI
File: `src/app/layout.tsx`

Responsibilities:
1. Load fonts (Roboto + Lora).
2. Render the sticky top header containing:
   - Promenade logo (desktop vs mobile icon)
   - `ProjectDropdown` (project selection)
   - `HeaderNav` (desktop nav links; superuser-only "Admin")
   - `AccountButton` (account menu; login/logout)
   - `MobileNavTrigger` + a `MobileDrawer` component (present, but drawer open/close logic is not wired here)
3. Render the mobile bottom nav (`md:hidden`) with icons/labels:
   - Dashboard, Documents, Calendar, Finance
4. Wrap everything in `<Providers>` so app-wide state is available.

Important: `MobileNavTrigger` exists but the drawer is not connected to it in this file.
So the animation should mention: "the drawer component exists, but toggling isn't currently implemented".

### 2.2 Providers wrapper
File: `src/components/Providers.tsx`

Responsibilities:
- Wrap app children with `ProjectProvider`:
  - `<ProjectProvider>{children}</ProjectProvider>`

### 2.3 Global project selection state
File: `src/contexts/ProjectContext.tsx`

What it stores:
- `projectId: string | null`

How it persists:
- Uses `window.localStorage` under key `promenade:selected-project-id`.

Why it matters:
- Any page that reads `useProject()` will use `projectId` to scope queries.

Runtime behavior:
- On mount, it loads saved `projectId` from localStorage (if present).
- Whenever `projectId` changes, it updates or removes localStorage.

---

## 3) Supabase Client and "No-Env" behavior

File: `src/lib/supabase/client.ts`

Behavior:
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- If missing, it returns a browser client pointed at `https://placeholder.supabase.co` with placeholder key.

Implication for the animation:
- The app may appear to run without real backend connectivity,
  but production/real usage expects real env vars and migrations.

---

## 4) Authentication + Role Checking (How the UI decides what to show)

### 4.1 Login and Signup flows
Files:
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`

Login:
- Calls `supabase.auth.signInWithPassword({ email, password })`.
- On success: `router.push("/documents")`.

Signup:
- Calls `supabase.auth.signUp({ email, password })`.
- On success: `router.push("/documents")`.

Note:
- There is no explicit "email confirmation gating" in UI; comment notes that confirmation may be disabled.

### 4.2 Account menu (log out / identify user)
File: `src/components/AccountButton.tsx`

Behavior:
- Uses `supabase.auth.getUser()` to populate `user`.
- Subscribes to `supabase.auth.onAuthStateChange` to keep `user` in sync.
- If no user: clicking account button routes to `/login`.
- If user: clicking toggles an in-place menu with "Log out".
- Log out calls `supabase.auth.signOut()` then routes to `/login`.

### 4.3 Determining global superuser (UI-only gating)
Files:
- `src/components/HeaderNav.tsx`
- `src/components/ProjectDropdown.tsx`
- `src/app/admin/page.tsx`

Logic pattern:
1. Call `supabase.auth.getUser()` to get `user.id`.
2. Query `profiles` table for `is_superuser`:
   - `supabase.from("profiles").select("is_superuser").eq("id", userId).single()`
3. Convert to boolean and use it to change visible UI:
   - Desktop nav adds `/admin` link
   - Project dropdown dialog may be intended for superuser (see limitation below)
   - Admin page shows "You do not have access" if not superuser

Important architectural note:
- Supabase RLS is the actual enforcement.
- UI gating is mainly for convenience (hide admin UI until superuser).

---

## 5) Project Selection UX (What happens when a project is chosen)

File: `src/components/ProjectDropdown.tsx`

Behavior:
- Reads `projectId` and `setProjectId` from `useProject()`.
- Fetches `projects`:
  - `.from("projects").select("id, name").order("name")`
- Renders a `<select>` where `value={projectId ?? ""}`.
- On selection change:
  - `setProjectId(v ? v : null)`

Superuser create project dialog limitation:
- The file includes state + dialog markup for "Create project" but does not show a UI control that sets `createOpen = true`.
- So: "project creation from the dropdown is currently not reachable from the visible UI".
- Admin page includes project creation.

---

## 6) Implemented Pages and Data Scoping

### 6.1 Dashboard (/)
File: `src/app/page.tsx`
- Placeholder summary only.

### 6.2 Documents (/documents) - fully implemented
File: `src/app/documents/page.tsx`

This is the most important implemented feature for end-to-end logic.

#### 6.2.1 Data model used by Documents page

Tables:
1. `documents`
   - `id`
   - `project_id`
   - `file_path` (storage object key)
   - `original_name`
   - `display_name`
   - `file_type`
   - `created_at`

Storage bucket:
- `storage.buckets` bucket id/name: `project_files`
- Object key format used by upload:
  - `project_files/{project_id}/{uuid}_{sanitized_original_filename}`

#### 6.2.2 Query flow (list documents)

Inputs:
- `projectId` from `useProject()`

Behavior:
1. If `projectId` is null:
   - Show "Select a project to view documents."
2. Otherwise call `fetchDocs()`:
   - Query: `documents`
   - Select fields:
     - `id, project_id, file_path, original_name, display_name, file_type, created_at`
   - Filter: `.eq("project_id", projectId)`
   - Order: `.order("created_at", { ascending: false })`

UI filtering on the client:
- `search` filters on lowercased `display_name` / `original_name`.
- `filter` chip modifies what is included:
  - `all`: includes everything
  - `docx`: `d.file_type === "docx"`
  - `xlsx`: `d.file_type === "xlsx"`
  - `photos`: `file_type` is in `[jpg, jpeg, png, webp, heic]`

Note:
- `pdf` is accepted for uploads and storage policies allow it,
  but there is no explicit `pdf` chip filter in the UI.
  So pdf files appear only under `All` (and can still match search).

#### 6.2.3 Upload flow (upload file -> storage upload -> insert row)
Function: `uploadFile(file: File)`

Allowed extensions:
- UI allows: `.docx, .xlsx, .pdf, .jpg, .jpeg, .png, .webp, .heic`

Path naming:
1. Sanitize filename for safe storage key usage:
   - Normalize unicode
   - Remove diacritics
   - Replace whitespace with `_`
   - Replace any non `[a-zA-Z0-9._-]` with `_`
2. Generate path:
   - `path = `${projectId}/${crypto.randomUUID()}_${safeName}``
3. Upload to storage:
   - `supabase.storage.from("project_files").upload(path, file, { upsert: false })`

Metadata insert:
After successful storage upload:
- Insert into `documents`:
  - `project_id`
  - `file_path` = `path` (the object key relative to bucket)
  - `original_name` = original file name
  - `display_name` = file name
  - `file_type` = extension

Renaming:
- The rename dialog updates:
  - `documents.display_name` by document `id`.

RLS responsibilities:
- Even if the UI mistakenly tries to insert/update another project,
  RLS should prevent it.

#### 6.2.4 Viewing flow (signed URL + viewer selection)
Function: `viewFile(doc)`

Signed URL:
- Calls `supabase.storage.from("project_files").createSignedUrl(doc.file_path, 60 * 5)`
- If signed URL fails, show error.

Viewer strategy:
- If file_type is `docx` or `xlsx`:
  - Build Office viewer URL:
    `https://view.officeapps.live.com/op/view.aspx?src=${signedUrl}`
  - `window.open(officeViewerUrl, "_blank", "noopener,noreferrer")`
- Otherwise:
  - Open the signed URL directly:
    - PDFs
    - images

#### 6.2.5 FAB + rename dialog UX
- Uses a fixed-position FAB to open the hidden file input.
- Rename dialog is a modal:
  - updates display_name
  - refreshes list

### 6.3 Calendar (/calendar) - placeholder
File: `src/app/calendar/page.tsx`
- Placeholder milestone schedule.

### 6.4 Finance (/finance) - placeholder
File: `src/app/finance/page.tsx`
- Placeholder for laborers/expenses/invoices sections.

---

## 7) Admin (/admin) - deep logic, superuser-only

File: `src/app/admin/page.tsx`

UI gating:
- On mount:
  - Check `profiles.is_superuser` for current auth user.
- If `!isSuperuser`:
  - Render "You do not have access to this page."

Superuser data loading:
- Fetches:
  - `projects` fields: `id, name, description, address, project_kind`
  - `laborers` fields: `id, name, daily_wage, email`
  - `project_laborer_members`: `project_id, laborer_id`
  - `subcontractors`: `id, company_name, specialty, tax_number, registered_office, email`
  - `project_subcontractor_members`: `project_id, subcontractor_id` (if table exists)

What the Admin page manages:
1. Project creation/edit
2. Laborer creation/edit/delete
3. Assigning laborers to projects (join table)
4. Subcontractor creation + assigning subcontractors to projects (join table)

### 7.1 Project model nuance: `project_kind`
- Projects have `project_kind` with values:
  - `Sajat projekt`
  - `Alvallalkozo`

Admin assignment rule:
- If project_kind is `Sajat projekt`:
  - UI shows laborer multi-select
  - saving updates `project_laborer_members`
- If project_kind is `Alvallalkozo`:
  - UI shows subcontractor multi-select
  - saving updates `project_subcontractor_members`

### 7.2 Assigning laborers to a project
Function: `saveProjectLaborers(projectId)`

Algorithm:
1. Determine currently assigned laborer IDs:
   - Filter `memberships` (loaded earlier) by `project_id`
   - Map to `laborer_id`
2. Determine selected laborer IDs:
   - From `selectedByProject[projectId]` local state
3. Compute diffs:
   - `toAdd` = selected - currentlyAssigned
   - `toRemove` = currentlyAssigned - selected
4. Apply join table updates:
   - Insert rows for `toAdd` into `project_laborer_members`
   - Delete rows for `toRemove` from `project_laborer_members`
5. Refresh `memberships` by selecting join table again.

RLS / enforcement:
- Even though Admin UI is superuser-only, policies still apply.

### 7.3 Assigning subcontractors to a project
Function: `saveProjectSubcontractors(projectId)`

Algorithm mirrors laborers:
1. Get `currentlyAssigned` subcontractor IDs from `subcontractorMemberships`
2. Get `selected` subcontractor IDs from `selectedSubcontractorsByProject[projectId]`
3. Insert missing join rows and delete removed join rows
4. Refresh `project_subcontractor_members`

### 7.4 Creating projects and the "owner membership"

Function: `addProject()`

Flow:
1. Requires superuser identity:
   - calls `supabase.auth.getUser()`
   - gets `userId`
2. Inserts into `projects` with:
   - name, description, address, project_kind
3. Immediately creates project ownership in `project_members`:
   - inserts `{ project_id: newProject.id, user_id: userId, role: "owner" }`

Implication for permissions:
- This "owner membership" is what makes the creating superuser a project member
  (and thus able to access project-scoped tables under non-superuser helper logic).

### 7.5 Editing a project
Function: `saveEditProject()`
- Updates `projects`:
  - name, project_kind

### 7.6 Editing a laborer
Function: `saveEditLaborer()`
- Updates `laborers`:
  - name, daily_wage, email

### 7.7 Deleting a project
Function: `deleteProject(project)`

Behavior:
- Uses `window.prompt` to require typing the exact project name to confirm.
- Calls:
  - `supabase.from("projects").delete().eq("id", project.id)`
- Locally updates state arrays to remove:
  - project
  - selected mappings
  - memberships
  - subcontractor memberships

Database-level:
- Many foreign keys use `ON DELETE CASCADE`, so related rows should be removed by the database.

### 7.8 Creating a laborer
Function: `addLaborer()`
- Inserts into `laborers`:
  - name, daily_wage, email

### 7.9 Creating a subcontractor
Function: `addSubcontractor()`
- Inserts into `subcontractors`:
  - company_name
  - specialty (stored as comma-separated string from UI array)
  - optional tax_number, registered_office
  - email

---

## 8) Database Schema Deep Dive (Tables, Enums, Join Tables)

Core migration:
- `supabase/migrations/001_initial_schema.sql`

Enums:
- `user_role`: `owner | admin | member | viewer`
- `expense_category`: `materials | services`
- `invoice_status`: `draft | sent | paid | overdue`

Tables (core):
- `profiles`
  - extends auth.users conceptually, keyed by `id` (same UUID)
  - includes `email, full_name, avatar_url`
- `projects`
  - core entity
  - later migrations add `project_kind`
- `project_members`
  - user <-> project with role (`user_role`)
- `laborers`
  - workers per project (initially had non-null project_id, later made optional)
- `work_logs`
  - daily work entries for laborers
- `expenses`
  - project-scoped expenses
- `invoices`
  - project-scoped invoice tracking
- `documents`
  - metadata for uploaded documents stored in Supabase Storage
- `milestones`
  - project-scoped calendar entries

Join tables added later:
- `project_laborer_members`
  - maps laborers to projects (multi-assign)
- `subcontractors`
  - master data for subcontractor companies
- `project_subcontractor_members`
  - maps subcontractors to projects

---

## 9) Access Control Deep Dive (RLS + Role Hierarchy)

### 9.1 Helper function (initial)
In `001_initial_schema.sql`:
- `public.user_has_project_access(p_user_id, p_project_id, p_min_role)`

Initial behavior:
- Reads role from `project_members` for the given user+project.
- Implements role hierarchy:
  - owner(4) > admin(3) > member(2) > viewer(1)
- Returns true if user_role_order >= min_order.

### 9.2 Global superuser override (later)
Migration: `004_superuser_projects.sql`

Adds:
- `profiles.is_superuser boolean`

Adds helper:
- `public.is_superuser(p_user_id uuid)` returns true if profile has is_superuser=true.

RLS updates:
- On `projects`:
  - SELECT allowed if viewer role OR global superuser
  - INSERT/UPDATE/DELETE allowed for global superuser only
- On `project_members`:
  - SELECT allowed if viewer role OR global superuser
  - FOR ALL allowed if admin role OR global superuser

### 9.3 "Align membership and superuser rules"
Migration: `011_align_membership_and_superuser_rules.sql`

Effect:
- Only `info@mame.works` is set as superuser (reset others).
- Superuser can manage `project_members`.
- Ensures project_members selection policy includes global superuser.

### 9.4 Laborer-based project access (latest helper behavior)
Migration: `019_laborers_email_and_access.sql`

Changes `user_has_project_access`:
1. First checks `project_members` as before.
2. If user is not a project_member:
   - If `p_min_role != viewer`, return false.
   - Fetch user email from `auth.users`.
   - Check whether the user email matches any laborer email
     in `project_laborer_members` assignment for the project.

Meaning:
- Laborer assignments grant viewer access via email mapping.
- Non-viewer rights still require membership roles in `project_members`.

### 9.5 RLS policies per table (initial snapshot)
In `001_initial_schema.sql`:
- `profiles`: user can view/update/insert own profile
- `projects`: viewer via membership access
- `project_members`: viewer select; admin/owner manage
- `laborers`: viewer select; member manage
- `work_logs`: viewer via laborer->project mapping; member manage
- `expenses`, `invoices`, `documents`, `milestones`: viewer select; member manage

Later migrations override docs and/or allow more file types, and add policies for join tables:
- `006_fix_documents_rls_insert.sql` ensures correct INSERT semantics (FOR INSERT uses WITH CHECK).
- `008_allow_pdf_documents.sql` extends document file_type check.
- `009_superuser_documents_access.sql` allows superuser to access documents and storage.objects.
- `005_create_project_files_bucket.sql` defines storage bucket policies for object access.
- `012_project_laborer_memberships.sql` and `017_project_subcontractor_memberships.sql` add RLS policies for join tables.

---

## 10) Storage (Documents) Policies and Object Key Rules

Bucket policy migration: `005_create_project_files_bucket.sql`

Creates bucket `project_files` (if not present) and defines RLS on `storage.objects`.

Key assumptions:
- Uploaded object key includes a project_id as the first folder segment:
  - `project_files/{project_id}/{uuid}_{filename}`

Policy extraction:
- Uses `storage.foldername(name)[1]` to extract `{project_id}` from the object key.

Storage operations:
- SELECT:
  - allowed if user has project access >= viewer for extracted project_id
  - OR global superuser
- INSERT:
  - allowed if user has project access >= member for extracted project_id
  - OR global superuser
- UPDATE/DELETE:
  - similar role requirements

This is the backend guarantee that files stored under one project_id
cannot be accessed/modified by unauthorized users.

---

## 11) Migrations as "What the system can do"

This section is for the video's "credibility and completeness".
The animation should not list every migration line-by-line, but it should reference the evolution:

1. `001_initial_schema.sql`:
   - core tables + initial role-based project access helper
   - initial RLS policies
   - trigger to auto-create profiles from auth.users
2. `003_seed_dummy_projects.sql`:
   - inserts sample projects and assigns the first auth user as owner
3. `004_superuser_projects.sql`:
   - adds global superuser + updates RLS for project creation and project_members management
4. `005_create_project_files_bucket.sql`:
   - storage bucket policies for project-scoped file access
5. `006_fix_documents_rls_insert.sql`:
   - correct document RLS for INSERT/UPDATE semantics
6. `007_grant_documents_table_privileges.sql`:
   - grants table privileges (RLS alone is not enough)
7. `008_allow_pdf_documents.sql`:
   - extends documents.file_type to allow pdf and other file types
8. `009_superuser_documents_access.sql`:
   - expands RLS so superuser can access all documents and storage objects
9. `010_bootstrap_verebence_superuser.sql`:
   - sets is_superuser=true for a known email and ensures owner membership on projects
10. `011_align_membership_and_superuser_rules.sql`:
   - pins superuser identity to info@mame.works and adjusts policies
11. `012_project_laborer_memberships.sql`:
   - adds project_laborer_members join table
   - updates laborers access policies to include superuser override
12. `013_grant_admin_tables_privileges.sql`:
   - grants privileges so admin-managed tables work with RLS
13. `014_add_project_kind.sql`:
   - adds project_kind field to projects
14. `015_create_subcontractors_table.sql` + `016_subcontractors_optional_tax_and_office.sql`:
   - adds subcontractors and optional fields
15. `017_project_subcontractor_memberships.sql`:
   - adds project_subcontractor_members join table + RLS
16. `018_laborers_project_optional.sql`:
   - makes laborers.project_id optional (important for multi-assignment)
17. `019_laborers_email_and_access.sql`:
   - adds optional laborers.email and extends helper function to allow viewer access via laborer assignments.

---

## 12) "Video Storyboard" (Suggested 5-10 Minute Scene Plan)

The other LLM can convert this into a timed storyboard. Approximate times:

### Scene 1 (0:00-0:40) - What Promenade is
- Show a title card and one-line description.
- Mention: multi-project, role-based access, docs stored in Supabase Storage.

### Scene 2 (0:40-1:40) - Frontend structure
- Show `layout.tsx` sticky header and navigation.
- Show `Providers` -> `ProjectProvider`.
- Show `ProjectDropdown` selecting a project_id.
- Mention: localStorage persistence of project selection.

### Scene 3 (1:40-2:30) - Auth and superuser detection
- Show login/signup buttons calling Supabase auth endpoints.
- Show `HeaderNav` and `admin page` checking `profiles.is_superuser`.
- Explain: UI gating uses profiles; RLS is enforcement.

### Scene 4 (2:30-3:40) - The permission engine (RLS + helper)
- Visualize role hierarchy (owner/admin/member/viewer).
- Explain helper `user_has_project_access`.
- Explain global superuser override via `is_superuser()`.
- Mention later extension: viewer access via laborer email mapping.

### Scene 5 (3:40-5:10) - Documents end-to-end flow (deep)
- Step-by-step animation of `/documents`:
  1) list query `.eq("project_id", projectId)`
  2) client-side search and filter chips (docx/xlsx/photos)
  3) upload:
     - allowed extensions include pdf/images
     - sanitize filename
     - storage object key: `{projectId}/{uuid}_{sanitized}`
     - insert into `documents` with `file_type`
  4) view:
     - createSignedUrl for 5 minutes
     - office viewer for docx/xlsx
     - direct open for pdf/images
  5) rename:
     - update `documents.display_name`
- Highlight where RLS blocks cross-project access.

### Scene 6 (5:10-6:30) - Storage policies (deep but compact)
- Show bucket `project_files`.
- Show policy concept:
  - extract projectId from storage path
  - apply viewer/member role checks for SELECT/INSERT/UPDATE/DELETE

### Scene 7 (6:30-8:00) - Admin end-to-end flow (deep)
- Superuser only.
- Project CRUD:
  - insert into `projects`
  - also insert into `project_members` as owner
- Assignments:
  - compute diffs toAdd/toRemove for join tables
  - laborers assignment updates `project_laborer_members`
  - subcontractors assignment updates `project_subcontractor_members`
- Deleting a project triggers cascade deletion via foreign keys.

### Scene 8 (8:00-9:00) - Placeholders and what to expect next
- Dashboard/Finance/Calendar are mostly placeholder UI.
- Mention the intended scoping approach remains consistent: filter by projectId and rely on RLS.

### Scene 9 (9:00-10:00) - Recap
- One "system diagram recap":
  - Auth -> profiles -> role checks
  - ProjectContext -> query scoping
  - RLS helper -> actual enforcement
  - Documents -> storage signed URLs + metadata table
  - Admin -> superuser-managed CRUD + join-table assignments

---

## 13) Known Gaps / Practical Notes (Include in video as caveats)

1. Admin is superuser-only, enforced in UI and via RLS.
2. `ProjectDropdown` includes "Create project" dialog markup but no visible button to open it.
   Creating projects is effectively available via `/admin`.
3. Mobile drawer toggle wiring is not implemented in `layout.tsx` (drawer component exists).
4. `/finance` and `/calendar` are placeholder pages in current code.
5. Documents UI supports `pdf` for upload/view, but has no separate filter chip for `pdf`.

---

## 14) Reference Index (Key files)

Frontend:
- `src/app/layout.tsx`
- `src/components/Providers.tsx`
- `src/contexts/ProjectContext.tsx`
- `src/components/ProjectDropdown.tsx`
- `src/components/HeaderNav.tsx`
- `src/components/AccountButton.tsx`
- `src/app/documents/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/lib/supabase/client.ts`

Database + RLS:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/004_superuser_projects.sql`
- `supabase/migrations/005_create_project_files_bucket.sql`
- `supabase/migrations/006_fix_documents_rls_insert.sql`
- `supabase/migrations/008_allow_pdf_documents.sql`
- `supabase/migrations/009_superuser_documents_access.sql`
- `supabase/migrations/011_align_membership_and_superuser_rules.sql`
- `supabase/migrations/012_project_laborer_memberships.sql`
- `supabase/migrations/014_add_project_kind.sql`
- `supabase/migrations/015_create_subcontractors_table.sql`
- `supabase/migrations/017_project_subcontractor_memberships.sql`
- `supabase/migrations/018_laborers_project_optional.sql`
- `supabase/migrations/019_laborers_email_and_access.sql`

