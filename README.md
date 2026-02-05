# Sustainable Cut v3

Production-ready React app for a profile-driven 16-week cutting protocol.

## Tech Stack

- React + Vite
- Recharts (lazy-loaded on Trends view)
- Browser storage (`window.storage` when available, `localStorage` fallback)
- Optional Supabase auth + cloud sync for cross-device data

## Local Development

```bash
npm install
npm run dev
```

Open the URL shown in terminal.

## Cloud Sync Setup (Supabase)

Cloud sync is optional. If env vars are missing, the app stays local-only.

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Restart `npm run dev`.

After setup, users can sign in on onboarding/settings and sync profile/logs across devices.

## Production Build

```bash
npm run build
npm run preview
```

- Build output is generated in `dist/`
- `npm run preview` serves the production build locally

## Deploy (Fastest Options)

### Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Build command: `npm run build`
4. Output directory: `dist`
5. If using cloud sync, add env vars in project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

### GitHub Pages (already configured in this repo)

1. Push to `main`.
2. Workflow builds and publishes to `gh-pages`.
3. If using cloud sync, add GitHub repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Site URL: `https://jpfrost94.github.io/Sustainable-Cut/`

### Netlify

1. Push this repo to GitHub.
2. Import the repo in Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. If using cloud sync, add env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

### Any Static Host

Upload the `dist/` folder contents.

## Project Structure

- `src/App.jsx`: main app UI + protocol logic
- `src/TrendsCharts.jsx`: chart components (split from main bundle)
- `src/useCloudSync.js`: Supabase auth + sync orchestration
- `src/lib/cloudClient.js`: Supabase client bootstrap
- `src/main.jsx`: React entry point
- `supabase/schema.sql`: database schema + RLS policies

## Notes

- App data is persisted automatically in browser storage.
- JSON and CSV export are available in Settings.
- With Supabase configured, profile/logs/weekly state is synced per user account.
