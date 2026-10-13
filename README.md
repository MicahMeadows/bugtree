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
- Round + buttons to the right add the first child layer. Once that layer exists, use the + below existing child cards to add siblings. Click **Unlock layout** in Edit before dragging cards to move them freely with all descendants; use the grip on an editable card, or drag a nonselected card. Connections follow the branch. Moving autosaves and supports Undo.
- Changes autosave three seconds after you stop editing. Editing stays available during autosave; newer edits are retained for the next save. Connection/server errors retry after ten seconds; version conflicts preserve edits and require reopening the chart. **Save** also persists your changes immediately. Switching to View or returning to the library saves first. If saving fails, edits remain in the editor; retry or explicitly discard them. Closing or refreshing with unsaved edits triggers the browser's leave warning.
- Undo works throughout the current editing session, including after autosaves.
- **Flash cards** in the top-right mode switch lets you study all taxa with photos. Tap the picture to reveal its name, then tap again to advance to the next card; use Previous to go back (or arrow keys to navigate), and Shuffle to randomize it. Cards without photos are skipped. Entering study mode saves pending edits first.
- The default Column layout aligns all leaf cards vertically and starts at the top at a readable size. Use the bottom-left Alignment toggle to choose Column or Graph. Both alignments use the same free panning, wheel zoom, touch gestures, and zoom controls.
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

- Trees start with the column layout. In Edit, choose **Suborder** in a card's Type control; clear its title to show a colored 48px circle. Click anywhere on a connector to insert a 24px gray dashed redirect point, then drag it to move its subsection. Redirects are invisible in View while their connector routes remain. Hover a redirect and click its **×** to confirm removal; children keep their notes/photos and positions. Positions autosave and support Undo.
- `supabase/imports/bug11-heteroptera.json` records the names, readable notes, and branch structure imported from bug11. The initial import left photos blank; `supabase/imports/bug12-14-heteroptera.json` records the 18 photo crops and clearer notes added from bug12–14.

- Node dragging starts locked when entering Edit. Use the bottom-left **Unlock layout / Lock layout** control; card editing, panning, and zooming stay available while locked. Column mode keeps positions fixed.
