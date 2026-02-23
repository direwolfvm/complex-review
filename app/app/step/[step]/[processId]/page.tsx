import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Step2Form from '@/components/steps/Step2Form';
import Step3Document from '@/components/steps/Step3Document';
import Step4Analysis from '@/components/steps/Step4Analysis';
import Step5Approval from '@/components/steps/Step5Approval';
import { canUserAccessStep, getRoleName } from '@/lib/workflow/engine';
import type { Project, ProcessInstanceWorkflowMeta, DecisionElement } from '@/lib/types/database';
import { getTenantContextForUser } from '@/lib/tenant/server';

export default async function StepPage({
  params,
}: {
  params: Promise<{ step: string; processId: string }>;
}) {
  const { step, processId } = await params;
  const stepNumber = parseInt(step);

  if (stepNumber < 2 || stepNumber > 5) {
    notFound();
  }

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
    .eq('id', parseInt(processId))
    .eq('tenant_id', tenantId)
    .single();

  if (error || !processInstance) {
    notFound();
  }

  const project = processInstance.project as unknown as Project;
  const meta = processInstance.other as ProcessInstanceWorkflowMeta;
  const currentStep = meta?.current_step || 2;

  // Check if user has access to this step based on their role
  const { canAccess, requiredRole, userRoles } = await canUserAccessStep(
    supabase,
    user.id,
    stepNumber,
    parseInt(processId),
    tenantId
  );

  // If user doesn't have access, show access denied page
  if (!canAccess) {
    const requiredRoleName = requiredRole ? getRoleName(requiredRole) : 'Unknown';
    const userRoleNames = userRoles.map(r => getRoleName(r)).join(', ') || 'None assigned';

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center py-8">
            <svg className="mx-auto h-16 w-16 text-yellow-500\" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Access Restricted</h1>
            <p className="mt-2 text-gray-600">
              You don&apos;t have permission to access this step.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-md text-sm text-gray-600">
              <p><strong>Required Role:</strong> {requiredRoleName}</p>
              <p><strong>Your Roles:</strong> {userRoleNames}</p>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              This step is assigned to a user with the <strong>{requiredRoleName}</strong> role.
              Please contact your administrator if you believe you should have access.
            </p>
            <div className="mt-6 space-x-4">
              <Link
                href={`/case/${processId}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                View Case Details
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get decision element for this step (contains form schema for step 2)
  const { data: decisionElement } = await supabase
    .from('decision_element')
    .select('*')
    .eq('id', stepNumber)
    .eq('tenant_id', tenantId)
    .single();

  // Get existing task for this step
  const { data: existingTask } = await supabase
    .from('case_event')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', parseInt(processId))
    .eq('type', 'task')
    .eq('tier', stepNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get documents for document steps
  const { data: documents } = await supabase
    .from('document')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', parseInt(processId));

  const hedgedocBaseUrl = process.env.HEDGEDOC_BASE_URL || null;
  // Common props for all step components
  const commonProps = {
    processInstance,
    project,
    decisionElement: decisionElement as DecisionElement | null,
    currentStep,
    userId: user.id,
    tenantId,
    task: existingTask,
    documents: documents || [],
    hedgedocBaseUrl,
  };

  // Render appropriate step component
  switch (stepNumber) {
    case 2:
      return <Step2Form {...commonProps} />;
    case 3:
      return <Step3Document {...commonProps} />;
    case 4:
      return <Step4Analysis {...commonProps} />;
    case 5:
      return <Step5Approval {...commonProps} />;
    default:
      notFound();
  }
}
