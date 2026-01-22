import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Step2Form from '@/components/steps/Step2Form';
import Step3Document from '@/components/steps/Step3Document';
import Step4Analysis from '@/components/steps/Step4Analysis';
import Step5Approval from '@/components/steps/Step5Approval';
import type { Project, ProcessInstanceWorkflowMeta, DecisionElement } from '@/lib/types/database';

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

  // Get process instance with project
  const { data: processInstance, error } = await supabase
    .from('process_instance')
    .select(`
      *,
      project:parent_project_id(*)
    `)
    .eq('id', parseInt(processId))
    .single();

  if (error || !processInstance) {
    notFound();
  }

  const project = processInstance.project as unknown as Project;
  const meta = processInstance.other as ProcessInstanceWorkflowMeta;
  const currentStep = meta?.current_step || 2;

  // Get decision element for this step (contains form schema for step 2)
  const { data: decisionElement } = await supabase
    .from('decision_element')
    .select('*')
    .eq('id', stepNumber)
    .single();

  // Get existing task for this step
  const { data: existingTask } = await supabase
    .from('case_event')
    .select('*')
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
    .eq('parent_process_id', parseInt(processId));

  // Common props for all step components
  const commonProps = {
    processInstance,
    project,
    decisionElement: decisionElement as DecisionElement | null,
    currentStep,
    userId: user.id,
    task: existingTask,
    documents: documents || [],
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
