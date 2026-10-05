# VoTech Connect

VoTech Connect connects vocational students with supervised community projects. It is a React, TypeScript, and Vite frontend backed by Supabase Auth and PostgreSQL.

## Local development

Requirements: Node.js 20.19+ or 22.12+, npm, a Supabase project, and (for the optional roster panel) a Google Cloud OAuth web client.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and provide the Supabase project URL and anon/publishable key.
3. Start the app with `npm run dev`.

Available checks:

```sh
npm run build
npm run lint
```

## Supabase setup

Create the `profiles`, `projects`, and `field_hours` tables described in the project schema. The current frontend expects:

- `profiles`: `id`, `full_name`, `role`, `trade_area`
- `projects`: `id`, `resident_id`, `assigned_student_id`, `title`, `description`, `trade_category`, `location`, `status`, `created_at`
- `field_hours`: `id`, `student_id`, `project_id`, `hours_logged`, `status`, `teacher_id`, `created_at`
- `partner_opportunities` and `placement_interests`: created by the industry-learning migration below

The profile ID should reference the matching Supabase Auth user. Configure the `handle_new_user()` trigger to accept only public roles (`student` and `resident`) from signup metadata. Provision teachers and admins through a trusted administrator workflow; never trust a browser-provided role or invite code for elevated access.

Apply the migrations in timestamp order. [`20261005140000_harden_public_signup_roles.sql`](./supabase/migrations/20261005140000_harden_public_signup_roles.sql) enforces public signup roles in the existing profile trigger and checks student school email and trade-area values on the server. [`20261005143000_industry_learning_placements.sql`](./supabase/migrations/20261005143000_industry_learning_placements.sql) adds separately provisioned industry-partner roles, supervised-learning placement tables, and RLS policies for listing review and student introductions. Review and apply these in a staging Supabase project first. The signup migration assumes the existing profile table has an `email` column and that its profile-creation trigger calls `public.handle_new_user()`.

Keep Row Level Security enabled. Policies should enforce, in the database, that:

- Residents create and read their own projects; they cannot approve projects or assign students.
- Students can read only approved, unassigned opportunities and their own assignments/hour records; a claim must be atomic and cannot overwrite an existing assignment.
- Teachers can read pending review items and update only permitted approval/status columns.
- Admin privileges are granted only through a trusted role assignment and are explicitly covered by RLS policies.
- Industry partners are provisioned by an administrator; their listings remain private until teacher approval, and student interest requests are private until a teacher records a decision.
- Student contact details and exact work locations are not exposed to residents or to unauthenticated users.

The app displays Supabase errors when a policy blocks an action. Do not disable RLS to make the UI work. Verify the trigger and policies in a non-production project before using real student information.

## Google Classroom (optional, read-only)

The teacher workspace can list classes and load class teacher/student rosters using the Google Classroom REST API. Names and emails stay in browser memory for the current session; this app does not write roster data into Supabase.

1. In Google Cloud Console, select/create a project and enable **Google Classroom API**.
2. Configure the OAuth consent screen for the school’s intended audience and add test users during development. Google may require additional consent-screen verification before external users can authorize the requested scopes.
3. Create an OAuth client ID of type **Web application**.
4. Add the app’s exact local origin (for Vite, typically `http://localhost:5173`) to **Authorized JavaScript origins**. Add the production HTTPS origin before deployment.
5. Add this to `.env.local`, then restart Vite:

   ```env
   VITE_GOOGLE_CLASSROOM_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

The client ID is intended to be public in browser code. Never put a Google client secret or Supabase service-role key in a `VITE_` variable. A teacher must connect a Google account that is authorized to view the class rosters. School Google Workspace policies, Classroom API enablement, OAuth consent status, and user permissions can still deny access. The application must display those errors rather than treating a failed sync as an empty roster.

## Current workflow boundaries

- Resident project posts use a curated low-risk task list and remain hidden from student discovery until teacher approval.
- Student project claims remain pending teacher approval before the project becomes active.
- Students submit field hours for teacher sign-off.
- Verified industry partners can propose trade-learning placements, disclose a proposed compensation arrangement, and receive only counts of teacher-approved student introduction requests. Contact exchange stays outside the app and must follow school policy.
- Industry placements are not job offers and do not promise that work or logged hours satisfy state apprenticeship, licensing, wage, or school-credit requirements.
- Admin mode previews are read-only role workspaces. They do not impersonate another Supabase user or bypass RLS.
- Google Classroom roster access is read-only; roster/course records are not copied into VoTech Connect.

This is an MVP, not a substitute for school safeguarding, supervision, insurance, licensing, or records-retention procedures. Complete an RLS review, use approved Google Workspace configuration, and test each role with non-production accounts and data before any public submission or real-world use.
