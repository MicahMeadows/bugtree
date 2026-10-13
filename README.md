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

Todos load on startup. Add a task, check it off, or delete it; each change is saved to Supabase. Reload or use Refresh to fetch the latest shared list. Failed requests show an error without discarding your input. Enter the shared site password on first visit; this browser remembers the session for seven days. Log out revokes the session immediately.

## Database

The `create_todos` migration under `supabase/migrations/` has already been applied to project `jzqykdyodloyghsafhrd`. It creates the table and title constraints. The subsequent `add_site_password` migration has also been applied and replaces public access with backend-only access.

The list is shared by everyone who knows the site password. The database stores a salted PBKDF2 password hash and digests of random session tokens, with a fixed seven-day expiry enforced on the backend. Only the `site-api` Edge Function can access the tables; direct browser database requests are denied. The function rate limits password attempts to 20 per IP per 15 minutes. Sessions are cached in browser local storage; the password is never cached.

GitHub Pages serves public static assets, including the login screen. The password protects todo data and operations. This is one shared password, without individual user accounts.

The Edge Function is already deployed. After editing its code, deploy it with `npx supabase functions deploy site-api --project-ref jzqykdyodloyghsafhrd`. Its custom session authentication is why `verify_jwt` is disabled in `supabase/config.toml`. Keep the service-role key exclusively in Supabase’s server environment.

To use a different project, apply both SQL migrations in its SQL Editor, deploy the Edge Function, and update the environment values.

## GitHub Pages

1. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push these files to `main`, or run **Deploy to GitHub Pages** manually from Actions.
3. The site will be available at https://micahmeadows.github.io/bugtree/.

The workflow includes the connected project's public configuration. Optional repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` override it. The build sets the asset base to `/bugtree/`; change `vite.config.js` if you rename the repository or use a custom domain. No server runtime is required.

```sh
npm run build
npm run preview
```

## Verification

`npm run build` checks the frontend build. Run `SITE_TEST_PASSWORD='<site password>' npm run test:database` to test login, protected CRUD, seven-day expiry duration, direct-access denial, and logout revocation against the configured project. Smoke-test rows and sessions are cleaned up.
