# Estaro frontend

React + TypeScript with Bun, Vite, Tailwind CSS v4, shadcn/ui, TanStack Router, and TanStack Table v9.

## Development

Start PostgreSQL and MinIO and apply migrations using the
[backend setup](../backend/README.md). Vite proxies `/api` to `API_PROXY_TARGET`.

Run these commands from `frontend/` with Bun 1.4.3 or later:

```sh
bun install --frozen-lockfile
bun run dev
```

Vite prints the local development URL. The inquiry inbox is at `/`.
Artikel (`/artikel`) and Kunden (`/kunden`) show imported master data in
shadcn/TanStack Table views with server-side pagination (25, 50 or 100 rows).
The old `/table` URL redirects to `/artikel`.

The shadcn sidebar links to Anfragen, Kunden and Artikel and shows the ten newest
completed inquiries by document filename. It refreshes every ten seconds and after uploads
or deletions. On mobile, the navigation opens as a sheet.

The "Upload" button opens a dialog accepting one PDF, one MSG, or both together.
The dialog closes after a successful upload. `Upload` owns dialog
state and the trigger; the dialog loads on first open and preserves selected files
when closed and reopened.
Downloads run through the backend. The development upload can be disabled in the
backend configuration.

The inbox switches between list and table views with server-side search, review
status filtering, sorting and pagination. Only completed pipelines appear here.
The processing dropdown paginates queued, running, cancelled and failed jobs and polls active
jobs every two seconds. Completion refreshes the inbox; otherwise it polls every
ten seconds. Overview scores reuse the detail view's traffic-light rules. Status
is Neu, In Prüfung after a saved review, or Geprüft once every position is confirmed.
MSG receipt time comes from its delivery metadata, never the upload timestamp.
Missing metadata stays unknown. New extractions include a cited, editable delivery
date; earlier results remain readable without one.

“Verarbeitung abbrechen” stops queued or running jobs. Running work shows
“Wird abgebrochen …” until the worker has stopped. Cancelled inquiries stay in
the processing dropdown for inspection or deletion.
“Löschen” in the list, processing dropdown or detail page opens a confirmation.
Deletion removes the whole inquiry, files, results, review and job history.
Running jobs must stop before deletion; errors stay visible for retry. Deleting
from the detail page returns to the inbox.
Deletion and inline master-data search load on demand.

Selecting an inquiry opens `/anfragen/{id}` with request details and positions,
customer/contact information, review progress and traffic-light status. Email text
and downloadable files appear side by side below the request information, without tabs. Saved corrections are
reflected in the overview. “Zur Prüfung” opens `/anfragen/{id}/pruefung`;
“Zur Übersicht” returns to the overview.

The review shows extracted fields and exact source quotes
on the left, selectable PDF originals and MSG reading views on the right. Field
labels connect fields with PDF boxes and email text highlights. Clicking a field or quote selects
its document and PDF page or email passage. Clicking a source highlight selects the
corresponding extraction; the selected PDF box is outlined and scrolled into view.
PDF pages appear in one continuous scroll view with orange source marks. A compact
toolbar provides file selection, download and optional source warnings.
Pages near the viewport render on demand; field selection scrolls within the source
viewer. Checked fields show a distinct status and can still be edited directly.
PDF attachments stay separate and can be downloaded. Missing,
unverified and conflicting fields are labelled explicitly. PDF.js and its local
worker load only when a PDF preview is opened; email HTML is displayed as plain text.
Field edits preserve the source viewer; page and citation indexes are reused between
selections. Candidate details share a query cache and stay fresh for one minute.

The review separates customer/contact, request details and article positions; only one
section opens at a time. Selecting a field or source opens its section automatically.
Fields are directly editable. Check fields individually or confirm a whole position;
use “Nächste Angabe” and the unchecked-only filter to work through the request.
Customer suggestions can be selected or replaced using name/number search.
“Zwischenstand speichern” (also Ctrl/Cmd+S) persists corrections, customer assignment
and review progress separately from the extraction. Editing a checked value clears
its check; editing the customer name also clears its assignment. Unsaved changes
trigger a leave-page warning, and concurrent saves are rejected with a conflict.

## API client

With the backend running, generate the client after changing routes or schemas:

```sh
bun run api:generate
```

This uses [swagger-typescript-api](https://github.com/acacode/swagger-typescript-api)
to fetch `http://localhost:8000/openapi.json` and generate `src/lib/generated/Api.ts`.
Commit the generated client; do not edit it manually. To use another backend, run
`bun run api:generate http://localhost:8001/openapi.json`.

`ApiProvider` creates a stable client using `/api`, and `useApi()` exposes it to
hooks. Requests use generated methods and types; TanStack Query handles caching
and polling. `src/lib/api.ts` configures shared error handling.

## Checks and production build

```sh
bun run lint
bun run test
bun run build
bun run preview
```

The build checks TypeScript and writes production assets to `dist/`. Configure production hosting to serve `index.html` for application routes such as `/artikel` and `/kunden`.

## Project layout

- `src/routes/`: file-based TanStack Router routes. Add a route here while the dev server is running to regenerate types.
- `src/routeTree.gen.ts`: generated route tree; keep it in version control and do not edit it manually.
- `src/components/ui/`: shadcn/ui components, owned by this project.
- `src/components/data-table.tsx`: shared TanStack Table v9 view with loading, error and empty states.
- `src/hooks/use-paginated-table.ts`: TanStack Query requests and controlled server pagination.
- `src/components/master-data/`: article and customer column definitions.
- `src/index.css`: Tailwind imports and shadcn theme tokens.
- `src/lib/utils.ts`: component class-name utility.

The `@/` import alias points to `src/` in both Vite and TypeScript.

Review, matching and source-viewer copy uses `react-i18next`, initialized in
`src/i18n.ts`. German is the default and fallback; translations live in
`src/locales/de.json`. Keep new review copy there, including accessible labels.

Add shadcn components with:

```sh
bunx --bun shadcn@latest add input
```

`lib/inquiry-review.ts` owns Position membership, assignment/confirmation dependencies
and confirmation reconciliation. Revision transitions live in `lib/inquiry-review-state.ts`;
`use-inquiry-review.ts` exposes separate editor, source and persistence interfaces.
`lib/inquiry-evaluation.ts` indexes fields and matching targets once for status and
suggestion calculations across review, overview and detail.
Clean refetches adopt newer revisions; dirty edits stay intact until the user loads
the new review or reapplies local changes.
HTTP 409 triggers a refresh and blocks saving until that conflict is resolved.
Matching suggestions appear directly in each customer/article section and can be
accepted or replaced through inline master-data search at any point. Changed values
suppress stale suggestions. “Alles bestätigen” checks all fields and positions,
including collapsed sections, while preserving individual editing and confirmation.
It updates the draft; saving remains explicit. “Prüfung abschließen” confirms all fields and positions
and saves them together once the customer and every article are assigned.
“Zwischenstand speichern” (also Ctrl/Cmd+S) saves partial progress. Changing a position clears its article assignment; changing the
customer name clears its customer assignment. Original extraction stays intact.
Field, citation and document selection share the review lifecycle. Reading DTOs
contain text and page dimensions; highlight boxes come from resolved citations.
