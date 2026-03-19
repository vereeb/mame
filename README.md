# Promenade

Mobile-first construction management web app built with Next.js, Tailwind CSS, and Supabase.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (Roboto + Lora)
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **UI:** Material Design 3 (Tailwind-based)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your Supabase credentials.

3. Run the Supabase migration in your project’s SQL Editor:
   - `001_initial_schema.sql`, `002_documents_metadata_update.sql`, `003_seed_dummy_projects.sql`
   - Run each in Supabase Dashboard → SQL Editor (003 adds 2 test projects)

4. Run the dev server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Project Selection

When a project is selected from the header dropdown, all pages (Finance, Documents, etc.) show data filtered by that `project_id`.

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the full schema including:

- `profiles` – User profiles
- `projects` – Projects
- `project_members` – User–project access (RLS)
- `laborers` – Workers with daily wages
- `work_logs` – Daily work entries
- `expenses` – Materials & services
- `invoices` – Billing status
- `documents` – File references (.docx, .xlsx)
- `milestones` – Calendar entries

## Storage (Documents)

1. In Supabase Dashboard → Storage, create a bucket named `project_files`.
2. Configure RLS policies so users can only access files for projects they belong to.
3. Files are stored as `{project_id}/{uuid}_{filename}`.

## Deployment

Suitable for Vercel free tier. Add environment variables in the Vercel project settings.
