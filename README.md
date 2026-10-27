# VoTech Connect

VoTech Connect is a web app that connects vocational students with supervised community projects and career-learning opportunities. Students can explore approved projects and track field hours; residents can submit projects; teachers review projects, assignments, and hours; and industry partners can propose learning placements.

![VoTech Connect cover](public/votech-connect-cover.jpg)

## Technology

- React, TypeScript, and Vite
- Supabase Auth and PostgreSQL
- Optional Google Classroom roster integration for teachers

## Run locally

1. Install Node.js 22 or later.
2. Install dependencies: `npm ci`
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and anon/publishable key.
4. Start the development server: `npm run dev`

Check the app with `npm run build` and `npm run lint`.

## Publish with GitHub Pages

The GitHub Actions workflow deploys the `main` branch to GitHub Pages. Before the first deployment:

1. In the repository’s **Settings → Secrets and variables → Actions**, add secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Push to `main` or run the **Deploy to GitHub Pages** workflow.
4. In Supabase **Authentication → URL Configuration**, set the deployed app URL as the Site URL and add it to the redirect allow list. Include the local development URL if needed.

The Supabase URL and publishable/anon key are included in the public browser build. They are designed to be public; database security must come from correctly configured Row Level Security (RLS). Never use a Supabase `service_role` or secret key in this app.

The database must already contain the app’s required tables and authentication setup. The SQL files in [`supabase/migrations`](supabase/migrations) are incremental migrations and do not create the entire database from scratch. Review and apply them to the intended Supabase project in timestamp order.

Google sign-in requires Google to be enabled as a Supabase Auth provider. The optional Classroom roster feature also requires a Google OAuth web client configured for the deployed site origin.
