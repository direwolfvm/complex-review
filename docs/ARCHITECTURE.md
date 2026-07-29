# Review Works architecture

## System context

Review Works is a server-rendered Next.js application backed by Supabase. Browser components use the authenticated Supabase client for workflow mutations. Server components use the user's cookie-backed Supabase session for page queries and tenant membership checks. Optional HedgeDoc integration stores the editable document externally while Review Works stores linkage metadata.

```text
Browser
  ├─ Next.js server components and route handlers
  ├─ Supabase Auth session
  ├─ Supabase PostgREST reads and mutations
  └─ Optional embedded HedgeDoc

Supabase
  ├─ Auth users and sessions
  ├─ tenant + user_tenant_membership
  ├─ workflow configuration
  └─ tenant-scoped case, task, document, and payload records
```

## Tenant resolution and authorization

Each deployment selects one tenant slug.

- Browser code resolves `NEXT_PUBLIC_TENANT_SLUG`, defaulting to `reviewworks`, then looks up `tenant.id`.
- Server code resolves `CANONICAL_TENANT_SLUG`, then `NEXT_PUBLIC_TENANT_SLUG`, then `reviewworks`.
- Protected layouts fetch the authenticated user and require an active `user_tenant_membership` for that tenant.
- Case-data queries and mutations include `tenant_id`.
- Dashboard tasks are included when directly assigned to the user or assigned to one of the user's role IDs. The role-ID lookup itself currently filters by user but not by tenant.
- Case lists include only projects where the user is stored as applicant, analyst, or approver.

The application checks membership and filters data, but database Row Level Security remains the authoritative isolation boundary. The anon key is intentionally public and must never bypass tenant-aware RLS. Until the dashboard role lookup is tenant-filtered, deployments should avoid conflicting role-ID semantics across tenants.

## Route map

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product landing page |
| `/about` | Public | Mission, features, workflow, and data-model overview |
| `/developers` | Public | Legacy API examples rendered in the app; Markdown docs are canonical |
| `/login` | Public | Email/password sign-up and sign-in |
| `/auth/callback` | Public handler | Exchanges Supabase confirmation or OAuth code for a session |
| `/oauth/consent` | Authenticated handler | Renders and processes Supabase OAuth authorization consent |
| `/dashboard` | Authenticated member | Active tasks, recent cases, notifications, and roles |
| `/cases` | Authenticated member | User-participating cases in the configured tenant |
| `/case/new` | Authenticated member | Creates a project, process, task, and Step 1 payload |
| `/case/[id]` | Authenticated member | Case summary, documents, and timeline |
| `/step/[step]/[processId]` | Authenticated member | Loads the configured step, current task, and documents |
| `/api/hedgedoc/create` | Application route | Creates a HedgeDoc note when configured |

The middleware protects `/dashboard`, `/case...`, and `/step...`. The route layouts also check authentication and membership. `/cases` is protected by its server layout even though the middleware prefix list does not explicitly include the plural path.

## Workflow configuration

The current implementation assumes:

- process model ID `1`;
- decision element IDs matching step numbers `1`–`5`;
- Applicant role ID `1`;
- Analyst role ID `2`; and
- Approver role ID `3`.

The Step 2 JSON Schema is read from decision element `form_data`. Responsible role can be stored directly as `decision_element.responsible_role` or in `decision_element.other.responsible_role`; canonical migration moves the legacy direct value into `other`.

## Data model

| Table | Application responsibility |
| --- | --- |
| `tenant` | Active tenant selected by slug |
| `user_tenant_membership` | Grants an authenticated Supabase user access to the tenant |
| `user_role` | Defines workflow roles |
| `user_assignments` | Maps a user to tenant-scoped role IDs |
| `process_model` | Defines the Review Works workflow template |
| `decision_element` | Defines each step, its description, form schema, and responsible role |
| `project` | Case subject and participant assignment metadata |
| `process_instance` | Current step, workflow status, stage, and outcome |
| `case_event` | Tasks, notifications, and their completion/revision metadata |
| `document` | Applicant draft and analyst analysis records |
| `process_decision_payload` | Immutable-style records of step submissions and approval decisions |

### JSON metadata

`project.other`:

```json
{
  "applicant_user_id": "uuid",
  "analyst_user_id": "uuid",
  "approver_user_id": "uuid",
  "form_data": {}
}
```

`process_instance.other`:

```json
{
  "current_step": 2,
  "workflow_status": "draft"
}
```

`case_event.other` for a task:

```json
{
  "step_number": 4,
  "decision_element_id": 4,
  "assigned_user_id": "uuid",
  "assigned_role_id": 2,
  "task_type": "document",
  "completed_by": "uuid",
  "completed_at": "ISO-8601 timestamp",
  "revision_requested": true,
  "revision_comments": "Requested changes"
}
```

`document.other`:

```json
{
  "document_role": "draft",
  "created_by_user_id": "uuid",
  "last_edited_by_user_id": "uuid",
  "markdown_content": "# Document",
  "hedgedoc_note_id": "optional-note-id",
  "hedgedoc_url": "https://hedgedoc.example/optional-note-id"
}
```

## State transitions

| Action | Process step | Workflow status | New work |
| --- | ---: | --- | --- |
| Create case | 2 | `draft` | Applicant form task |
| Submit project information | 3 | `in_progress` | Applicant document task |
| Submit applicant document | 4 | `in_progress` | Analyst task and notification |
| Submit analysis | 5 | `pending_approval` | Approver task and notification |
| Request changes | 4 | `in_progress` | Analyst revision task and notification |
| Approve | 6 | `approved` | Analyst approval notification; process completed |

Decision payloads preserve each submission, including repeated Step 4 and Step 5 decisions during revision loops.

## Document modes

### Internal Markdown

`MarkdownEditor` maintains local Markdown state, offers edit/preview modes, and writes content to `document.other.markdown_content`. Step completion changes `document.status` from `draft` to `submitted`.

### HedgeDoc

Setting `HEDGEDOC_BASE_URL` enables the embedded mode. The server route posts Markdown to HedgeDoc `/new`, optionally with a bearer token, validates the returned note URL, and stores the note ID and URL in document metadata. If pre-creation fails in anonymous mode, the UI falls back to an embedded `/new` editor.

The configured HedgeDoc origin must be allowed by both applications' frame policies. The current Next.js Content Security Policy contains explicit allowed origins rather than deriving them dynamically from `HEDGEDOC_BASE_URL`. The Step 5 approval preview reads `document.other.markdown_content`; it does not fetch the live HedgeDoc note.

## Source layout

```text
app/app/                 Next.js pages, layouts, and route handlers
app/components/layout/   Public and authenticated navigation
app/components/steps/    Step 2 through Step 5 clients
app/components/editor/   Internal Markdown editor
app/lib/supabase/        Browser, server, and middleware clients
app/lib/tenant/          Tenant slug and membership resolution
app/lib/workflow/        Reusable workflow engine functions
app/lib/types/           Database and workflow metadata types
```

Some step pages currently implement their mutations directly while `app/lib/workflow/engine.ts` also provides reusable workflow functions. Documentation should be checked against the rendered step components because they are the active user path.
