import { SupabaseClient } from '@supabase/supabase-js';
import { findDecisionElementForStep } from '@/lib/workflow/decision-element';
import { createNote, isHedgeDocConfigured } from '@/lib/hedgedoc/client';
import type {
  Project,
  CaseEvent,
  CaseEventWorkflowMeta,
  ProcessInstanceWorkflowMeta,
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
