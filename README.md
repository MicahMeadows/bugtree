# Bugtree

A simple React + Vite hello-world todo app backed by Supabase, ready for GitHub Pages.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The example environment contains this project's public URL and publishable key. These are browser-safe configuration; never put a service-role or secret key in a `VITE_` variable.

Todos load on startup. Add a task, check it off, or delete it; each change is saved to Supabase. Reload or use Refresh to fetch the latest shared list. Failed requests show an error without discarding your input.

## Database

The `create_todos` migration under `supabase/migrations/` has already been applied to project `jzqykdyodloyghsafhrd`. It creates the table, title constraints, explicit column grants, and row-level security policies.

This is intentionally a public shared demo: every visitor can read, add, complete, and delete all tasks. Do not store private data. For personal lists, add Supabase Auth and replace the shared policies with user ownership checks before collecting real user data.

To use a different project, apply the SQL migration in its SQL Editor and update the environment values.

## GitHub Pages

1. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push these files to `main`, or run **Deploy to GitHub Pages** manually from Actions.
3. The site will be available at https://micahmeadows.github.io/bugtree/.

The workflow includes the connected project's public configuration. Optional repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` override it. The build sets the asset base to `/bugtree/`; change `vite.config.js` if you rename the repository or use a custom domain. No server runtime is required.

```sh
npm run build
npm run preview
```
