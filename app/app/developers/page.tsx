'use client';

import Link from 'next/link';
import { useState } from 'react';
import PublicHeader from '@/components/layout/PublicHeader';

type TabId = 'overview' | 'auth' | 'project' | 'process' | 'tasks' | 'documents';

export default function DeveloperResourcesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'auth', label: 'Authentication' },
    { id: 'project', label: 'Projects' },
    { id: 'process', label: 'Process Instance' },
    { id: 'tasks', label: 'Tasks & Events' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader user={null} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <section className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Developer Resources</h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Integrate your systems with Review Works using our REST API. Create cases,
            manage workflows, and track events programmatically.
          </p>
        </section>

        {/* Tab Navigation */}
        <nav className="flex flex-wrap border-b border-gray-200 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'auth' && <AuthTab />}
          {activeTab === 'project' && <ProjectTab />}
          {activeTab === 'process' && <ProcessTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'documents' && <DocumentsTab />}
        </div>

        {/* Footer CTA */}
        <section className="mt-8 text-center text-gray-600">
          <p>
            Need help integrating with Review Works?{' '}
            <Link href="/about" className="text-green-600 hover:text-green-700">
              Learn more about our platform
            </Link>{' '}
            or contact your administrator.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                <rect x="14" y="22" width="4" height="8" rx="1" fill="#854d0e"/>
                <polygon points="16,2 24,12 20,12 26,20 6,20 12,12 8,12" fill="#22c55e"/>
              </svg>
              <span className="font-semibold text-white">Review Works</span>
            </div>
            <div className="flex space-x-6">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">API Overview</h2>
        <p className="text-gray-600">
          The Review Works API allows external systems to create and manage environmental review
          cases programmatically. This is useful for integrating with existing workflows or
          automating case submissions.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Base URL</h3>
        <p className="text-gray-600 mb-2">All REST API endpoints follow this pattern:</p>
        <CodeBlock code="{SUPABASE_URL}/rest/v1/{table_name}" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Required Headers</h3>
        <p className="text-gray-600 mb-2">All API requests require these headers:</p>
        <CodeBlock
          code={`apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
Prefer: return=representation`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Integration Flow</h3>
        <p className="text-gray-600 mb-2">To create an environmental review case programmatically:</p>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li><strong>Authenticate</strong> - Sign in to get a user ID and access token</li>
          <li><strong>Create Project</strong> - Create the project record with case data</li>
          <li><strong>Create Process Instance</strong> - Link a workflow to the project</li>
          <li><strong>Create Initial Task</strong> - Create the first task for the applicant</li>
          <li><strong>Create Documents</strong> - Create document records for document steps</li>
          <li><strong>Log Case Events</strong> - Record workflow milestones</li>
        </ol>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Decision Elements (Workflow Steps)</h3>
        <p className="text-gray-600 mb-2">The Review Works workflow has 5 decision elements:</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm">1</td><td className="px-4 py-3 text-sm">User ID</td><td className="px-4 py-3 text-sm">Applicant</td><td className="px-4 py-3 text-sm text-gray-500">Authentication data</td></tr>
              <tr><td className="px-4 py-3 text-sm">2</td><td className="px-4 py-3 text-sm">Project Information</td><td className="px-4 py-3 text-sm">Applicant</td><td className="px-4 py-3 text-sm text-gray-500">Project details form</td></tr>
              <tr><td className="px-4 py-3 text-sm">3</td><td className="px-4 py-3 text-sm">Analysis Document</td><td className="px-4 py-3 text-sm">Applicant</td><td className="px-4 py-3 text-sm text-gray-500">Draft document</td></tr>
              <tr><td className="px-4 py-3 text-sm">4</td><td className="px-4 py-3 text-sm">Environmental Review</td><td className="px-4 py-3 text-sm">Analyst</td><td className="px-4 py-3 text-sm text-gray-500">Analyst review document</td></tr>
              <tr><td className="px-4 py-3 text-sm">5</td><td className="px-4 py-3 text-sm">Approval</td><td className="px-4 py-3 text-sm">Approver</td><td className="px-4 py-3 text-sm text-gray-500">Final approval decision</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuthTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600">
          Review Works uses Supabase authentication. Sign in to get the user ID and access
          token required for API calls.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign In Request</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/auth/v1/token?grant_type=password" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "applicant@example.com",
    "password": "your-password"
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Response</h3>
        <CodeBlock
          language="json"
          code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "abc123...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "applicant@example.com",
    "role": "authenticated"
  }
}`}
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Important:</strong> Save the <code className="bg-yellow-100 px-1 rounded">access_token</code> and{' '}
          <code className="bg-yellow-100 px-1 rounded">user.id</code> for subsequent API requests.
          The user must have the appropriate role assigned in <code className="bg-yellow-100 px-1 rounded">user_assignments</code>.
        </p>
      </div>
    </div>
  );
}

function ProjectTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Project</h2>
        <p className="text-gray-600">
          Create the project record with case data. The <code className="bg-gray-100 px-1 rounded">other</code> field
          stores workflow metadata including the applicant user ID.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Request</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/rest/v1/project" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer {ACCESS_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "title": "Highway 101 Environmental Review",
    "description": "Environmental impact assessment for highway expansion",
    "sector": "transportation",
    "lead_agency": "Department of Transportation",
    "type": "highway_expansion",
    "location_text": "Highway 101, San Francisco, CA",
    "current_status": "draft",
    "other": {
      "applicant_user_id": "{USER_ID}"
    }
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Fields</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm font-mono">title</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Project name</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">description</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">No</td><td className="px-4 py-3 text-sm text-gray-500">Project summary</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">sector</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">No</td><td className="px-4 py-3 text-sm text-gray-500">Category (energy, transportation, etc.)</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">current_status</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Must be &quot;draft&quot; for new cases</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">other</td><td className="px-4 py-3 text-sm">jsonb</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Workflow metadata (see below)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Metadata Schema</h3>
        <CodeBlock
          language="json"
          code={`{
  "applicant_user_id": "uuid (required) - Case creator",
  "analyst_user_id": "uuid (optional) - Assigned when step 4 starts",
  "approver_user_id": "uuid (optional) - Assigned when step 5 starts"
}`}
        />
      </div>
    </div>
  );
}

function ProcessTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Process Instance</h2>
        <p className="text-gray-600">
          Create the process instance to track workflow state. The <code className="bg-gray-100 px-1 rounded">other</code> field
          stores the current step and workflow status.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Request</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/rest/v1/process_instance" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer {ACCESS_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
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
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Process Instance Fields</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm font-mono">parent_project_id</td><td className="px-4 py-3 text-sm">bigint</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Project ID</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">process_model</td><td className="px-4 py-3 text-sm">bigint</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Use 1 for standard workflow</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">status</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">&quot;underway&quot; for active processes</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">stage</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm">No</td><td className="px-4 py-3 text-sm text-gray-500">Human-readable stage</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">other</td><td className="px-4 py-3 text-sm">jsonb</td><td className="px-4 py-3 text-sm">Yes</td><td className="px-4 py-3 text-sm text-gray-500">Workflow state metadata</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Process Instance Metadata Schema</h3>
        <CodeBlock
          language="json"
          code={`{
  "current_step": 2,
  "workflow_status": "draft | in_progress | pending_approval | approved"
}`}
        />
      </div>
    </div>
  );
}

function TasksTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Tasks & Case Events</h2>
        <p className="text-gray-600">
          Tasks and events are stored in the <code className="bg-gray-100 px-1 rounded">case_event</code> table.
          Tasks are assigned to users and drive the workflow. Events log milestones.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Task</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/rest/v1/case_event" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer {ACCESS_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "name": "Complete Project Information",
    "description": "Fill out the project information form",
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
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Task Fields</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm font-mono">parent_process_id</td><td className="px-4 py-3 text-sm">bigint</td><td className="px-4 py-3 text-sm text-gray-500">Process instance ID</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">type</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">&quot;task&quot; or &quot;notification&quot;</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">tier</td><td className="px-4 py-3 text-sm">integer</td><td className="px-4 py-3 text-sm text-gray-500">Step number (2-5)</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">status</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">&quot;pending&quot;, &quot;in progress&quot;, &quot;completed&quot;</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">assigned_entity</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">User ID for task assignment</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Task Metadata Schema</h3>
        <CodeBlock
          language="json"
          code={`{
  "step_number": 2,
  "decision_element_id": 2,
  "assigned_user_id": "user-uuid",
  "assigned_role_id": 1,
  "task_type": "form | document | approval",
  "completed_by": "user-uuid (when completed)",
  "completed_at": "ISO timestamp (when completed)"
}`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Task Types by Step</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm">2</td><td className="px-4 py-3 text-sm font-mono">form</td><td className="px-4 py-3 text-sm">Applicant (1)</td></tr>
              <tr><td className="px-4 py-3 text-sm">3</td><td className="px-4 py-3 text-sm font-mono">document</td><td className="px-4 py-3 text-sm">Applicant (1)</td></tr>
              <tr><td className="px-4 py-3 text-sm">4</td><td className="px-4 py-3 text-sm font-mono">document</td><td className="px-4 py-3 text-sm">Analyst (2)</td></tr>
              <tr><td className="px-4 py-3 text-sm">5</td><td className="px-4 py-3 text-sm font-mono">approval</td><td className="px-4 py-3 text-sm">Approver (3)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Documents</h2>
        <p className="text-gray-600">
          Documents are created for Steps 3 and 4. They store markdown content that users
          edit in the built-in editor.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Draft Document (Step 3)</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/rest/v1/document" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer {ACCESS_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "parent_process_id": {PROCESS_INSTANCE_ID},
    "title": "Applicant Draft Document",
    "document_type": "draft",
    "status": "draft",
    "prepared_by": "{USER_ID}",
    "other": {
      "document_role": "draft",
      "created_by_user_id": "{USER_ID}",
      "markdown_content": "# Project Analysis\\n\\n## Summary\\n..."
    }
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Analysis Document (Step 4)</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST "{SUPABASE_URL}/rest/v1/document" \\
  -H "apikey: {SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer {ACCESS_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
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
      "markdown_content": "# Environmental Review\\n\\n## Findings\\n..."
    }
  }'`}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Fields</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr><td className="px-4 py-3 text-sm font-mono">parent_process_id</td><td className="px-4 py-3 text-sm">bigint</td><td className="px-4 py-3 text-sm text-gray-500">Process instance ID</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">document_type</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">&quot;draft&quot; or &quot;analysis&quot;</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">status</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">&quot;draft&quot; or &quot;submitted&quot;</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">prepared_by</td><td className="px-4 py-3 text-sm">text</td><td className="px-4 py-3 text-sm text-gray-500">User ID who created it</td></tr>
              <tr><td className="px-4 py-3 text-sm font-mono">related_document_id</td><td className="px-4 py-3 text-sm">bigint</td><td className="px-4 py-3 text-sm text-gray-500">Link to draft (for analysis)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Metadata Schema</h3>
        <CodeBlock
          language="json"
          code={`{
  "document_role": "draft | analysis",
  "created_by_user_id": "user-uuid",
  "last_edited_by_user_id": "user-uuid",
  "markdown_content": "# Document content in markdown"
}`}
        />
      </div>
    </div>
  );
}

// Reusable code block component with copy functionality
function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
