import { SupabaseClient } from '@supabase/supabase-js';
import { findDecisionElementForStep } from '@/lib/workflow/decision-element';
import type {
  Project,
  CaseEvent,
  CaseEventWorkflowMeta,
  ProcessInstanceWorkflowMeta,
  ProjectWorkflowMeta,
} from '@/lib/types/database';

export type ApprovalDecision = 'approved' | 'changes_requested';

const APPROVAL_STEP = 5;
const ANALYST_STEP = 4;

export interface DecideApprovalInput {
  tenantId: string;
  userId: string;
  processInstanceId: number;
  decision: ApprovalDecision;
  comments: string;
}

/**
 * Record the approval decision for a case.
 *
 * This is the permit decision itself, so it runs server-side against a caller whose
 * membership and step access have already been checked. The browser previously issued
 * this sequence directly.
 */
export async function decideApproval(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { tenantId, userId, processInstanceId, decision, comments }: DecideApprovalInput
): Promise<{ processInstanceId: number; decision: ApprovalDecision }> {
  if (decision === 'changes_requested' && !comments.trim()) {
    throw new Error('Feedback is required when requesting changes');
  }

  const { data: processInstance, error: processError } = await supabase
    .from('process_instance')
    .select('*, project:parent_project_id(*)')
    .eq('id', processInstanceId)
    .eq('tenant_id', tenantId)
    .single();

  if (processError || !processInstance) {
    throw new Error('Case not found');
  }

  const project = processInstance.project as unknown as Project;
  const projectMeta = (project?.other as ProjectWorkflowMeta) || {};
  const analystId = projectMeta.analyst_user_id || '';

  // The open approval task, if the case still has one.
  const { data: task } = await supabase
    .from('case_event')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', processInstanceId)
    .eq('type', 'task')
    .eq('tier', APPROVAL_STEP)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const approvalElement = await findDecisionElementForStep(supabase, tenantId, APPROVAL_STEP, 'id');
  const analystElement = await findDecisionElementForStep(supabase, tenantId, ANALYST_STEP, 'id');
  const approved = decision === 'approved';
  const now = new Date().toISOString();

  if (task) {
    const taskMeta = ((task as CaseEvent).other as CaseEventWorkflowMeta) || {};
    await supabase
      .from('case_event')
      .update({
        status: 'completed',
        outcome: decision,
        other: {
          ...taskMeta,
          completed_by: userId,
          completed_at: now,
          approval_decision: decision,
          approval_comments: comments,
        },
      })
      .eq('id', (task as CaseEvent).id)
      .eq('tenant_id', tenantId);
  }

  await supabase.from('process_decision_payload').insert({
    tenant_id: tenantId,
    process_decision_element: approvalElement?.id ?? null,
    process: processInstanceId,
    project: project.id,
    result: decision,
    result_bool: approved,
    result_notes: comments,
    evaluation_data: approved
      ? { approver_id: userId, approved_at: now }
      : { approver_id: userId, decision_at: now },
  });

  const processMeta: ProcessInstanceWorkflowMeta = {
    ...((processInstance.other as ProcessInstanceWorkflowMeta) || {}),
    // Past the last step means finished; back to 4 means the analyst revises.
    current_step: approved ? APPROVAL_STEP + 1 : ANALYST_STEP,
    workflow_status: approved ? 'approved' : 'in_progress',
  };

  await supabase
    .from('process_instance')
    .update(
      approved
        ? {
            status: 'completed',
            stage: 'Approved',
            outcome: 'approved',
            complete_date: now.split('T')[0],
            other: processMeta as unknown as Record<string, unknown>,
          }
        : {
            stage: 'Step 4: Analyst Review (Revision)',
            other: processMeta as unknown as Record<string, unknown>,
          }
    )
    .eq('id', processInstanceId)
    .eq('tenant_id', tenantId);

  if (approved) {
    await supabase
      .from('project')
      .update({ current_status: 'approved' })
      .eq('id', project.id)
      .eq('tenant_id', tenantId);
  } else {
    const revisionMeta = {
      step_number: ANALYST_STEP,
      decision_element_id: analystElement?.id ?? null,
      assigned_user_id: analystId,
      assigned_role_id: 2,
      task_type: 'document',
      revision_requested: true,
      revision_comments: comments,
      revision_requested_by: userId,
    };

    await supabase.from('case_event').insert({
      tenant_id: tenantId,
      parent_process_id: processInstanceId,
      name: 'Revise Environmental Review',
      description: `Revisions requested: ${comments}`,
      type: 'task',
      tier: ANALYST_STEP,
      status: 'pending',
      assigned_entity: analystId,
      other: revisionMeta as unknown as Record<string, unknown>,
    });
  }

  if (analystId) {
    await supabase.from('case_event').insert({
      tenant_id: tenantId,
      parent_process_id: processInstanceId,
      name: approved ? 'Case Approved' : 'Revisions Requested',
      description: approved
        ? `Your environmental analysis for "${project.title}" has been approved!${comments ? ` Comment: ${comments}` : ''}`
        : `Your environmental analysis for "${project.title}" requires revisions: ${comments}`,
      type: 'notification',
      status: 'pending',
      assigned_entity: analystId,
      other: {
        notification_type: approved ? 'approved' : 'revision_requested',
        project_id: project.id,
        read: false,
      },
    });
  }

  return { processInstanceId, decision };
}
