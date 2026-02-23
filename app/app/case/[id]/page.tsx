import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { ProcessInstanceWorkflowMeta, CaseEventWorkflowMeta, DocumentWorkflowMeta } from '@/lib/types/database';
import { getTenantContextForUser } from '@/lib/tenant/server';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    'in progress': 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    underway: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, name: 'Auth' },
    { num: 2, name: 'Project Info' },
    { num: 3, name: 'Draft Doc' },
    { num: 4, name: 'Analysis' },
    { num: 5, name: 'Approval' },
  ];

  return (
    <div className="flex items-center space-x-2">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step.num < currentStep
                ? 'bg-green-100 text-green-800'
                : step.num === currentStep
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {step.num < currentStep ? '✓' : step.num}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 h-1 ${
                step.num < currentStep ? 'bg-green-200' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  const { tenantId } = await getTenantContextForUser(user.id);

  // Get process instance with project
  const { data: processInstance, error } = await supabase
    .from('process_instance')
    .select(`
      *,
      project:parent_project_id(*)
    `)
    .eq('id', parseInt(id))
    .eq('tenant_id', tenantId)
    .single();

  if (error || !processInstance) {
    notFound();
  }

  const project = processInstance.project;
  const meta = processInstance.other as ProcessInstanceWorkflowMeta;
  const currentStep = meta?.current_step || 2;

  // Get tasks for this case
  const { data: tasks } = await supabase
    .from('case_event')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', parseInt(id))
    .eq('type', 'task')
    .order('created_at', { ascending: false });

  // Get documents for this case
  const { data: documents } = await supabase
    .from('document')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', parseInt(id))
    .order('created_at', { ascending: false });

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'tasks', name: 'Tasks' },
    { id: 'documents', name: 'Documents' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {project?.title || 'Untitled Project'}
            </h1>
            <p className="text-gray-600 mt-1">{processInstance.stage}</p>
          </div>
          <StatusBadge status={processInstance.status || 'draft'} />
        </div>

        <div className="mt-6">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Quick action */}
        {currentStep <= 5 && (
          <div className="mt-6">
            <Link
              href={`/step/${currentStep}/${id}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              Continue to Step {currentStep}
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/case/${id}?tab=${t.id}`}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tab === t.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Project Information</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Title</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.title || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.current_status || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.description || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Lead Agency</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.lead_agency || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Sector</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.sector || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Location</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project?.location_text || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {processInstance.start_date
                      ? new Date(processInstance.start_date).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Step</dt>
                  <dd className="mt-1 text-sm text-gray-900">Step {currentStep} of 5</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Tasks</h3>
            {!tasks || tasks.length === 0 ? (
              <p className="text-gray-500">No tasks yet.</p>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const taskMeta = task.other as CaseEventWorkflowMeta;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-900">{task.name}</span>
                          <StatusBadge status={task.status || 'pending'} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Step {taskMeta?.step_number || '-'} •{' '}
                          {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>
                      {task.status !== 'completed' && (
                        <Link
                          href={`/step/${taskMeta?.step_number || 2}/${id}`}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Go to task
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Documents</h3>
            {!documents || documents.length === 0 ? (
              <p className="text-gray-500">No documents yet.</p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => {
                  const docMeta = doc.other as DocumentWorkflowMeta;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                          <StatusBadge status={doc.status || 'draft'} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1 ml-8">
                          {docMeta?.document_role === 'draft' ? 'Applicant Draft' : 'Analysis Document'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 ml-8">
                          Created {new Date(doc.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Link
                        href={`/step/${docMeta?.document_role === 'draft' ? 3 : 4}/${id}`}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
