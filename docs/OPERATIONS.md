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
```

The package defines `npm test`, but no test files are currently checked in; Vitest exits without running a suite. Run it when tests are added.

Then exercise one complete case using separate Applicant, Analyst, and Approver users:

1. Create a case and submit Step 2.
2. Submit an applicant document.
3. Submit an analyst document.
4. Request changes once and verify the revision task and notification.
5. Resubmit and approve.
6. Confirm the process and project are completed and all records carry the expected `tenant_id`.

## Google Cloud Run

### Cloud Build pipeline

`cloudbuild.yaml`:

- obtains `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Secret Manager;
- builds `app/Dockerfile`;
- tags and pushes commit-specific and `latest` images;
- deploys an unauthenticated Cloud Run service on port `8080`; and
- supplies runtime Supabase, tenant, and application URL variables.

Configure these trigger substitutions:

- `_NEXT_PUBLIC_SUPABASE_URL`
- `_NEXT_PUBLIC_TENANT_SLUG`
- `_CANONICAL_TENANT_SLUG`
- `_NEXT_PUBLIC_APP_BASE_URL`
- optionally override `_SERVICE_NAME` and `_REGION`

Create the Secret Manager secret `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Although this key is public by design, keeping deployment configuration centralized avoids accidental substitution mistakes.

### Deployment script

`app/deploy.sh` is an alternate interactive path:

```bash
cd app
export NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
export NEXT_PUBLIC_TENANT_SLUG=reviewworks
export CANONICAL_TENANT_SLUG=reviewworks
export NEXT_PUBLIC_APP_BASE_URL=https://review-works.example.gov
./deploy.sh
```

It defaults to service `review-works` in `us-central1`. Set `PROJECT_ID`, `SERVICE_NAME`, or `REGION` to override those values. Optional service-role and HedgeDoc values are forwarded when present.

After the first deployment, use the actual Cloud Run URL as `NEXT_PUBLIC_APP_BASE_URL`, update Supabase's redirect allowlist, and redeploy if the provisional URL differed.

## Cloud Foundry

`manifest.yml` deploys the prebuilt image `direwolfvm/complex-review:latest` as `reviewworks` with 512 MB of memory and an HTTP health check at `/`.

Supply environment variables through the platform rather than committing them to the manifest. Confirm that the referenced image matches the source revision being released.

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
- The container image tag can be traced to the released commit.

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
