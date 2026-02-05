import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const actionBase = repoName ? `/${repoName}/` : '/';
const base = process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? actionBase : '/');

export default defineConfig({
  base,
  plugins: [react()],
});
