# Complex Review - Environmental Permit Workflow System

A case and task management application built with Next.js, Supabase, and TypeScript implementing a 5-step environmental review workflow.

## Overview

This application implements a workflow for environmental permit reviews with the following steps:

1. **Authentication** - User signs in via Supabase Auth
2. **Project Information** - Applicant fills out project details using dynamic RJSF form
3. **Applicant Document** - Applicant drafts their project analysis document
4. **Analyst Review** - Analyst reviews submission and produces environmental analysis
5. **Approval Gate** - Approver approves or requests changes (loops back to step 4)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Forms**: react-jsonschema-form (RJSF)
- **Document Editing**: Internal Markdown editor (with optional HedgeDoc integration)

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project with existing PIC schema

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HedgeDoc Configuration (Optional - falls back to internal editor)
HEDGEDOC_BASE_URL=https://your-hedgedoc-instance.com
HEDGEDOC_API_TOKEN=your-hedgedoc-api-token

# Application URL
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd complex-review

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

## Local Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

The application will be available at `http://localhost:3000`.

## Database Schema

The application uses the existing PIC (Permit Intelligence Center) schema:

### Core Tables

- **project** - Project records with workflow metadata in `other` jsonb field
- **process_model** - Workflow template definition
- **process_instance** - Active workflow instances linked to projects
- **decision_element** - Step definitions with form schemas
- **case_event** - Tasks (type='task') and notifications (type='notification')
- **document** - Document records with markdown content in `other` jsonb field
- **user_role** - Role definitions (Applicant=1, Analyst=2, Approver=3)
- **user_assignments** - User-to-role mappings

### Workflow Metadata

Workflow-specific data is stored in jsonb `other` fields:

**project.other:**
```json
{
  "applicant_user_id": "uuid",
  "analyst_user_id": "uuid",
  "approver_user_id": "uuid"
}
```

**process_instance.other:**
```json
{
  "current_step": 1-5,
  "workflow_status": "pending|in_progress|pending_approval|approved|rejected"
}
```

**case_event.other (for tasks):**
```json
{
  "step_number": 1-5,
  "decision_element_id": 1-5,
  "assigned_user_id": "uuid",
  "assigned_role_id": 1-3,
  "task_type": "form|document|approval"
}
```

**document.other:**
```json
{
  "document_role": "draft|analysis",
  "created_by_user_id": "uuid",
  "markdown_content": "...",
  "hedgedoc_note_id": "optional"
}
```

## Application Structure

```
app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # Landing/redirect page
├── globals.css             # Tailwind + RJSF styles
├── login/
│   └── page.tsx            # Login page
├── auth/
│   └── callback/
│       └── route.ts        # OAuth callback handler
├── dashboard/
│   ├── layout.tsx          # Dashboard layout
│   └── page.tsx            # User dashboard (tasks, cases)
├── cases/
│   ├── layout.tsx          # Cases list layout
│   └── page.tsx            # All cases list
├── case/
│   ├── new/
│   │   └── page.tsx        # Create new case
│   └── [id]/
│       └── page.tsx        # Case detail view
└── step/
    └── [step]/
        └── [processId]/
            └── page.tsx    # Step router

components/
├── layout/
│   └── DashboardLayout.tsx # Main app layout with nav
├── steps/
│   ├── Step2Form.tsx       # RJSF project info form
│   ├── Step3Document.tsx   # Applicant document editor
│   ├── Step4Analysis.tsx   # Analyst review (side-by-side)
│   └── Step5Approval.tsx   # Approval decision
└── editor/
    └── MarkdownEditor.tsx  # Internal markdown editor

lib/
├── supabase/
│   ├── client.ts           # Browser Supabase client
│   ├── server.ts           # Server Supabase client
│   └── middleware.ts       # Auth middleware helper
├── types/
│   └── database.ts         # TypeScript types for schema
├── workflow/
│   └── engine.ts           # Workflow functions
└── hedgedoc/
    └── client.ts           # HedgeDoc API client
```

## User Roles

1. **Applicant** (role_id: 1)
   - Creates new cases
   - Completes project information form (Step 2)
   - Drafts applicant document (Step 3)

2. **Analyst** (role_id: 2)
   - Reviews applicant submissions
   - Produces environmental analysis (Step 4)
   - Can receive revision requests

3. **Approver** (role_id: 3)
   - Reviews completed analyses
   - Approves or requests changes (Step 5)

## Workflow Flow

```
┌─────────────────┐
│  Step 1: Auth   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: Form    │ (Applicant)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 3: Doc     │ (Applicant)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 4: Review  │ (Analyst)
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Request Changes
│ Step 5: Approve │ ─────────────────────┐
└────────┬────────┘                      │
         │ Approve                       │
         ▼                               │
┌─────────────────┐                      │
│    Complete     │                      │
└─────────────────┘                      │
                                         │
         ┌───────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Step 4: Revise  │ (Analyst - with comments)
└────────┬────────┘
         │
         └──────────▶ Back to Step 5
```

## Features

- **Dynamic Forms**: RJSF forms generated from decision_element.form_data
- **Collaborative Editing**: Internal markdown editor (HedgeDoc optional)
- **Side-by-Side Review**: Analysts see applicant draft alongside their editor
- **Revision Loop**: Approvers can request changes with comments
- **Notifications**: In-app notification system via case_event
- **Task Management**: Dashboard shows pending tasks per user

## Docker

Build and run locally with Docker:

```bash
cd app

# Build the image
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_APP_BASE_URL=http://localhost:8080 \
  -t complex-review .

# Run the container
docker run -p 8080:8080 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  complex-review
```

## Google Cloud Run Deployment

### Prerequisites

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`
4. Enable required APIs:
   ```bash
   gcloud services enable cloudbuild.googleapis.com run.googleapis.com
   ```

### Deploy

Using the deployment script:

```bash
cd app

# Set required environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Optional

# Deploy
./deploy.sh
```

Or deploy manually:

```bash
cd app

# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/complex-review \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_APP_BASE_URL=https://your-service-url.run.app

# Deploy to Cloud Run
gcloud run deploy complex-review \
  --image gcr.io/YOUR_PROJECT_ID/complex-review \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --set-env-vars SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Post-Deployment

After the first deployment:

1. Get your Cloud Run service URL from the output
2. Update your Supabase project's auth settings:
   - Go to Authentication > URL Configuration
   - Add your Cloud Run URL to "Redirect URLs"
3. Redeploy with the correct `NEXT_PUBLIC_APP_BASE_URL`:
   ```bash
   export NEXT_PUBLIC_APP_BASE_URL=https://your-service-url.run.app
   ./deploy.sh
   ```

## License

MIT
