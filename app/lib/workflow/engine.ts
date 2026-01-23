/**
 * Workflow Engine
 *
 * Implements the 5-step permit workflow:
 * 1. Authentication (handled by Supabase Auth)
 * 2. Project Information Form (RJSF)
 * 3. Applicant Document (HedgeDoc/internal)
 * 4. Analyst Review Document (HedgeDoc/internal)
 * 5. Approval Gate
 *
 * Pattern reference: Review Works initialization flow
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Project,
  ProcessInstance,
  CaseEvent,
  Document,
  CaseEventWorkflowMeta,
  ProcessInstanceWorkflowMeta,
  ProjectWorkflowMeta,
  DocumentWorkflowMeta,
} from '@/lib/types/database';

const DEFAULT_PROCESS_MODEL_ID = 1;

interface InitializeCaseResult {
  project: Project;
  processInstance: ProcessInstance;
  initialTask: CaseEvent;
}

interface WorkflowError {
  code: string;
  message: string;
}

/**
 * Initialize a new case with project, process instance, and first task
 * Pattern: Creates all related records in a transaction-like sequence
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeCase(
  supabase: SupabaseClient<any>,
  userId: string,
  processModelId: number = DEFAULT_PROCESS_MODEL_ID
): Promise<InitializeCaseResult> {
  // 1. Create the project with applicant reference
  const projectMeta: ProjectWorkflowMeta = {
    applicant_user_id: userId,
  };

  const { data: project, error: projectError } = await supabase
    .from('project')
    .insert({
      title: 'New Project',
      current_status: 'draft',
      other: projectMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (projectError || !project) {
    throw new Error(`Failed to create project: ${projectError?.message}`);
  }

  // 2. Create the process instance
  const processMeta: ProcessInstanceWorkflowMeta = {
    current_step: 2, // Start at step 2 (project info) since auth is step 1 and already done
    workflow_status: 'draft',
  };

  const { data: processInstance, error: processError } = await supabase
    .from('process_instance')
    .insert({
      parent_project_id: project.id,
      process_model: processModelId,
      status: 'underway',
      stage: 'Step 2: Project Information',
      start_date: new Date().toISOString().split('T')[0],
      other: processMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (processError || !processInstance) {
    throw new Error(`Failed to create process instance: ${processError?.message}`);
  }

  // 3. Create initial task for step 2 (Project Information)
  const taskMeta: CaseEventWorkflowMeta = {
    step_number: 2,
    decision_element_id: 2,
    assigned_user_id: userId,
    assigned_role_id: 1, // Applicant role
    task_type: 'form',
  };

  const { data: initialTask, error: taskError } = await supabase
    .from('case_event')
    .insert({
      parent_process_id: processInstance.id,
      name: 'Complete Project Information',
      description: 'Fill out the project information form to proceed',
      type: 'task',
      tier: 2,
      status: 'pending',
      assigned_entity: userId,
      other: taskMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (taskError || !initialTask) {
    throw new Error(`Failed to create initial task: ${taskError?.message}`);
  }

  // 4. Create initial decision payload placeholder for step 1 (auth completed)
  await supabase.from('process_decision_payload').insert({
    process_decision_element: 1,
    process: processInstance.id,
    project: project.id,
    result: 'completed',
    result_bool: true,
    evaluation_data: { user_id: userId, authenticated_at: new Date().toISOString() },
  });

  return { project, processInstance, initialTask };
}

/**
 * Complete a task and advance to the next step
 */
export async function completeTask(
  supabase: SupabaseClient<any>,
  taskId: number,
  userId: string,
  payload?: Record<string, unknown>
): Promise<{ nextTask?: CaseEvent; processInstance: ProcessInstance }> {
  // Get the current task with process instance
  const { data: task, error: taskError } = await supabase
    .from('case_event')
    .select('*, process_instance:parent_process_id(*)')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    throw new Error(`Task not found: ${taskError?.message}`);
  }

  const taskMeta = (task.other as CaseEventWorkflowMeta) || {};
  const currentStep = taskMeta.step_number || 2;
  const processInstance = task.process_instance as unknown as ProcessInstance;

  // Mark task as completed
  const completedMeta: CaseEventWorkflowMeta = {
    ...taskMeta,
    completed_by: userId,
    completed_at: new Date().toISOString(),
  };

  await supabase
    .from('case_event')
    .update({
      status: 'completed',
      outcome: 'completed',
      other: completedMeta as unknown as Record<string, unknown>,
    })
    .eq('id', taskId);

  // Create decision payload for this step if payload provided
  if (payload) {
    await supabase.from('process_decision_payload').insert({
      process_decision_element: taskMeta.decision_element_id,
      process: processInstance.id,
      project: processInstance.parent_project_id,
      result: 'completed',
      result_bool: true,
      evaluation_data: payload,
    });
  }

  // Advance to next step
  const nextStep = currentStep + 1;
  const { nextTask, updatedProcess } = await advanceToStep(
    supabase,
    processInstance.id,
    nextStep,
    userId
  );

  return { nextTask, processInstance: updatedProcess };
}

/**
 * Advance a process instance to a specific step
 */
export async function advanceToStep(
  supabase: SupabaseClient<any>,
  processInstanceId: number,
  stepNumber: number,
  initiatingUserId: string
): Promise<{ nextTask?: CaseEvent; updatedProcess: ProcessInstance }> {
  // Get process instance with project
  const { data: processInstance, error: processError } = await supabase
    .from('process_instance')
    .select('*, project:parent_project_id(*)')
    .eq('id', processInstanceId)
    .single();

  if (processError || !processInstance) {
    throw new Error(`Process instance not found: ${processError?.message}`);
  }

  const project = processInstance.project as unknown as Project;
  const projectMeta = (project?.other as ProjectWorkflowMeta) || {};

  // Get decision element for the step
  const { data: decisionElement } = await supabase
    .from('decision_element')
    .select('*')
    .eq('id', stepNumber)
    .single();

  if (!decisionElement) {
    // Process is complete
    await supabase
      .from('process_instance')
      .update({
        status: 'completed',
        stage: 'Completed',
        complete_date: new Date().toISOString().split('T')[0],
        other: {
          ...(processInstance.other as Record<string, unknown> || {}),
          current_step: stepNumber,
          workflow_status: 'approved',
        },
      })
      .eq('id', processInstanceId);

    const { data: updatedProcess } = await supabase
      .from('process_instance')
      .select('*')
      .eq('id', processInstanceId)
      .single();

    return { updatedProcess: updatedProcess! };
  }

  // Determine assigned user based on role
  let assignedUserId = initiatingUserId;
  const roleId = decisionElement.responsible_role;

  if (roleId === 2) {
    // Analyst - use assigned analyst or find one
    assignedUserId = projectMeta.analyst_user_id || await findUserWithRole(supabase, 2);
  } else if (roleId === 3) {
    // Approver - use assigned approver or find one
    assignedUserId = projectMeta.approver_user_id || await findUserWithRole(supabase, 3);
  }

  // Update process instance stage
  const stepNames: Record<number, string> = {
    2: 'Step 2: Project Information',
    3: 'Step 3: Applicant Document',
    4: 'Step 4: Analyst Review',
    5: 'Step 5: Approval',
  };

  const processMeta: ProcessInstanceWorkflowMeta = {
    ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
    current_step: stepNumber,
    workflow_status: stepNumber === 5 ? 'pending_approval' : 'in_progress',
  };

  await supabase
    .from('process_instance')
    .update({
      stage: stepNames[stepNumber] || `Step ${stepNumber}`,
      other: processMeta as unknown as Record<string, unknown>,
    })
    .eq('id', processInstanceId);

  // Create task for the new step
  const taskType = getTaskType(stepNumber);
  const taskMeta: CaseEventWorkflowMeta = {
    step_number: stepNumber,
    decision_element_id: stepNumber,
    assigned_user_id: assignedUserId,
    assigned_role_id: roleId || 1,
    task_type: taskType,
  };

  const { data: nextTask, error: taskError } = await supabase
    .from('case_event')
    .insert({
      parent_process_id: processInstanceId,
      name: decisionElement.title || `Step ${stepNumber}`,
      description: decisionElement.description,
      type: 'task',
      tier: stepNumber,
      status: 'pending',
      assigned_entity: assignedUserId,
      other: taskMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (taskError) {
    throw new Error(`Failed to create task: ${taskError.message}`);
  }

  // For document steps, create the document record
  if (taskType === 'document') {
    await createDocumentForStep(supabase, processInstanceId, stepNumber, assignedUserId);
  }

  const { data: updatedProcess } = await supabase
    .from('process_instance')
    .select('*')
    .eq('id', processInstanceId)
    .single();

  return { nextTask: nextTask!, updatedProcess: updatedProcess! };
}

/**
 * Handle approval decision - approve or request changes
 */
export async function handleApproval(
  supabase: SupabaseClient<any>,
  taskId: number,
  approverId: string,
  approved: boolean,
  comments?: string
): Promise<{ processInstance: ProcessInstance; nextTask?: CaseEvent }> {
  const { data: task, error: taskError } = await supabase
    .from('case_event')
    .select('*, process_instance:parent_process_id(*, project:parent_project_id(*))')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    throw new Error(`Task not found: ${taskError?.message}`);
  }

  const processInstance = task.process_instance as unknown as ProcessInstance;
  const project = (task.process_instance as unknown as { project: Project }).project;
  const projectMeta = (project?.other as ProjectWorkflowMeta) || {};

  // Mark approval task as completed
  const taskMeta = (task.other as CaseEventWorkflowMeta) || {};
  await supabase
    .from('case_event')
    .update({
      status: 'completed',
      outcome: approved ? 'approved' : 'changes_requested',
      other: {
        ...taskMeta,
        completed_by: approverId,
        completed_at: new Date().toISOString(),
        approval_comments: comments,
      },
    })
    .eq('id', taskId);

  // Create decision payload
  await supabase.from('process_decision_payload').insert({
    process_decision_element: 5,
    process: processInstance.id,
    project: processInstance.parent_project_id,
    result: approved ? 'approved' : 'changes_requested',
    result_bool: approved,
    result_notes: comments,
    evaluation_data: { approver_id: approverId, decision_at: new Date().toISOString() },
  });

  if (approved) {
    // Complete the process
    await supabase
      .from('process_instance')
      .update({
        status: 'completed',
        stage: 'Approved',
        outcome: 'approved',
        complete_date: new Date().toISOString().split('T')[0],
        other: {
          ...(processInstance.other as Record<string, unknown> || {}),
          workflow_status: 'approved',
        },
      })
      .eq('id', processInstance.id);

    // Notify analyst of approval
    const analystId = projectMeta.analyst_user_id;
    if (analystId) {
      await createNotification(supabase, analystId, processInstance.id, project.id, {
        type: 'approval',
        title: 'Case Approved',
        message: `Your analysis for "${project.title}" has been approved.${comments ? ` Comment: ${comments}` : ''}`,
      });
    }

    const { data: updatedProcess } = await supabase
      .from('process_instance')
      .select('*')
      .eq('id', processInstance.id)
      .single();

    return { processInstance: updatedProcess! };
  } else {
    // Send back to step 4 (analyst review)
    const { nextTask, updatedProcess } = await advanceToStep(
      supabase,
      processInstance.id,
      4,
      approverId
    );

    // Update the new task with revision context
    if (nextTask) {
      await supabase
        .from('case_event')
        .update({
          description: `Revisions requested: ${comments || 'Please review and update the analysis.'}`,
          other: {
            ...(nextTask.other as Record<string, unknown> || {}),
            revision_requested: true,
            revision_comments: comments,
            revision_requested_by: approverId,
          },
        })
        .eq('id', nextTask.id);

      // Notify analyst of revision request
      const analystId = projectMeta.analyst_user_id;
      if (analystId) {
        await createNotification(supabase, analystId, processInstance.id, project.id, {
          type: 'revision_requested',
          title: 'Revisions Requested',
          message: `Revisions requested for "${project.title}": ${comments || 'Please review your analysis.'}`,
        });
      }
    }

    return { processInstance: updatedProcess, nextTask };
  }
}

// Helper functions

function getTaskType(stepNumber: number): 'form' | 'document' | 'approval' {
  switch (stepNumber) {
    case 2:
      return 'form';
    case 3:
    case 4:
      return 'document';
    case 5:
      return 'approval';
    default:
      return 'form';
  }
}

async function findUserWithRole(
  supabase: SupabaseClient<any>,
  roleId: number
): Promise<string> {
  const { data } = await supabase
    .from('user_assignments')
    .select('user_id')
    .eq('user_role', roleId)
    .limit(1)
    .single();

  return data?.user_id || '';
}

async function createDocumentForStep(
  supabase: SupabaseClient<any>,
  processInstanceId: number,
  stepNumber: number,
  userId: string
): Promise<Document> {
  const docMeta: DocumentWorkflowMeta = {
    document_role: stepNumber === 3 ? 'draft' : 'analysis',
    created_by_user_id: userId,
    markdown_content: getInitialDocumentContent(stepNumber),
  };

  const { data: doc, error } = await supabase
    .from('document')
    .insert({
      parent_process_id: processInstanceId,
      title: stepNumber === 3 ? 'Applicant Draft Document' : 'Environmental Analysis',
      document_type: stepNumber === 3 ? 'draft' : 'analysis',
      status: 'draft',
      prepared_by: userId,
      other: docMeta as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return doc!;
}

function getInitialDocumentContent(stepNumber: number): string {
  if (stepNumber === 3) {
    return `# Project Analysis Document

## Executive Summary
[Provide a brief overview of the project]

## Project Description
[Describe the project in detail]

## Environmental Considerations
[List any environmental factors to consider]

## Supporting Documentation
[Reference any supporting documents]
`;
  } else {
    return `# Environmental Review Analysis

## Review Summary
[Summarize the environmental review findings]

## Compliance Assessment
[Assess compliance with applicable regulations]

## Recommendations
[Provide recommendations]

## Conclusion
[State the conclusion of the analysis]
`;
  }
}

interface NotificationData {
  type: string;
  title: string;
  message: string;
}

async function createNotification(
  supabase: SupabaseClient<any>,
  userId: string,
  processInstanceId: number,
  projectId: number,
  data: NotificationData
): Promise<void> {
  // Store notification in case_event as a notification type
  await supabase.from('case_event').insert({
    parent_process_id: processInstanceId,
    name: data.title,
    description: data.message,
    type: 'notification',
    status: 'pending',
    assigned_entity: userId,
    other: {
      notification_type: data.type,
      project_id: projectId,
      read: false,
    },
  });
}

/**
 * Get user's role IDs
 */
export async function getUserRoles(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<number[]> {
  const { data: assignments } = await supabase
    .from('user_assignments')
    .select('user_role')
    .eq('user_id', userId);

  return assignments?.map(a => a.user_role).filter((r): r is number => r !== null) || [];
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(
  supabase: SupabaseClient<any>,
  userId: string,
  roleId: number
): Promise<boolean> {
  const roles = await getUserRoles(supabase, userId);
  return roles.includes(roleId);
}

/**
 * Check if user can access a specific step
 * Returns true if user has the required role for the step
 */
export async function canUserAccessStep(
  supabase: SupabaseClient<any>,
  userId: string,
  stepNumber: number,
  processInstanceId: number
): Promise<{ canAccess: boolean; requiredRole: number | null; userRoles: number[] }> {
  // Get the decision element for this step to find required role
  const { data: decisionElement } = await supabase
    .from('decision_element')
    .select('responsible_role')
    .eq('id', stepNumber)
    .single();

  const requiredRole = decisionElement?.responsible_role || null;
  const userRoles = await getUserRoles(supabase, userId);

  // If no required role is set, anyone can access
  if (!requiredRole) {
    return { canAccess: true, requiredRole: null, userRoles };
  }

  // Check if user has the required role
  const canAccess = userRoles.includes(requiredRole);

  // Also check if user is assigned to this specific task (for cases where task is assigned to specific user)
  if (!canAccess) {
    const { data: task } = await supabase
      .from('case_event')
      .select('assigned_entity, other')
      .eq('parent_process_id', processInstanceId)
      .eq('tier', stepNumber)
      .eq('type', 'task')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (task?.assigned_entity === userId) {
      return { canAccess: true, requiredRole, userRoles };
    }
  }

  return { canAccess, requiredRole, userRoles };
}

/**
 * Get role name by ID
 */
export function getRoleName(roleId: number): string {
  const roleNames: Record<number, string> = {
    1: 'Applicant',
    2: 'Analyst',
    3: 'Approver',
  };
  return roleNames[roleId] || `Role ${roleId}`;
}

/**
 * Get user's tasks
 */
export async function getUserTasks(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<CaseEvent[]> {
  // Get user's role assignments
  const { data: assignments } = await supabase
    .from('user_assignments')
    .select('user_role')
    .eq('user_id', userId);

  const roleIds = assignments?.map(a => a.user_role) || [];

  // Get tasks assigned directly to user or to their roles
  const { data: tasks, error } = await supabase
    .from('case_event')
    .select(`
      *,
      process_instance:parent_process_id(
        *,
        project:parent_project_id(*)
      )
    `)
    .eq('type', 'task')
    .or(`assigned_entity.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  // Filter to include tasks assigned to user's roles
  return (tasks || []).filter(task => {
    const meta = task.other as CaseEventWorkflowMeta;
    return (
      task.assigned_entity === userId ||
      (meta?.assigned_role_id && roleIds.includes(meta.assigned_role_id))
    );
  });
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<CaseEvent[]> {
  const { data, error } = await supabase
    .from('case_event')
    .select('*')
    .eq('type', 'notification')
    .eq('assigned_entity', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return data || [];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  supabase: SupabaseClient<any>,
  notificationId: number
): Promise<void> {
  const { data: notification } = await supabase
    .from('case_event')
    .select('other')
    .eq('id', notificationId)
    .single();

  await supabase
    .from('case_event')
    .update({
      status: 'completed',
      other: {
        ...(notification?.other as Record<string, unknown> || {}),
        read: true,
        read_at: new Date().toISOString(),
      },
    })
    .eq('id', notificationId);
}
