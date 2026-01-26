# External System API Integration Guide

This document describes how an external system can create environmental review applications through the Supabase API, matching the 5-step workflow implemented in the Review Works web application.

## Overview

The Complex Review workflow consists of 5 steps with role-based access control:

| Step | Title | Required Role | Description |
|------|-------|---------------|-------------|
| 1 | User ID | Applicant | Authentication (handled automatically) |
| 2 | Project Information | Applicant | Project details form |
| 3 | Applicant Document | Applicant | Draft analysis document |
| 4 | Environmental Review | Analyst | Analyst review and analysis |
| 5 | Approval | Approver | Final approval gate |

To create an environmental review application programmatically, you need to:

1. Authenticate with Supabase to get a user ID and access token
2. Create a `project` record with applicant metadata
3. Create a `process_instance` record linked to the project
4. Create `process_decision_payload` records for completed steps
5. Create `case_event` records for tasks and workflow tracking
6. Create `document` records for document steps (3 and 4)

## Prerequisites

- **Supabase URL**: Your project URL (e.g., `https://your-project.supabase.co`)
- **Supabase Anon Key**: The publishable anon key for API access
- **User Credentials**: Email and password for the applicant account
- **User Role Assignment**: The user must have the Applicant role (1) assigned in `user_assignments`

## API Base URL

All REST API endpoints follow this pattern:
```
{SUPABASE_URL}/rest/v1/{table_name}
```

## Authentication Headers

All API requests require these headers:
```http
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
Prefer: return=representation
```

---

## Step 1: Authenticate with Supabase

Sign in to get the user ID and access token.

### Request

```bash
curl -X POST "{SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "applicant@example.com",
    "password": "your-password"
  }'
```

### Response

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "abc123...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "applicant@example.com",
    "role": "authenticated",
    ...
  }
}
```

**Important**: Save the `access_token` and `user.id` for subsequent requests.

---

## Step 2: Create Project

Create the project record with applicant metadata in the `other` JSONB field.

### Request

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/project" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "Highway 101 Environmental Review",
    "description": "Environmental impact assessment for highway expansion",
    "sector": "transportation",
    "lead_agency": "Department of Transportation",
    "type": "highway_expansion",
    "location_lat": 37.7749,
    "location_lon": -122.4194,
    "location_text": "Highway 101, San Francisco, CA",
    "current_status": "draft",
    "other": {
      "applicant_user_id": "{USER_ID}"
    }
  }'
```

### Project Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | text | Yes | Descriptive name of the project |
| `description` | text | No | Summary of the project's goals and scope |
| `sector` | text | No | High-level category (energy, transportation, etc.) |
| `lead_agency` | text | No | Agency supervising the project |
| `type` | text | No | Classification sub-type |
| `location_lat` | float | No | Latitude of project center |
| `location_lon` | float | No | Longitude of project center |
| `location_text` | text | No | Text description of location |
| `current_status` | text | Yes | Must be `"draft"` for new applications |
| `other` | jsonb | Yes | Workflow metadata (see below) |

### Project `other` Field Schema (ProjectWorkflowMeta)

```json
{
  "applicant_user_id": "string (required) - UUID of the case creator",
  "analyst_user_id": "string (optional) - assigned when step 4 starts",
  "approver_user_id": "string (optional) - assigned when step 5 starts"
}
```

### Response

```json
{
  "id": 123,
  "created_at": "2026-01-15T10:30:00.000Z",
  "title": "Highway 101 Environmental Review",
  "current_status": "draft",
  "other": {
    "applicant_user_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  ...
}
```

**Save the `id` as `PROJECT_ID` for the next steps.**

---

## Step 3: Create Process Instance

Create the process instance linked to the project with workflow state metadata.

### Request

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/process_instance" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_project_id": {PROJECT_ID},
    "process_model": 1,
    "status": "underway",
    "stage": "Step 2: Project Information",
    "start_date": "2026-01-15",
    "other": {
      "current_step": 2,
      "workflow_status": "draft"
    }
  }'
```

### Process Instance Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_project_id` | bigint | Yes | Reference to the project ID |
| `process_model` | bigint | Yes | Process model ID (use `1`) |
| `status` | text | Yes | `"underway"` for active processes |
| `stage` | text | No | Human-readable stage description |
| `start_date` | date | No | Application start date |
| `other` | jsonb | Yes | Workflow state metadata |

### Process Instance `other` Field Schema (ProcessInstanceWorkflowMeta)

```json
{
  "current_step": 2,
  "workflow_status": "draft | in_progress | pending_approval | approved"
}
```

### Response

```json
{
  "id": 456,
  "created_at": "2026-01-15T10:31:00.000Z",
  "parent_project_id": 123,
  "process_model": 1,
  "status": "underway",
  "stage": "Step 2: Project Information",
  "other": {
    "current_step": 2,
    "workflow_status": "draft"
  },
  ...
}
```

**Save the `id` as `PROCESS_INSTANCE_ID` for the next steps.**

---

## Step 4: Create Decision Payloads

The workflow has 5 decision elements. Create payloads for completed steps:

| Element ID | Title | Role | Description |
|------------|-------|------|-------------|
| 1 | User ID | Applicant | Authentication data |
| 2 | Project Information | Applicant | Project form data |
| 3 | Analysis Document | Applicant | Applicant's draft document |
| 4 | Environmental Review | Analyst | Analyst's review document |
| 5 | Approval | Approver | Final approval decision |

### Create Authentication Payload (Element 1)

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/process_decision_payload" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "process_decision_element": 1,
    "process": {PROCESS_INSTANCE_ID},
    "project": {PROJECT_ID},
    "result": "completed",
    "result_bool": true,
    "evaluation_data": {
      "user_id": "{USER_ID}",
      "authenticated_at": "2026-01-15T10:30:00.000Z"
    }
  }'
```

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `process_decision_element` | bigint | Yes | Decision element ID (1-5) |
| `process` | bigint | Yes | Process instance ID |
| `project` | bigint | Yes | Project ID |
| `result` | text | No | Result description |
| `result_bool` | boolean | No | Pass/fail indicator |
| `evaluation_data` | jsonb | Yes | Form/decision data |

---

## Step 5: Create Initial Task

Create the task for the applicant to complete step 2.

### Request

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/case_event" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "name": "Complete Project Information",
    "description": "Fill out the project information form to proceed",
    "type": "task",
    "tier": 2,
    "status": "pending",
    "assigned_entity": "{USER_ID}",
    "other": {
      "step_number": 2,
      "decision_element_id": 2,
      "assigned_user_id": "{USER_ID}",
      "assigned_role_id": 1,
      "task_type": "form"
    }
  }'
```

### Case Event Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_process_id` | bigint | Yes | Process instance ID |
| `name` | text | Yes | Task/event name |
| `description` | text | No | Detailed description |
| `type` | text | Yes | `"task"`, `"notification"`, or event type |
| `tier` | integer | No | Step number (for tasks) |
| `status` | text | No | `"pending"`, `"in progress"`, `"completed"` |
| `assigned_entity` | text | No | User ID for task assignment |
| `outcome` | text | No | Result (for completed events) |
| `other` | jsonb | No | Workflow metadata |

### Task `other` Field Schema (CaseEventWorkflowMeta)

```json
{
  "step_number": 2,
  "decision_element_id": 2,
  "assigned_user_id": "user-uuid",
  "assigned_role_id": 1,
  "task_type": "form | document | approval",
  "completed_by": "user-uuid (when completed)",
  "completed_at": "ISO timestamp (when completed)",
  "revision_requested": false,
  "revision_comments": "string (for revisions)"
}
```

### Task Types by Step

| Step | Task Type | Description |
|------|-----------|-------------|
| 2 | `form` | RJSF form submission |
| 3 | `document` | Markdown document editing |
| 4 | `document` | Markdown document editing |
| 5 | `approval` | Approve/reject decision |

---

## Step 6: Create Documents (For Steps 3 and 4)

When advancing to document steps, create document records.

### Create Draft Document (Step 3)

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/document" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "title": "Applicant Draft Document",
    "document_type": "draft",
    "status": "draft",
    "prepared_by": "{USER_ID}",
    "other": {
      "document_role": "draft",
      "created_by_user_id": "{USER_ID}",
      "markdown_content": "# Project Analysis Document\n\n## Executive Summary\n[Provide overview]\n\n## Project Description\n[Describe the project]\n\n## Environmental Considerations\n[List environmental factors]"
    }
  }'
```

### Create Analysis Document (Step 4)

```bash
curl -X POST "{SUPABASE_URL}/rest/v1/document" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "title": "Environmental Analysis",
    "document_type": "analysis",
    "status": "draft",
    "prepared_by": "{ANALYST_USER_ID}",
    "related_document_id": {DRAFT_DOCUMENT_ID},
    "other": {
      "document_role": "analysis",
      "created_by_user_id": "{ANALYST_USER_ID}",
      "markdown_content": "# Environmental Review Analysis\n\n## Review Summary\n[Summarize findings]\n\n## Compliance Assessment\n[Assess compliance]\n\n## Recommendations\n[Provide recommendations]"
    }
  }'
```

### Document Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_process_id` | bigint | Yes | Process instance ID |
| `title` | text | Yes | Document title |
| `document_type` | text | Yes | `"draft"` or `"analysis"` |
| `status` | text | Yes | `"draft"` or `"submitted"` |
| `prepared_by` | text | No | User ID who created it |
| `related_document_id` | bigint | No | Link to related document |
| `other` | jsonb | Yes | Document metadata |

### Document `other` Field Schema (DocumentWorkflowMeta)

```json
{
  "document_role": "draft | analysis",
  "created_by_user_id": "user-uuid",
  "last_edited_by_user_id": "user-uuid",
  "markdown_content": "# Document content in markdown format"
}
```

---

## Complete Workflow Example

Here's a complete example that creates an application through Step 2:

```bash
#!/bin/bash

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
EMAIL="applicant@example.com"
PASSWORD="secure-password"

# Step 1: Authenticate
echo "Authenticating..."
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.access_token')
USER_ID=$(echo $AUTH_RESPONSE | jq -r '.user.id')

if [ "$ACCESS_TOKEN" == "null" ]; then
  echo "Authentication failed"
  exit 1
fi

echo "Authenticated as user: ${USER_ID}"

# Step 2: Create Project
echo "Creating project..."
PROJECT_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/project" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"title\": \"Highway 101 Environmental Review\",
    \"description\": \"Environmental impact assessment for highway expansion\",
    \"sector\": \"transportation\",
    \"current_status\": \"draft\",
    \"other\": {
      \"applicant_user_id\": \"${USER_ID}\"
    }
  }")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.[0].id // .id')
echo "Created project: ${PROJECT_ID}"

# Step 3: Create Process Instance
echo "Creating process instance..."
PROCESS_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/process_instance" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"parent_project_id\": ${PROJECT_ID},
    \"process_model\": 1,
    \"status\": \"underway\",
    \"stage\": \"Step 2: Project Information\",
    \"start_date\": \"$(date +%Y-%m-%d)\",
    \"other\": {
      \"current_step\": 2,
      \"workflow_status\": \"draft\"
    }
  }")

PROCESS_ID=$(echo $PROCESS_RESPONSE | jq -r '.[0].id // .id')
echo "Created process instance: ${PROCESS_ID}"

# Step 4: Create Decision Payload for Step 1 (Auth)
echo "Creating auth decision payload..."
curl -s -X POST "${SUPABASE_URL}/rest/v1/process_decision_payload" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"process_decision_element\": 1,
    \"process\": ${PROCESS_ID},
    \"project\": ${PROJECT_ID},
    \"result\": \"completed\",
    \"result_bool\": true,
    \"evaluation_data\": {
      \"user_id\": \"${USER_ID}\",
      \"authenticated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }
  }"

# Step 5: Create Initial Task for Step 2
echo "Creating step 2 task..."
curl -s -X POST "${SUPABASE_URL}/rest/v1/case_event" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
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

echo ""
echo "Done! Created environmental review application:"
echo "  Project ID: ${PROJECT_ID}"
echo "  Process Instance ID: ${PROCESS_ID}"
echo "  Dashboard URL: https://your-app.com/case/${PROCESS_ID}"
```

---

## Advancing Through the Workflow

### Complete Step 2 (Project Information)

When the applicant completes the project information form:

```bash
# 1. Create decision payload for step 2
curl -X POST "${SUPABASE_URL}/rest/v1/process_decision_payload" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "process_decision_element": 2,
    "process": {PROCESS_INSTANCE_ID},
    "project": {PROJECT_ID},
    "result": "completed",
    "result_bool": true,
    "evaluation_data": {
      "title": "Highway 101 Environmental Review",
      "description": "Environmental impact assessment",
      "sector": "transportation",
      "type": "highway_expansion",
      "location_text": "Highway 101, San Francisco, CA"
    }
  }'

# 2. Mark step 2 task as completed
curl -X PATCH "${SUPABASE_URL}/rest/v1/case_event?id=eq.{TASK_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "outcome": "completed"
  }'

# 3. Update process instance to step 3
curl -X PATCH "${SUPABASE_URL}/rest/v1/process_instance?id=eq.{PROCESS_INSTANCE_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "Step 3: Applicant Document",
    "other": {
      "current_step": 3,
      "workflow_status": "in_progress"
    }
  }'

# 4. Create draft document for step 3
curl -X POST "${SUPABASE_URL}/rest/v1/document" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "title": "Applicant Draft Document",
    "document_type": "draft",
    "status": "draft",
    "prepared_by": "{USER_ID}",
    "other": {
      "document_role": "draft",
      "created_by_user_id": "{USER_ID}",
      "markdown_content": "# Project Analysis Document\n\n## Executive Summary\n..."
    }
  }'

# 5. Create task for step 3
curl -X POST "${SUPABASE_URL}/rest/v1/case_event" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "name": "Complete Analysis Document",
    "description": "Draft your project analysis document",
    "type": "task",
    "tier": 3,
    "status": "pending",
    "assigned_entity": "{USER_ID}",
    "other": {
      "step_number": 3,
      "decision_element_id": 3,
      "assigned_user_id": "{USER_ID}",
      "assigned_role_id": 1,
      "task_type": "document"
    }
  }'
```

---

## Role-Based Access Control

Tasks are automatically accessible to users with the matching role:

| Step | Required Role | Access Rule |
|------|---------------|-------------|
| 1, 2, 3 | Applicant (1) | Only the case creator |
| 4 | Analyst (2) | Any user with Analyst role (except case creator) |
| 5 | Approver (3) | Any user with Approver role (except case creator) |

### User Role Assignment

Users must have roles assigned in the `user_assignments` table:

```bash
# Assign Applicant role to a user
curl -X POST "${SUPABASE_URL}/rest/v1/user_assignments" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "{USER_ID}",
    "user_role": 1
  }'
```

| Role ID | Role Name | Responsibilities |
|---------|-----------|------------------|
| 1 | Applicant | Create cases, complete steps 2-3 |
| 2 | Analyst | Review and analyze (step 4) |
| 3 | Approver | Final approval (step 5) |

---

## Error Handling

Supabase REST API returns standard HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success (for PATCH) |
| 201 | Created (for POST) |
| 400 | Bad Request - check your JSON payload |
| 401 | Unauthorized - check your access token |
| 403 | Forbidden - RLS policy violation |
| 404 | Not Found - resource doesn't exist |
| 409 | Conflict - duplicate or constraint violation |

Error responses include a message:

```json
{
  "code": "PGRST204",
  "message": "Column 'invalid_field' does not exist",
  "details": null,
  "hint": null
}
```

---

## Row-Level Security (RLS)

The database has RLS policies that may restrict access:

- Users can only access projects where they are the applicant, analyst, or approver
- Process instances are accessible through their parent project
- Tasks are accessible to assigned users or users with the matching role
- Documents are accessible through their parent process

Ensure your requests use a valid access token for a user with appropriate permissions.

---

## Notifications

Create notification events to alert users of pending tasks:

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/case_event" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "name": "New Case Assigned",
    "description": "You have been assigned to review \"Highway 101 Environmental Review\"",
    "type": "notification",
    "status": "pending",
    "assigned_entity": "{TARGET_USER_ID}",
    "other": {
      "notification_type": "assignment",
      "project_id": {PROJECT_ID},
      "read": false
    }
  }'
```

### Notification Types

| Type | When to Use |
|------|-------------|
| `assignment` | User assigned to a new task |
| `approval_required` | Case ready for approval |
| `revision_requested` | Approver requests changes |
| `approved` | Case has been approved |
