# Review Works

Review Works is a tenant-aware case and task management application for a five-step environmental review workflow. It combines a Next.js user interface with Supabase authentication and PostgreSQL data, role-based task handoffs, document drafting, approval and revision loops, notifications, and an optional embedded HedgeDoc editor.

## What the application does

The workflow begins after authentication:

| Step | Activity | Primary role | Result |
| --- | --- | --- | --- |
| 1 | Authenticate | System / Applicant | A Supabase session and authentication payload |
| 2 | Enter project information | Applicant | Project fields and a decision payload |
| 3 | Draft the applicant document | Applicant | A submitted draft document |
| 4 | Prepare the environmental analysis | Analyst | A submitted analysis document |
| 5 | Approve or request changes | Approver | A completed case or a new Step 4 revision task |

The app assigns the analyst and approver from tenant-scoped role assignments. The applicant cannot review their own work, and the analyst cannot approve their own analysis. An approval completes both the process and project. A change request stores the approver's feedback, notifies the analyst, and returns the case to Step 4.

Additional user-facing features include:

- Public Home, About, and Developer Resources pages
- Sign in with Login.gov (through the Keycloak broker); a verified .gov or .mil account is enrolled as Applicant on first sign-in, anyone else sees a not-enrolled page
- Email/password sign-up, sign-in, confirmation callback, and sign-out (kept for demo accounts)
- A dashboard containing active tasks, recent cases, role badges, and notifications
- A tenant-filtered case list and a case detail timeline
- JSON Schema forms rendered with React JSON Schema Form (RJSF)
- Internal Markdown editing, preview, and draft saving
- Optional HedgeDoc note creation and embedded collaborative editing
- An OAuth consent endpoint for Supabase OAuth authorization flows
- Runtime configuration injected from the server environment

See [User guide](docs/USER_GUIDE.md) for the complete product behavior.

## Architecture at a glance

- **Web:** Next.js 14 App Router, React 18, TypeScript
- **UI:** Tailwind CSS
- **Auth and data:** Supabase Auth, PostgREST, and PostgreSQL
- **Forms:** RJSF with AJV 8 validation
- **Documents:** application-managed Markdown or optional HedgeDoc
- **Deployment:** cloud.gov (Cloud Foundry) with the Node.js buildpack, through a guarded deploy script
- **Isolation:** one configured tenant slug per deployed app instance; tenant membership gates server-rendered application pages and `tenant_id` scopes runtime records

The current application expects the **canonical tenant-aware Supabase schema**. The SQL and CSV files in `database-schema/` are legacy PIC v1.2.0 bootstrap/reference assets and do not by themselves create the canonical tenant and membership tables.

See [Architecture](docs/ARCHITECTURE.md) for routes, components, data ownership, authorization boundaries, and workflow state.

## Prerequisites

- Node.js 22
- npm
- A Supabase project containing the canonical tenant-aware schema
- A tenant whose slug matches the application configuration
- Seeded Review Works process model, decision elements `1` through `5`, and roles `1` through `3`
- An active `user_tenant_membership` for each user
- A tenant-scoped `user_assignments` row for each workflow role a user can perform
- Optional: a HedgeDoc instance configured to allow embedding from the Review Works origin

## Local setup

The Next.js package lives in `app/`.

```bash
git clone <repository-url>
cd complex-review
cp .env.example app/.env.local
cd app
npm ci
npm run dev
```

Open `http://localhost:3000`.

The root `.env.example` is the configuration reference. The app reads `app/.env.local` during local Next.js development. Never commit a populated environment file or a Supabase service-role key.

## Configuration

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser and server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser and server | Supabase anonymous/publishable key |
| `NEXT_PUBLIC_TENANT_SLUG` | Recommended | Browser and server | Tenant selected by browser-side queries; defaults to `reviewworks` |
| `CANONICAL_TENANT_SLUG` | Recommended | Server | Tenant selected by server-side membership checks; falls back to `NEXT_PUBLIC_TENANT_SLUG`, then `reviewworks` |
| `NEXT_PUBLIC_APP_BASE_URL` | Production | Browser and server | Public application origin used for redirects and deployment configuration |
| `SUPABASE_SECRET_KEY` | Yes | Server only | Supabase secret key (`sb_secret_...`); every write goes through the API routes with it, after the route checks the caller's session and role |
| `HEDGEDOC_BASE_URL` | Optional | Server | Enables HedgeDoc integration and provides the iframe origin |
| `HEDGEDOC_API_TOKEN` | Optional | Server only | Bearer token used when creating or reading HedgeDoc notes |

`NEXT_PUBLIC_TENANT_SLUG` and `CANONICAL_TENANT_SLUG` should resolve to the same active tenant. Public variables are exposed to the browser; do not put secrets in them.

## Database requirements

The application reads or writes these tenant-scoped tables:

- `tenant` and `user_tenant_membership` for tenant resolution and access
- `user_role` and `user_assignments` for workflow role assignment
- `project` and `process_instance` for case state
- `process_model` and `decision_element` for workflow configuration and the Step 2 form schema
- `case_event` for tasks, notifications, and completion metadata
- `document` for applicant and analyst documents
- `process_decision_payload` for submitted form data and decisions

Runtime case, task, document, and payload operations are scoped with the configured `tenant_id`. Row Level Security should enforce the same boundary in the database. Client-side filtering is not a substitute for RLS.

For schema history and the limitations of the bundled SQL, see [Database schema notes](database-schema/README.md). For REST integrations, see [API integration guide](app/docs/API_INTEGRATION.md).

## Commands

Run commands from `app/`:

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # start the production server
npm run lint           # ESLint
npm run typecheck      # TypeScript, no emit
npm test               # Vitest
npm run license-check  # production dependency licenses against license-policy.json
npm run sbom           # CycloneDX SBOM in app/sbom/
npm run deploy:cloud   # cloud.gov deploy (dry run unless --apply)
```

## Continuous integration

GitHub Actions runs on every pull request and on pushes to `main`. The workflows need no secrets.

- `.github/workflows/ci.yml`: lint, typecheck, tests, build, production `npm audit` at high severity, license check, SBOM (kept as a build artifact), dependency review on pull requests, and a gitleaks scan of the full history.
- `.github/workflows/codeql.yml`: CodeQL for JavaScript and TypeScript, also weekly.
- `.github/dependabot.yml`: weekly grouped npm and GitHub Actions updates.

Actions are pinned to full commit SHAs.

## Deployment

Review Works deploys to cloud.gov as the app `reviewworks`, built with the Node.js buildpack.

- **Live target:** `https://reviewworks.app.cloud.gov` (override with `DEPLOY_APP_BASE_URL`)
- **Health check:** `/api/health`
- **Command**, from `app/` after `cf login` and `cf target` to the right space:

```bash
npm run deploy:cloud            # dry run: names the variables it will set
npm run deploy:cloud -- --apply # build, cf push --no-start, set the environment, start
```

The script reads the hosted environment from `app/.env.cloudgov` (or `DEPLOY_ENV_FILE`), which is never committed or pushed. It requires the Supabase URL, the publishable key and `SUPABASE_SECRET_KEY`, refuses a secret key in the public variable, sets the runtime environment through the cloud.gov API without printing values, and only then starts the app. `manifest.yml` holds no environment values. The Supabase authentication settings must allow the deployed origin and `/auth/callback` redirect.

See [Operations and deployment](docs/OPERATIONS.md) for configuration, data preparation, OAuth, HedgeDoc, migration, troubleshooting, and release checks.

## Documentation map

- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Operations and deployment](docs/OPERATIONS.md)
- [External API integration](app/docs/API_INTEGRATION.md)
- [Database schema assets](database-schema/README.md)

## Repository layout

```text
.
├── app/
│   ├── app/                 # Next.js routes and route handlers
│   ├── components/          # Layout, workflow step, and editor components
│   ├── docs/                # API documentation
│   ├── lib/                 # Supabase, tenant, workflow, and type helpers
│   ├── public/              # Static assets
│   ├── scripts/             # Deploy, SBOM, and license-check scripts
│   ├── manifest.yml         # cloud.gov manifest
│   └── license-policy.json  # Allowed production dependency licenses
├── database-schema/         # Legacy PIC v1.2.0 SQL and reference exports
├── docs/                    # Product, architecture, and operations guides
├── scripts/                 # One-time data migration utilities
├── .github/                 # CI, CodeQL, and Dependabot
└── .env.example             # Configuration reference
```

## Current constraints

- Workflow configuration assumes process model ID `1`, decision element IDs `1`–`5`, and role IDs Applicant `1`, Analyst `2`, Approver `3`.
- New email/password users, and Login.gov users without a verified .gov or .mil email, still need an active tenant membership and appropriate role assignment before they can use protected application pages or receive work.
- Analyst and approver assignment selects the first eligible tenant-scoped assignment when the project does not already store an assignee.
- HedgeDoc content is edited in HedgeDoc. The database stores note linkage metadata; the internal editor stores Markdown directly in `document.other.markdown_content`. The Step 5 preview currently reads database Markdown and does not fetch the live HedgeDoc note.
- The dashboard's role-badge lookup is user-scoped but not tenant-filtered; task and case queries remain tenant-scoped. Use RLS and avoid reusing conflicting numeric role IDs across tenants.
- The in-app Developer Resources page predates tenant support and its examples omit `tenant_id`. The Markdown API guide is the canonical integration reference.
