import { SupabaseClient } from '@supabase/supabase-js';
import { findDecisionElementForStep } from '@/lib/workflow/decision-element';
import { createNote, isHedgeDocConfigured } from '@/lib/hedgedoc/client';
import type {
  Project,
  CaseEvent,
  CaseEventWorkflowMeta,
  ProcessInstanceWorkflowMeta,
  ProjectWorkflowMeta,
  DocumentWorkflowMeta,
} from '@/lib/types/database';

export interface SubmitProjectInformationInput {
  tenantId: string;
  userId: string;
  processInstanceId: number;
  formData: Record<string, unknown>;
}

function draftContent(formData: Record<string, unknown>): string {
  return `# ${formData.title}

## Executive Summary
[Provide a brief overview of the project]

## Project Description
${formData.description || '[Describe the project in detail]'}

## Environmental Considerations
[List any environmental factors to consider]

## Supporting Documentation
[Reference any supporting documents]
`;
}

/** The open task for a step, or null when the case has none. */
async function openTaskForStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
  processInstanceId: number,
  step: number
): Promise<CaseEvent | null> {
  const { data } = await supabase
    .from('case_event')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', processInstanceId)
    .eq('type', 'task')
    .eq('tier', step)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return (data as CaseEvent) ?? null;
}

/**
 * Step 2: the applicant submits project information.
 *
 * Records the form against the project and the decision payload, closes the step 2
 * task, moves the case to step 3 and seeds the draft document the applicant will edit.
 */
export async function submitProjectInformation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { tenantId, userId, processInstanceId, formData }: SubmitProjectInformationInput
): Promise<{ processInstanceId: number; nextStep: number }> {
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

  if (!formData.title || typeof formData.title !== 'string' || !formData.title.trim()) {
    throw new Error('Project title is required');
  }

  await supabase
    .from('project')
    .update({
      title: formData.title as string,
      description: (formData.description as string) || null,
      sector: (formData.sector as string) || null,
      lead_agency: (formData.lead_agency as string) || null,
      location_text: (formData.location_text as string) || null,
      current_status: 'underway',
    })
    .eq('id', project.id)
    .eq('tenant_id', tenantId);

  const element = await findDecisionElementForStep(supabase, tenantId, 2, 'id');
  await supabase.from('process_decision_payload').insert({
    tenant_id: tenantId,
    process_decision_element: element?.id ?? null,
    process: processInstanceId,
    project: project.id,
    result: 'completed',
    result_bool: true,
    evaluation_data: formData,
  });

  const task = await openTaskForStep(supabase, tenantId, processInstanceId, 2);
  if (task) {
    const taskMeta = (task.other as CaseEventWorkflowMeta) || {};
    await supabase
      .from('case_event')
      .update({
        status: 'completed',
        outcome: 'completed',
        other: { ...taskMeta, completed_by: userId, completed_at: new Date().toISOString() },
      })
      .eq('id', task.id)
      .eq('tenant_id', tenantId);
  }

  const processMeta: ProcessInstanceWorkflowMeta = {
    ...((processInstance.other as ProcessInstanceWorkflowMeta) || {}),
    current_step: 3,
    workflow_status: 'in_progress',
  };

  await supabase
    .from('process_instance')
    .update({
      stage: 'Step 3: Applicant Document',
      other: processMeta as unknown as Record<string, unknown>,
    })
    .eq('id', processInstanceId)
    .eq('tenant_id', tenantId);

  const nextElement = await findDecisionElementForStep(supabase, tenantId, 3, 'id');
  await supabase.from('case_event').insert({
    tenant_id: tenantId,
    parent_process_id: processInstanceId,
    name: 'Complete Analysis Document',
    description: 'Draft your project analysis document',
    type: 'task',
    tier: 3,
    status: 'pending',
    assigned_entity: userId,
    other: {
      step_number: 3,
      decision_element_id: nextElement?.id ?? null,
      assigned_user_id: userId,
      assigned_role_id: 1,
      task_type: 'document',
    } as unknown as Record<string, unknown>,
  });

  const markdown = draftContent(formData);
  const docMeta: DocumentWorkflowMeta = {
    document_role: 'draft',
    created_by_user_id: userId,
    markdown_content: markdown,
  };

  const { data: draft } = await supabase
    .from('document')
    .insert({
      tenant_id: tenantId,
      parent_process_id: processInstanceId,
      title: 'Applicant Draft Document',
      document_type: 'draft',
      status: 'draft',
      prepared_by: userId,
      other: docMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  // HedgeDoc is optional; a failure to mint a note must not lose the submission.
  if (draft && isHedgeDocConfigured()) {
    try {
      const note = await createNote(draft.title || 'Applicant Draft Document', markdown);
      if (note) {
        await supabase
          .from('document')
          .update({
            other: { ...docMeta, hedgedoc_note_id: note.noteId, hedgedoc_url: note.url },
          })
          .eq('id', draft.id)
          .eq('tenant_id', tenantId);
      }
    } catch (err) {
      console.error('HedgeDoc note creation failed; continuing with the internal editor:', err);
    }
  }

  return { processInstanceId, nextStep: 3 };
}

interface DocumentStepShape {
  /** Which document the step submits. */
  documentRole: 'draft' | 'analysis';
  nextStep: number;
  nextRole: number;
  nextStage: string;
  nextWorkflowStatus: NonNullable<ProcessInstanceWorkflowMeta['workflow_status']>;
  nextTaskName: string;
  nextTaskDescription: (projectTitle: string) => string;
  nextTaskType: 'document' | 'approval';
  /** Where the chosen assignee is remembered on the project. */
  assigneeKey: 'analyst_user_id' | 'approver_user_id';
  notificationName: string;
  notificationType: string;
  notificationDescription: (projectTitle: string) => string;
}

const DOCUMENT_STEPS: Record<number, DocumentStepShape> = {
  3: {
    documentRole: 'draft',
    nextStep: 4,
    nextRole: 2,
    nextStage: 'Step 4: Analyst Review',
    nextWorkflowStatus: 'in_progress',
    nextTaskName: 'Complete Environmental Review',
    nextTaskDescription: () => 'Review the applicant document and produce the environmental analysis',
    nextTaskType: 'document',
    assigneeKey: 'analyst_user_id',
    notificationName: 'New Case Assigned',
    notificationType: 'assignment',
    notificationDescription: (title) => `You have been assigned to review "${title}"`,
  },
  4: {
    documentRole: 'analysis',
    nextStep: 5,
    nextRole: 3,
    nextStage: 'Step 5: Approval',
    nextWorkflowStatus: 'pending_approval',
    nextTaskName: 'Review and Approve',
    nextTaskDescription: (title) => `Review the environmental analysis for "${title}"`,
    nextTaskType: 'approval',
    assigneeKey: 'approver_user_id',
    notificationName: 'Approval Required',
    notificationType: 'approval_required',
    notificationDescription: (title) => `Environmental analysis for "${title}" is ready for approval`,
  },
};

function analysisContent(projectTitle: string): string {
  return `# Environmental Review Analysis

## Review Summary
[Summarize the environmental review findings for "${projectTitle}"]

## Applicant Submission Review
[Review of the applicant's submitted document]

## Compliance Assessment
[Assess compliance with applicable regulations]

## Recommendations
[Provide recommendations]

## Conclusion
[State the conclusion of the analysis]
`;
}

export interface SubmitDocumentStepInput {
  tenantId: string;
  userId: string;
  processInstanceId: number;
  step: number;
  content: string;
}

/**
 * Steps 3 and 4: submit a document and hand the case to the next role.
 *
 * The two steps differ only in which document they submit and who they hand to, so
 * they share one implementation driven by DOCUMENT_STEPS.
 *
 * Choosing the next assignee is the part that matters: candidates come from the
 * tenant's role assignments minus everyone who has already acted on the case, which is
 * what stops an applicant reviewing their own submission or an analyst approving their
 * own review.
 */
export async function submitDocumentStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { tenantId, userId, processInstanceId, step, content }: SubmitDocumentStepInput
): Promise<{ processInstanceId: number; nextStep: number; assignedTo: string }> {
  const shape = DOCUMENT_STEPS[step];
  if (!shape) {
    throw new Error(`Step ${step} is not a document step`);
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

  const { data: documents } = await supabase
    .from('document')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('parent_process_id', processInstanceId);

  const document = ((documents || []) as Array<Record<string, unknown>>).find((d) => {
    const meta = (d.other as DocumentWorkflowMeta) || {};
    return meta.document_role === shape.documentRole;
  });

  if (document) {
    const docMeta = (document.other as DocumentWorkflowMeta) || {};
    // When HedgeDoc is the editor, the note is the source of truth and the stored
    // markdown is synced separately; otherwise the editor's content is authoritative.
    const markdown = isHedgeDocConfigured() ? docMeta.markdown_content : content;

    await supabase
      .from('document')
      .update({
        status: 'submitted',
        other: { ...docMeta, markdown_content: markdown, last_edited_by_user_id: userId },
      })
      .eq('id', document.id)
      .eq('tenant_id', tenantId);
  }

  const element = await findDecisionElementForStep(supabase, tenantId, step, 'id');
  await supabase.from('process_decision_payload').insert({
    tenant_id: tenantId,
    process_decision_element: element?.id ?? null,
    process: processInstanceId,
    project: project.id,
    result: 'completed',
    result_bool: true,
    evaluation_data: { document_id: document?.id ?? null, submitted_at: new Date().toISOString() },
  });

  const task = await openTaskForStep(supabase, tenantId, processInstanceId, step);
  if (task) {
    const taskMeta = (task.other as CaseEventWorkflowMeta) || {};
    await supabase
      .from('case_event')
      .update({
        status: 'completed',
        outcome: 'completed',
        other: { ...taskMeta, completed_by: userId, completed_at: new Date().toISOString() },
      })
      .eq('id', task.id)
      .eq('tenant_id', tenantId);
  }

  const processMeta: ProcessInstanceWorkflowMeta = {
    ...((processInstance.other as ProcessInstanceWorkflowMeta) || {}),
    current_step: shape.nextStep,
    workflow_status: shape.nextWorkflowStatus,
  };

  await supabase
    .from('process_instance')
    .update({
      stage: shape.nextStage,
      other: processMeta as unknown as Record<string, unknown>,
    })
    .eq('id', processInstanceId)
    .eq('tenant_id', tenantId);

  // Anyone who has already acted on this case is ineligible for the next step.
  const excluded = [projectMeta.applicant_user_id, projectMeta.analyst_user_id].filter(
    (id): id is string => Boolean(id)
  );

  let assignee = projectMeta[shape.assigneeKey] || '';
  if (!assignee) {
    const { data: candidates } = await supabase
      .from('user_assignments')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_role', shape.nextRole);

    assignee =
      ((candidates || []) as Array<{ user_id: string | null }>)
        .map((c) => c.user_id)
        .find((id): id is string => Boolean(id) && !excluded.includes(id as string)) || '';

    if (assignee) {
      await supabase
        .from('project')
        .update({ other: { ...projectMeta, [shape.assigneeKey]: assignee } })
        .eq('id', project.id)
        .eq('tenant_id', tenantId);
    }
  }

  const nextElement = await findDecisionElementForStep(supabase, tenantId, shape.nextStep, 'id');
  await supabase.from('case_event').insert({
    tenant_id: tenantId,
    parent_process_id: processInstanceId,
    name: shape.nextTaskName,
    description: shape.nextTaskDescription(project.title || ''),
    type: 'task',
    tier: shape.nextStep,
    status: 'pending',
    assigned_entity: assignee,
    other: {
      step_number: shape.nextStep,
      decision_element_id: nextElement?.id ?? null,
      assigned_user_id: assignee,
      assigned_role_id: shape.nextRole,
      task_type: shape.nextTaskType,
    } as unknown as Record<string, unknown>,
  });

  // Step 3 also seeds the analysis document the analyst will write into.
  if (step === 3) {
    const analysisMeta: DocumentWorkflowMeta = {
      document_role: 'analysis',
      created_by_user_id: assignee,
      markdown_content: analysisContent(project.title || ''),
    };

    await supabase.from('document').insert({
      tenant_id: tenantId,
      parent_process_id: processInstanceId,
      title: 'Environmental Analysis',
      document_type: 'analysis',
      status: 'draft',
      related_document_id: document?.id ?? null,
      prepared_by: assignee,
      other: analysisMeta as unknown as Record<string, unknown>,
    });
  }

  if (assignee) {
    await supabase.from('case_event').insert({
      tenant_id: tenantId,
      parent_process_id: processInstanceId,
      name: shape.notificationName,
      description: shape.notificationDescription(project.title || ''),
      type: 'notification',
      status: 'pending',
      assigned_entity: assignee,
      other: {
        notification_type: shape.notificationType,
        project_id: project.id,
        read: false,
      },
    });
  }

  return { processInstanceId, nextStep: shape.nextStep, assignedTo: assignee };
}
