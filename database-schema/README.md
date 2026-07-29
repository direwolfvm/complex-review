# Database schema assets

This directory contains legacy Permit Intelligence Center (PIC) v1.2.0 SQL and data exports. They document the schema lineage and can recreate the earlier, non-tenant-aware PIC database used by Review Works before its canonical Supabase migration.

They are **not a complete schema installer for the current application**. The current runtime also requires canonical tenant tables, active memberships, tenant-scoped role assignments, `tenant_id` columns and policies, and tenant-scoped Review Works seed data.

## Contents

| File | Purpose |
| --- | --- |
| `prod.sql` | Initial PIC schema and grants |
| `schema-v1.0.0-to-1.2.0.sql` | PIC v1.0.0 to v1.2.0 migration |
| `decision_element full export.csv` | Review Works decision-element seed export |
| `legal_structure full export.csv` | Legal-structure seed export |
| `process_model full export.csv` | Process-model seed export |
| `database_crosswalk.csv` | Schema/data mapping reference |
| `payloads_actual.json` | Historical payload samples |
| `correct_payloads.json` | Corrected historical payload samples |

The SQL is derived from [GSA-TTS/pic-standards](https://github.com/GSA-TTS/pic-standards/tree/main/src/database), tag [v1.2.0](https://github.com/GSA-TTS/pic-standards/releases/tag/v1.2.0).

## Legacy schema recreation

Use this only when reproducing the historical database or preparing a source for migration:

1. Create a disposable Supabase project or compatible PostgreSQL database.
2. Apply `prod.sql`.
3. Apply `schema-v1.0.0-to-1.2.0.sql`.
4. Import the three `full export.csv` files into their matching tables.
5. If historical document storage is required, create a `permit-documents` bucket with policies appropriate to the environment.
6. Configure authentication and RLS before exposing the database.

The bundled SQL grants broad table access and historically expected RLS to be configured separately. Do not expose this legacy setup to untrusted users without reviewing all grants and policies.

## Current canonical runtime requirements

Review Works now expects, at minimum:

- `tenant` with an active row whose slug matches app configuration;
- `user_tenant_membership` linking Supabase Auth users to that tenant;
- `tenant_id` on workflow configuration and runtime tables;
- tenant-scoped `user_assignments`;
- process model ID `1`;
- decision elements `1` through `5`;
- role IDs Applicant `1`, Analyst `2`, and Approver `3`; and
- RLS policies that enforce membership and tenant isolation.

The app uses these main tables:

```text
tenant
user_tenant_membership
user_role
user_assignments
legal_structure
process_model
decision_element
project
process_instance
document
case_event
process_decision_payload
```

The current canonical schema definition is maintained outside this directory. Provision it from the canonical database project before running Review Works; do not apply these files on top of a canonical production database unless a reviewed migration explicitly calls for it.

## Data migration artifact

The repository-level `scripts/migrate-reviewworks-to-canonical.mjs` records the one-time migration from the legacy Review Works database to a pre-provisioned canonical tenant. It is environment-specific and uses hard-coded local environment-file paths.

The script aborts when the target tenant already has a project, preserves configuration IDs, adds the tenant ID, recreates runtime rows, and remaps their foreign keys. See [Operations and deployment](../docs/OPERATIONS.md#legacy-to-canonical-data-migration) before considering a run.

## Security notes

- The anonymous/publishable Supabase key is not a secret; RLS is the security boundary.
- The service-role key is a secret and must never be committed or exposed to the browser.
- Every current application record should carry the correct `tenant_id`.
- Test policies using accounts from at least two tenants.
- A public read/write storage bucket is not recommended for production unless the data is intentionally public.
