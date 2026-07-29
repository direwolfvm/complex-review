# External API integration

This guide describes how an external system can create and advance Review Works cases through Supabase Auth and PostgREST while remaining compatible with the current tenant-aware application.

## Important compatibility rules

An integration must:

1. authenticate as a Supabase user or use a tightly controlled server-side service role;
2. resolve the configured tenant by slug;
3. include that tenant's `tenant_id` on every workflow record;
4. use records belonging to the same tenant;
5. preserve the JSON metadata shapes used by the UI;
6. create tasks, notifications, documents, and decision payloads when advancing state; and
7. obey RLS and participant-separation rules.

The current app assumes process model ID `1`, decision element IDs `1`–`5`, and role IDs Applicant `1`, Analyst `2`, and Approver `3`. Confirm that these IDs exist for the target tenant before integrating.

Direct REST writes are not transactional across the multi-record transitions shown below. For production integrations, prefer a reviewed database function, Edge Function, or backend service that validates inputs and performs each transition atomically.

## Base URLs and headers

```text
Auth: https://<project-ref>.supabase.co/auth/v1
REST: https://<project-ref>.supabase.co/rest/v1
```

Authenticated-user requests:

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <USER_ACCESS_TOKEN>
Content-Type: application/json
Prefer: return=representation
```

Server-to-server requests may use the service-role key as the bearer token only from a trusted backend. Never expose it to a browser, mobile bundle, log, or source repository. Service-role access bypasses RLS, so the integration must enforce tenant and user authorization itself.

Examples below use shell placeholders:

```bash
SUPABASE_URL="https://example.supabase.co"
SUPABASE_ANON_KEY="your-publishable-key"
TENANT_SLUG="reviewworks"
ACCESS_TOKEN="authenticated-user-jwt"
USER_ID="authenticated-user-uuid"
```

## Authentication

Sign in with email and password:

```bash
curl --request POST \
  "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{
    "email": "applicant@example.com",
    "password": "correct-horse-battery-staple"
  }'
```

Store the returned `access_token`, `refresh_token`, and `user.id`. A valid Auth user must also have an active `user_tenant_membership` for the selected tenant.

## Resolve and validate tenant context

Resolve the active tenant:

```bash
curl --get "${SUPABASE_URL}/rest/v1/tenant" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode "select=id,slug,name,is_active" \
  --data-urlencode "slug=eq.${TENANT_SLUG}" \
  --data-urlencode "is_active=eq.true"
```

Save the returned UUID as `TENANT_ID`.

Validate the authenticated user's membership:

```bash
curl --get "${SUPABASE_URL}/rest/v1/user_tenant_membership" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode "select=tenant_id,role,is_active" \
  --data-urlencode "tenant_id=eq.${TENANT_ID}" \
  --data-urlencode "auth_provider=eq.supabase" \
  --data-urlencode "auth_user_id=eq.${USER_ID}" \
  --data-urlencode "is_active=eq.true"
```

Validate required configuration:

```bash
curl --get "${SUPABASE_URL}/rest/v1/decision_element" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode "select=id,title,form_data,other" \
  --data-urlencode "tenant_id=eq.${TENANT_ID}" \
  --data-urlencode "id=in.(1,2,3,4,5)" \
  --data-urlencode "order=id.asc"
```

## Create a case

Case creation produces four related records.

### 1. Project

```bash
curl --request POST "${SUPABASE_URL}/rest/v1/project" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --header "Prefer: return=representation" \
  --data "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"title\": \"New Project\",
    \"current_status\": \"draft\",
    \"other\": {
      \"applicant_user_id\": \"${USER_ID}\"
    }
  }"
```

Save the returned numeric ID as `PROJECT_ID`.

The underlying project table supports fields including:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | text | Project name |
| `description` | text | Project summary |
| `sector` | text | Sector/category |
| `lead_agency` | text | Lead organization |
| `participating_agencies` | text | Participating organizations |
| `type` | text | Project type |
| `location_lat`, `location_lon` | number | Coordinates |
| `location_text` | text | Human-readable location |
| `funding` | text | Funding information |
| `start_date` | date | Planned start date |
| `sponsor` | text | Sponsor |
| `sponsor_contact` | JSON | Contact details |
| `current_status` | text | Starts as `draft`; approval sets `approved` |

The current Step 2 component maps `title`, `description`, `sector`, `lead_agency`, and `location_text` to project columns. It stores the complete submission, including other form values, in `other.form_data`. An external integration may populate other project columns when permitted by its schema and policies.

### 2. Process instance

```bash
curl --request POST "${SUPABASE_URL}/rest/v1/process_instance" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --header "Prefer: return=representation" \
  --data "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"parent_project_id\": ${PROJECT_ID},
    \"process_model\": 1,
    \"status\": \"underway\",
    \"stage\": \"Step 2: Project Information\",
    \"start_date\": \"2026-07-29\",
    \"other\": {
      \"current_step\": 2,
      \"workflow_status\": \"draft\"
    }
  }"
```

Save the returned numeric ID as `PROCESS_ID`.

### 3. Step 2 task

```bash
curl --request POST "${SUPABASE_URL}/rest/v1/case_event" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --header "Prefer: return=representation" \
  --data "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"parent_process_id\": ${PROCESS_ID},
    \"name\": \"Complete Project Information\",
    \"description\": \"Fill out the project information form to proceed\",
    \"type\": \"task\",
    \"tier\": 2,
    \"status\": \"pending\",
    \"assigned_entity\": \"${USER_ID}\",
    \"other\": {
      \"step_number\": 2,
      \"decision_element_id\": 2,
      \"assigned_user_id\": \"${USER_ID}\",
      \"assigned_role_id\": 1,
      \"task_type\": \"form\"
    }
  }"
```

Save the returned ID as `TASK_ID`.

### 4. Step 1 authentication payload

```bash
curl --request POST "${SUPABASE_URL}/rest/v1/process_decision_payload" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"process_decision_element\": 1,
    \"process\": ${PROCESS_ID},
    \"project\": ${PROJECT_ID},
    \"result\": \"completed\",
    \"result_bool\": true,
    \"evaluation_data\": {
      \"user_id\": \"${USER_ID}\",
      \"authenticated_at\": \"2026-07-29T16:00:00Z\"
    }
  }"
```

At this point the case is compatible with the app and opens at `/step/2/<PROCESS_ID>`.

## Complete Step 2

Use decision element `2`'s `form_data` as the JSON Schema contract.

The transition must:

1. update project columns and merge the complete submission into `project.other.form_data`;
2. create a Step 2 decision payload;
3. complete the Step 2 task;
4. update the process to Step 3;
5. create a draft applicant document; and
6. create the Step 3 task.

Decision payload:

```json
{
  "tenant_id": "<TENANT_ID>",
  "process_decision_element": 2,
  "process": 456,
  "project": 123,
  "result": "completed",
  "result_bool": true,
  "evaluation_data": {
    "title": "Highway 101 Environmental Review",
    "sector": "transportation"
  }
}
```

Completed task patch:

```json
{
  "status": "completed",
  "outcome": "completed",
  "other": {
    "step_number": 2,
    "decision_element_id": 2,
    "assigned_user_id": "<USER_ID>",
    "assigned_role_id": 1,
    "task_type": "form",
    "completed_by": "<USER_ID>",
    "completed_at": "2026-07-29T16:10:00Z"
  }
}
```

Process patch:

```json
{
  "stage": "Step 3: Applicant Document",
  "other": {
    "current_step": 3,
    "workflow_status": "in_progress"
  }
}
```

Applicant document:

```json
{
  "tenant_id": "<TENANT_ID>",
  "parent_process_id": 456,
  "title": "Applicant Draft Document",
  "type": "applicant_draft",
  "status": "draft",
  "other": {
    "document_role": "draft",
    "created_by_user_id": "<USER_ID>",
    "markdown_content": ""
  }
}
```

Step 3 task metadata uses `step_number: 3`, `decision_element_id: 3`, `assigned_role_id: 1`, and `task_type: "document"`.

## Complete Step 3 and assign an analyst

Select an eligible analyst from `user_assignments` where:

- `tenant_id` is the current tenant;
- `user_role` is `2`; and
- `user_id` is not the applicant.

Store the selected UUID in `project.other.analyst_user_id`.

Then:

- set the applicant document status to `submitted`;
- create the Step 3 decision payload with its `document_id`;
- complete the Step 3 task;
- update the process to Step 4 and `in_progress`;
- create an analysis document with `document_role: "analysis"`;
- create a Step 4 task assigned to the analyst; and
- create a pending notification assigned to the analyst.

Example notification:

```json
{
  "tenant_id": "<TENANT_ID>",
  "parent_process_id": 456,
  "name": "New Case Assigned",
  "description": "You have been assigned to review \"Highway 101 Environmental Review\"",
  "type": "notification",
  "status": "pending",
  "assigned_entity": "<ANALYST_USER_ID>",
  "other": {
    "notification_type": "assignment",
    "project_id": 123,
    "read": false
  }
}
```

## Complete Step 4 and assign an approver

Select an eligible approver from tenant role `3`, excluding both the applicant and analyst. Store the selected UUID in `project.other.approver_user_id`.

Then:

- set the analysis document status to `submitted`;
- create a Step 4 decision payload with `document_id`, `submitted_at`, and `is_revision`;
- complete the Step 4 task;
- update the process to Step 5 and `pending_approval`;
- create a Step 5 approval task; and
- notify the approver.

Step 5 task metadata:

```json
{
  "step_number": 5,
  "decision_element_id": 5,
  "assigned_user_id": "<APPROVER_USER_ID>",
  "assigned_role_id": 3,
  "task_type": "approval"
}
```

## Approve

Approval creates a Step 5 decision payload:

```json
{
  "tenant_id": "<TENANT_ID>",
  "process_decision_element": 5,
  "process": 456,
  "project": 123,
  "result": "approved",
  "result_bool": true,
  "result_notes": "Optional comments",
  "evaluation_data": {
    "approver_id": "<APPROVER_USER_ID>",
    "approved_at": "2026-07-29T18:00:00Z"
  }
}
```

Complete the approval task with outcome `approved`, then patch:

```json
{
  "process_instance": {
    "status": "completed",
    "stage": "Approved",
    "outcome": "approved",
    "complete_date": "2026-07-29",
    "other": {
      "current_step": 6,
      "workflow_status": "approved"
    }
  },
  "project": {
    "current_status": "approved"
  }
}
```

Finally, create a `Case Approved` notification for the analyst.

## Request changes

Comments are required for a change request.

1. Complete the Step 5 task with outcome `changes_requested` and store `approval_comments`.
2. Create a Step 5 decision payload with `result: "changes_requested"` and `result_bool: false`.
3. Patch the process to Step 4, `in_progress`, and stage `Step 4: Analyst Review (Revision)`.
4. Create a new Step 4 task assigned to the existing analyst.
5. Notify the analyst.

Revision task metadata:

```json
{
  "step_number": 4,
  "decision_element_id": 4,
  "assigned_user_id": "<ANALYST_USER_ID>",
  "assigned_role_id": 2,
  "task_type": "document",
  "revision_requested": true,
  "revision_comments": "Explain the affected-resource conclusion.",
  "revision_requested_by": "<APPROVER_USER_ID>"
}
```

Do not create a second analysis document for the normal revision loop; the app reuses the existing analysis document.

## Metadata reference

### Process state

```json
{
  "current_step": 2,
  "workflow_status": "draft"
}
```

Valid app states are `draft`, `in_progress`, `pending_approval`, `approved`, and the reserved `rejected` type value. The active UI uses change requests rather than a terminal rejected action.

### Task state

```json
{
  "step_number": 2,
  "decision_element_id": 2,
  "assigned_user_id": "uuid",
  "assigned_role_id": 1,
  "task_type": "form",
  "completed_by": "uuid",
  "completed_at": "ISO-8601 timestamp"
}
```

Task types are `form`, `document`, and `approval`. Task statuses are `pending`, `in progress`, and `completed`.

### Document state

```json
{
  "document_role": "draft",
  "created_by_user_id": "uuid",
  "last_edited_by_user_id": "uuid",
  "markdown_content": "# Content",
  "hedgedoc_note_id": "optional",
  "hedgedoc_url": "optional"
}
```

Document roles are `draft` and `analysis`; statuses are `draft` and `submitted`.

## Querying cases

Fetch a process with its project:

```bash
curl --get "${SUPABASE_URL}/rest/v1/process_instance" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode "select=*,project:parent_project_id(*)" \
  --data-urlencode "tenant_id=eq.${TENANT_ID}" \
  --data-urlencode "id=eq.${PROCESS_ID}"
```

Fetch pending work directly assigned to a user:

```bash
curl --get "${SUPABASE_URL}/rest/v1/case_event" \
  --header "apikey: ${SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode "select=*" \
  --data-urlencode "tenant_id=eq.${TENANT_ID}" \
  --data-urlencode "type=eq.task" \
  --data-urlencode "assigned_entity=eq.${USER_ID}" \
  --data-urlencode "status=in.(pending,in progress)"
```

Always combine a record ID filter with `tenant_id`, including PATCH and DELETE requests:

```text
/rest/v1/case_event?id=eq.<TASK_ID>&tenant_id=eq.<TENANT_ID>
```

## Idempotency and consistency

PostgREST inserts do not automatically prevent duplicate step submissions. Integrations should:

- assign an external idempotency key in metadata or a dedicated constrained column;
- check for an existing payload/task before retrying;
- use optimistic concurrency or a database function for transitions;
- never overwrite participant or document metadata without merging existing keys;
- validate that referenced records share the same `tenant_id`; and
- record the acting user and timestamp.

After each transition, verify:

- exactly one active task exists for the current step;
- `process_instance.other.current_step` matches `stage`;
- the expected document exists;
- assigned users have the correct tenant-scoped role;
- completed tasks have completion metadata; and
- a decision payload records the action.

## Errors and security

| HTTP status | Typical cause |
| --- | --- |
| `400` | Invalid JSON, column, filter, or transition data |
| `401` | Missing, invalid, or expired access token |
| `403` | RLS denied the operation or membership is insufficient |
| `404` / empty array | Record is absent or hidden by RLS/tenant filtering |
| `409` | Constraint or idempotency conflict |
| `422` | Auth request could not be processed |

Security requirements:

- enforce RLS on all exposed tables;
- derive tenant access from active membership, not a client-provided tenant ID alone;
- never use a service-role key in client code;
- validate role separation during assignment;
- allow only expected JSON metadata fields and sizes;
- protect document content as potentially sensitive case data; and
- retain audit records for every state transition.

## App-managed alternative

If users can complete the workflow in the Review Works UI, an integration only needs to create the four initial case records. The UI will manage subsequent documents, tasks, notifications, payloads, and state changes. This reduces the integration surface and is preferable to reproducing every transition externally.
