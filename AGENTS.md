# AGENTS.md — Promenade

Guidance for AI agents and developers working on this codebase.

---

## 1. Project Overview

**Promenade** is a mobile-first construction management web app focused on:

- Administrative convenience
- High scalability for mobile use
- Multi-user access with role-based permissions

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS (Material Design 3–inspired) |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Fonts | Roboto (sans), Lora (serif) via `next/font/google` |

**Dependencies (key):**

- `next` 14.2.x
- `@supabase/ssr`, `@supabase/supabase-js`
- `tailwindcss` 3.4.x

Avoid heavy UI libraries; prefer Tailwind for M3-style components.

---

## 3. Design Specifications

### Palette

- **Base:** Black and white
- **Primary / accent:** `#f4ac1f` (construction orange) — action buttons, active states, highlights

### Typography

- **Roboto:** Functional data, labels, UI elements
- **Lora:** Section headers and “architectural” accents

### Tailwind Tokens

Defined in `tailwind.config.ts`:

- `primary`, `primary-50` … `primary-900`
- `surface`, `surface-variant`
- `outline`
- `font-sans` → Roboto, `font-serif` → Lora
- `shadow-m3-1`, `shadow-m3-2`, `shadow-m3-fab`

---

## 4. Project Structure

```
promenade/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, header, nav
│   │   ├── page.tsx            # Dashboard (/)
│   │   ├── documents/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── finance/page.tsx
│   │   └── globals.css
│   ├── contexts/
│   │   └── ProjectContext.tsx  # projectId state (not yet wired)
│   └── lib/
│       └── supabase/
│           └── client.ts       # Browser Supabase client
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── tailwind.config.ts
├── package.json
└── AGENTS.md
```

---

## 5. Database Schema

Migration: `supabase/migrations/001_initial_schema.sql`

### Enums

- `user_role`: `owner` | `admin` | `member` | `viewer`
- `expense_category`: `materials` | `services`
- `invoice_status`: `draft` | `sent` | `paid` | `overdue`

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` (email, full_name, avatar_url) |
| `projects` | Core entity (name, description, address, status, dates) |
| `project_members` | user ↔ project with role |
| `laborers` | Workers per project (name, daily_wage) |
| `work_logs` | Daily work (laborer_id, work_date, hours_worked) |
| `expenses` | project_id, category, amount, expense_date |
| `invoices` | project_id, invoice_number, amount, status |
| `documents` | project_id, file_name, file_path, file_type (docx|xlsx) |
| `milestones` | project_id, title, milestone_date |

### Row Level Security (RLS)

- Helper: `user_has_project_access(user_id, project_id, min_role)`
- Role hierarchy: owner > admin > member > viewer
- All project-scoped tables: access via `project_members`
- `profiles`: users see only their own row

### Triggers

- `on_auth_user_created` → inserts a `profiles` row on signup

### Storage

- Documents use Supabase Storage; bucket and RLS to be configured separately.

---

## 6. Global Logic: Project Selection

When a project is selected in the header:

1. All pages (Finance, Documents, Calendar, etc.) must filter data by that `project_id`.
2. `ProjectContext` (`src/contexts/ProjectContext.tsx`) holds `projectId` and `setProjectId`.
3. **Current state:** `ProjectContext` is not yet wrapped in the root layout or connected to the header dropdown. Wire `ProjectProvider` in `layout.tsx` and connect the dropdown’s `onChange` to `setProjectId`.
4. Use `useProject()` in pages/components when querying Supabase (e.g. `project_id.eq(projectId)`).

---

## 7. Layout & Navigation

### Sticky Header

- Always visible (`sticky top-0`)
- Contains: “Promenade” title, project dropdown, desktop nav, mobile menu trigger

### Project Dropdown

- Placeholder options; should be populated from `projects` via Supabase.
- Must call `setProjectId` on change once `ProjectContext` is wired.

### Desktop Navigation (md+)

- Horizontal links: Dashboard, Documents, Calendar, Finance

### Mobile Navigation

- Bottom bar (thumb-friendly) with icons and labels.
- `MobileDrawer` is built but not yet opened by `MobileNavTrigger`; add JS to toggle `translate-x-full` and `aria-hidden`.

---

## 8. Pages & Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard | Placeholder summary |
| `/documents` | Documents | Placeholder list + FAB for upload |
| `/calendar` | Calendar | Placeholder milestone schedule |
| `/finance` | Finance | Placeholder sections for laborers, expenses, invoices |

### Page Requirements (from spec)

- **Documents:** List .docx and .xlsx, FAB for “Upload”
- **Calendar:** Schedule view for project milestones
- **Finance:** Laborers (names, daily wages, totals; filter by month/week); Expenses (Materials, Services); Invoices (billing status)

---

## 9. Supabase Client

- File: `src/lib/supabase/client.ts`
- Uses `createBrowserClient` from `@supabase/ssr`
- If env vars are missing, returns a client pointing at placeholder URL (no real requests)

---

## 10. Environment Variables

`.env.local` (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 11. Conventions & Patterns

1. **Mobile-first:** Design for small screens first; `md:` for desktop adjustments.
2. **M3-style UI:** Use Tailwind tokens; avoid extra UI libraries unless necessary.
3. **Data scoping:** Always filter by `project_id` when a project is selected.
4. **RLS:** Rely on Supabase RLS; no client-side-only access control.
5. **Modularity:** Keep components focused; extract shared UI where useful.
6. **Vercel:** Structure supports free-tier deployment.

---

## 12. Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run start
npm run lint
```

---

## 13. Migration Setup

Run `supabase/migrations/001_initial_schema.sql` in the Supabase project:

- Dashboard → SQL Editor → paste and execute

---

## 14. Pending / TODO

- [ ] Wrap app with `ProjectProvider` and connect dropdown to `setProjectId`
- [ ] Wire mobile drawer open/close to `MobileNavTrigger`
- [ ] Implement auth flow (login, signup, protected routes)
- [ ] Populate project dropdown from Supabase
- [ ] Implement each page’s data fetching and forms
- [ ] Configure Supabase Storage bucket for documents
- [ ] Add active-route highlighting for nav links (e.g. via `usePathname`)
