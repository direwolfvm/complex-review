# Review Works user guide

This guide describes the behavior visible to applicants, analysts, and approvers in the current application.

## Accounts and access

Review Works supports email/password sign-up and sign-in through Supabase Auth.

1. Open **Sign In**.
2. Sign in with an existing account, or switch to **Sign up**.
3. New users confirm their address through the email sent by Supabase.
4. After authentication, Review Works checks for an active membership in the configured tenant.

Authentication alone does not grant application access. An administrator must also create:

- an active `user_tenant_membership` for the deployment's tenant; and
- one or more tenant-scoped `user_assignments` rows for Applicant, Analyst, or Approver work.

If the app reports that no active membership exists, contact the tenant administrator. If the dashboard says **No roles assigned**, the membership is valid but the user has no workflow role.

## Navigation

Public pages:

- **Home** summarizes the workflow.
- **About** describes the product and data model.
- **Developers** provides a compact legacy REST integration overview. Its examples predate tenant support; use `app/docs/API_INTEGRATION.md` for current integrations.

Authenticated pages:

- **Dashboard** shows the user's active tasks, recent cases, roles, and up to ten unread notifications.
- **Cases** shows tenant cases in which the user is the applicant, analyst, or approver.
- **Start New Case** initializes a new process.
- **Case detail** shows the current stage, progress, project details, documents, and event timeline.

Use the bell menu to mark notifications as read. **Sign out** ends the Supabase session.

## Roles

### Applicant

An applicant starts a case, completes project information, and submits the applicant document. The creator's user ID is stored on the project and is excluded from analyst and approver assignment.

### Analyst

An analyst receives Step 4, reviews the applicant document, prepares an environmental analysis, and responds to any revision request.

### Approver

An approver reviews the analyst's submission. They can approve the case or return it to the analyst with required feedback.

A user may hold more than one role, but assignment rules prevent the applicant from becoming the analyst or approver on the same case and prevent the analyst from approving the same case.

## Starting a case

Select **New Case** or **Start New Case**, review the five-step preview, and select **Start Application**.

Review Works creates:

- a draft project named `New Project`;
- an underway process at Step 2;
- a pending Step 2 task assigned to the creator; and
- a completed Step 1 authentication payload.

The app then opens Step 2.

## Step 2: Project information

The form comes from `decision_element.form_data` for decision element `2`. The form may therefore vary by tenant seed data.

Submitting the form:

- updates the project title, description, sector, lead agency, and location text;
- preserves additional form values in project workflow metadata;
- records a Step 2 decision payload;
- completes the current task;
- advances the process to Step 3; and
- creates an applicant document and Step 3 task.

Correct the form validation messages before submitting.

## Step 3: Applicant document

Without HedgeDoc, the built-in editor supports Markdown editing and preview. **Save Draft** saves content without advancing the case. **Submit and Continue** stores the document as submitted and advances the process to Step 4.

With HedgeDoc enabled, the editor is embedded. Review Works attempts to create and link a note automatically. If anonymous note creation does not return a usable note URL, the iframe falls back to HedgeDoc's `/new` page. HedgeDoc handles editing and autosave; the local **Save Draft** button is disabled.

When Step 3 is submitted, Review Works:

- records a Step 3 decision payload;
- completes the applicant task;
- chooses an eligible analyst;
- stores that analyst on the project when found;
- creates the analysis document, analyst task, and notification; and
- advances the case to Step 4.

If no eligible analyst assignment exists, the workflow can advance with an unassigned task. An administrator must correct the tenant role assignments.

## Step 4: Environmental analysis

The analyst can show or hide the applicant draft while writing the analysis. In internal-editor mode, both documents appear side by side and the applicant draft is read-only. In HedgeDoc mode, linked notes appear in embedded frames.

**Save Draft** is available only with the internal editor. **Submit for Approval** requires non-empty internal Markdown; HedgeDoc mode relies on the external note.

Submission:

- marks the analysis document submitted;
- records a Step 4 decision payload;
- completes the analyst task;
- selects and stores an eligible approver;
- creates the Step 5 task and notification; and
- changes the workflow status to pending approval.

When an approver has requested changes, the Step 4 page displays the revision feedback. Resubmission returns the case to Step 5.

## Step 5: Approval

The approver reviews the Markdown stored on the analysis document and may enter comments. In HedgeDoc mode, the current Step 5 preview does not fetch the live note, so operators should confirm that the database preview is suitable for the approval process.

- **Approve** allows optional comments, completes the process and project, records the approval payload, and notifies the analyst.
- **Request Changes** requires comments, completes the approval task with a `changes_requested` outcome, creates a new analyst task and notification, and returns the process to Step 4.

Approval is the terminal workflow action. The case detail remains available after completion.

## Case visibility and status

Dashboard and case-list visibility is based on the user IDs stored in `project.other`:

- `applicant_user_id`
- `analyst_user_id`
- `approver_user_id`

The process uses these principal states:

| Display state | Meaning |
| --- | --- |
| `draft` | Newly created; Step 2 has not been completed |
| `in_progress` | Steps 3 or 4 are active |
| `pending_approval` | Step 5 is active |
| `approved` | Approval completed |

Tasks use `pending`, `in progress`, or `completed`. Notifications are `case_event` rows with type `notification`; marking one read changes its status to `completed`.

## Troubleshooting

- **Returned to Sign In:** the session is missing or expired. Sign in again.
- **No active tenant membership:** the account is not active in the configured tenant.
- **No roles assigned:** ask an administrator to create a tenant-scoped `user_assignments` row.
- **No task appears after a handoff:** verify that an eligible analyst or approver exists and is not already an excluded case participant.
- **HedgeDoc frame is blank or blocked:** verify the HedgeDoc origin, its iframe policy, Review Works' Content Security Policy, and any authentication requirement.
- **Connection warning:** use **Clear Cache & Reload** in the warning banner, then sign in again.
