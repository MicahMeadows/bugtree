# Bugtree

A React + Vite notebook for studying insect taxonomy, backed by Supabase and hosted on GitHub Pages.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The example environment contains this project's public URL and publishable key. Never put a service-role or secret key in a `VITE_` variable.

## Using the notebook

- The home page is a searchable library of named tree cards.
- **New tree** creates a chart and opens it in **Edit**, starting with an editable Insecta root.
- Opening an existing card starts in **View**. Switch between Edit and View at the top right.
- In Edit, select a taxon and edit its title and bullets directly on the card. Click its photo (or placeholder) to upload a picture. A trash icon on the editable card opens deletion confirmation. View displays the tree cards directly, without a side panel.
- Deleting a tree or customized taxon card requires typing its exact name. An untouched default card needs only a Delete/Cancel confirmation; this exemption does not apply to cards with descendants. Deleting a card also deletes its descendants; branch deletions can be undone while the chart remains open.
- Round + buttons to the right add the first child layer. Once that layer exists, use the + below existing child cards to add siblings. Drag cards in Edit to reorder within their parent; use the grip on an editable card, or drag a nonselected card. A drop indicator shows the position. The grip supports Up/Down arrow keys. Parent links and layers stay intact; moving a branch reorders its whole subtree. Reordering autosaves and supports Undo.
- Changes autosave three seconds after you stop editing. Editing stays available during autosave; newer edits are retained for the next save. Connection/server errors retry after ten seconds; version conflicts preserve edits and require reopening the chart. **Save** also persists your changes immediately. Switching to View or returning to the library saves first. If saving fails, edits remain in the editor; retry, export a JSON backup, or explicitly discard them. Closing or refreshing with unsaved edits triggers the browser's leave warning.
- Undo works throughout the current editing session, including after autosaves. Export creates a JSON backup of chart structure and notes; photo files remain in Supabase Storage and are referenced by path. JSON import is not included.
- Drag anywhere on the canvas to pan freely, including over taxon cards. Scroll the wheel or trackpad to zoom around the pointer; touch supports one-finger panning and two-finger pinch zoom. A click still selects a taxon. Zoom buttons and fit-to-screen remain available. Photos and notes are arranged in horizontal branches, inspired by the supplied reference screenshots.

Photos are resized to at most 1280 pixels and compressed before uploading. JPEG, PNG, and WebP inputs are supported. Each chart supports up to 200 taxa, 30 identification notes per taxon, and 12 layers.

## Password and persistence

The existing shared password and seven-day browser login are preserved. Charts are shared by everyone who knows that password. Passwords are stored as salted PBKDF2 hashes; sessions use random tokens whose digests and seven-day expiry are stored in the database. Logout revokes the current session.

All chart and photo requests go through the `site-api` Edge Function, which checks the site session before accessing data. Tables have RLS enabled, no public policies, and public grants revoked. This is intentional backend-only access. Photos live in the private `taxonomy-photos` bucket and are displayed through temporary signed URLs. The frontend refreshes those URLs every 50 minutes while a chart stays open.

Chart versions prevent one browser's stale edits from overwriting another browser's changes. Library deletion hides a chart using `deleted_at`; it does not permanently erase its data or photos. Removed/replaced photos remain in private storage so unsaved edits and undo do not break image references. The previous todo table is retained but is no longer part of the app.

Migrations under `supabase/migrations/` have been applied to project `jzqykdyodloyghsafhrd`, and the updated Edge Function is deployed. To deploy future function changes:

```sh
npx supabase functions deploy site-api --project-ref jzqykdyodloyghsafhrd
```

Custom site-session authentication is why `verify_jwt` is disabled in `supabase/config.toml`. Keep the service-role key exclusively in Supabase's backend environment. For a different project, apply the SQL migrations, deploy the function, and update the environment values.

## GitHub Pages

1. In **Settings → Pages**, select **GitHub Actions** as the source.
2. Push to `main`, or run **Deploy to GitHub Pages** from Actions.
3. Open https://micahmeadows.github.io/bugtree/ after deployment succeeds.

Optional Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` override the connected project's public configuration. The workflow builds with `/bugtree/` as the asset base; update `vite.config.js` if the repository name changes or you use a custom domain. GitHub Pages serves static files; Supabase handles data, photos, and password checks.

## Verification

```sh
npm test
npm run build
SITE_TEST_PASSWORD='<site password>' npm run test:database
```

The local tests verify tree topology, layout, branch ordering, depth limits, edit/view rendering, and retaining concurrent local edits during autosave. The live smoke test verifies authentication, chart creation and persistence, conflict checks, invalid-tree rejection, private photo upload and reload, deletion, and logout revocation. Its chart is soft-deleted after the test.
