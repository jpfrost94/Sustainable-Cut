# Sustainable Cut v3

Production-ready React app for a profile-driven 16-week cutting protocol.

## Tech Stack

- React + Vite
- Recharts (lazy-loaded on Trends view)
- Browser storage (`window.storage` when available, `localStorage` fallback)

## Local Development

```bash
npm install
npm run dev
```

Open the URL shown in terminal.

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
5. Deploy.

### Netlify

1. Push this repo to GitHub.
2. Import the repo in Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

### Any Static Host

Upload the `dist/` folder contents.

## Project Structure

- `src/App.jsx`: main app UI + protocol logic
- `src/TrendsCharts.jsx`: chart components (split from main bundle)
- `src/main.jsx`: React entry point

## Notes

- App data is persisted automatically in browser storage.
- JSON and CSV export are available in Settings.
