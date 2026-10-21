# Review Works operations and deployment

## Environment preparation

Copy the repository's `.env.example` to `app/.env.local` for local development. Keep the server-only values out of source control.

Minimum local configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
NEXT_PUBLIC_TENANT_SLUG=reviewworks
CANONICAL_TENANT_SLUG=reviewworks
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

The configured tenant must exist, be active, and contain Review Works seed data. Browser and server tenant slugs should match.

## Supabase preparation

The current runtime expects a canonical tenant-aware database. Before starting the app:

1. Provision the canonical schema, including `tenant`, `user_tenant_membership`, and `tenant_id` columns.
2. Create an active tenant using the configured slug.
3. Seed process model `1`, decision elements `1`–`5`, and role IDs `1`–`3` for that tenant.
4. Configure RLS for tenant isolation and authenticated mutations.
5. Configure Supabase Auth email templates and confirmation behavior.
6. Add `http://localhost:3000/auth/callback` and the production equivalent to allowed redirect URLs.
7. Create active memberships and tenant-scoped role assignments for test users.

Self-sign-up creates an Auth user only. Membership and role provisioning are administrative operations outside the current UI.

## Local verification

From `app/`:

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test
```

CI runs the same steps on every pull request (see the README's Continuous integration section).

Then exercise one complete case using separate Applicant, Analyst, and Approver users:

1. Create a case and submit Step 2.
2. Submit an applicant document.
3. Submit an analyst document.
4. Request changes once and verify the revision task and notification.
5. Resubmit and approve.
6. Confirm the process and project are completed and all records carry the expected `tenant_id`.

## cloud.gov

Review Works runs on cloud.gov as `reviewworks`, staged by the Node.js buildpack (Node 22 from `engines` in `app/package.json`) and started with `npm start`. The platform health check calls `/api/health`, which answers without contacting Supabase.

### Hosted environment file

Create `app/.env.cloudgov` (ignored by git and by `.cfignore`) with the hosted values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
- `SUPABASE_SECRET_KEY` (server-only `sb_secret_...` key; every write goes through the API routes with it)
- optionally `NEXT_PUBLIC_TENANT_SLUG`, `CANONICAL_TENANT_SLUG` (both default to `reviewworks`), `DEPLOY_APP_BASE_URL`, `HEDGEDOC_BASE_URL`, `HEDGEDOC_API_TOKEN`

Set `DEPLOY_ENV_FILE` to use a different file.

### Deploying

From `app/`, after `cf login` and `cf target -o <org> -s <space>`:

```bash
npm run deploy:cloud            # dry run
npm run deploy:cloud -- --apply # deploy
```

With `--apply`, `scripts/deploy-cloud.mjs`:

1. builds with the hosted environment, because statically rendered pages embed the public Supabase settings at build time;
2. runs `cf push reviewworks -f manifest.yml --no-start`;
3. sets the runtime environment through `cf curl /v3/apps/<guid>/environment_variables` without printing values; and
4. starts the app.

After the first deployment, confirm `NEXT_PUBLIC_APP_BASE_URL` matches the route, update Supabase's redirect allowlist, and redeploy if it differed.

## HedgeDoc

HedgeDoc is optional. Without it, Review Works uses its built-in Markdown editor.

To enable it:

1. Set `HEDGEDOC_BASE_URL` without a trailing slash.
2. Set `HEDGEDOC_API_TOKEN` if note creation requires a bearer token.
3. Allow the Review Works origin in HedgeDoc's embedding/frame policy.
4. Allow the HedgeDoc origin in Review Works' `frame-src` Content Security Policy.
5. Test note creation, `/new` fallback behavior, iframe loading, and access from every workflow role.

The current Content Security Policy has a fixed HedgeDoc origin allowlist. Merely changing the environment variable does not add a new origin to that policy.

The approval page currently previews `document.other.markdown_content` rather than downloading the live HedgeDoc note. Validate this behavior against the organization's approval requirements before enabling HedgeDoc in production.

## OAuth consent endpoint

`/oauth/consent` supports Supabase OAuth authorization details, allow/deny actions, CSRF protection, and PKCE parameters passed through the authorization request. Unauthenticated users are returned to the consent URL after sign-in.

For production:

- configure the Review Works consent URL in Supabase;
- use HTTPS;
- register exact client redirect URIs;
- verify requested scopes shown to the user; and
- test allow, deny, expired authorization ID, and sign-in return paths.

## Legacy-to-canonical data migration

`scripts/migrate-reviewworks-to-canonical.mjs` is a one-time, environment-specific utility used for the existing Review Works migration. It:

- reads a legacy source and canonical target from fixed local environment-file paths;
- requires the target tenant to exist;
- aborts if that tenant already contains a project;
- preserves IDs for seed/configuration tables;
- adds the target `tenant_id`;
- moves legacy `decision_element.responsible_role` into `decision_element.other`;
- recreates runtime rows while remapping foreign keys; and
- intentionally clears unsupported engagement references.

Treat it as an audited migration artifact, not a general setup command. Review its hard-coded paths and source/target key usage before any run. Back up both databases, run against a disposable target first, and validate row counts and relationships. It is only partially idempotent: the project preflight prevents duplicate case migration, but seed and assignment upserts occur before runtime rows are copied.

## Release checklist

- Production build succeeds.
- Documentation links resolve.
- No secrets or populated environment files are staged.
- Browser and server tenant slugs match an active tenant.
- Membership and role assignments exist for each test persona.
- RLS has been tested with users from different tenants.
- Supabase allowed origins and callback URLs are current.
- HedgeDoc frame and note creation work, if enabled.
- A full workflow including a revision loop succeeds.
- CI is green on the released commit, and its SBOM artifact is retained.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Redirect loop at sign-in | Supabase URL/key, callback allowlist, cookies, and public base URL |
| `Tenant not found` | Slug values and an active `tenant` row |
| `No active tenant membership` | Auth provider `supabase`, auth user ID, tenant ID, and `is_active` |
| Empty dashboard | Tenant-scoped `user_assignments` and case participant metadata |
| Unexpected role badge | The dashboard role lookup is not tenant-filtered; inspect all assignments for the user |
| Workflow advances without an assignee | Eligible role assignments; applicant/analyst exclusion rules |
| Step form missing | Decision element `2`, tenant ID, and valid `form_data` JSON Schema |
| HedgeDoc blocked | Both frame policies, base URL, authentication, and CSP origin |
| Browser connection warning | Runtime-injected Supabase values; clear cache and sign in again |
