'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTenantIdClient } from '@/lib/tenant/client';
import type { Project, ProcessInstance, DecisionElement, CaseEvent, Document, CaseEventWorkflowMeta, ProcessInstanceWorkflowMeta, DocumentWorkflowMeta, ProjectWorkflowMeta } from '@/lib/types/database';

interface Step5ApprovalProps {
  processInstance: ProcessInstance;
  project: Project;
  decisionElement: DecisionElement | null;
  currentStep: number;
  userId: string;
  tenantId: string;
  task: CaseEvent | null;
  documents: Document[];
}

export default function Step5Approval({
  processInstance,
  project,
  decisionElement,
  currentStep,
  userId,
  tenantId,
  task,
  documents,
}: Step5ApprovalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [analysisDoc, setAnalysisDoc] = useState<Document | null>(null);
  const [draftDoc, setDraftDoc] = useState<Document | null>(null);

  // Find documents
  useEffect(() => {
    const analysis = documents.find(d => {
      const meta = d.other as DocumentWorkflowMeta;
      return meta?.document_role === 'analysis';
    });

    const draft = documents.find(d => {
      const meta = d.other as DocumentWorkflowMeta;
      return meta?.document_role === 'draft';
    });

    setAnalysisDoc(analysis || null);
    setDraftDoc(draft || null);
  }, [documents]);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const effectiveTenantId = tenantId || await getTenantIdClient();
      const taskMeta = (task?.other as CaseEventWorkflowMeta) || {};
      const projectMeta = (project.other as ProjectWorkflowMeta) || {};

      // 1. Mark approval task as completed
      if (task) {
        await supabase
          .from('case_event')
          .update({
            status: 'completed',
            outcome: 'approved',
            other: {
              ...taskMeta,
              completed_by: userId,
              completed_at: new Date().toISOString(),
              approval_decision: 'approved',
              approval_comments: comments,
            },
          })
          .eq('id', task.id)
          .eq('tenant_id', effectiveTenantId);
      }

      // 2. Create decision payload
      await supabase.from('process_decision_payload').insert({
        tenant_id: effectiveTenantId,
        process_decision_element: 5,
        process: processInstance.id,
        project: project.id,
        result: 'approved',
        result_bool: true,
        result_notes: comments,
        evaluation_data: {
          approver_id: userId,
          approved_at: new Date().toISOString(),
        },
      });

      // 3. Update process instance to completed/approved
      const processMeta: ProcessInstanceWorkflowMeta = {
        ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
        current_step: 6, // Beyond 5 = completed
        workflow_status: 'approved',
      };

      await supabase
        .from('process_instance')
        .update({
          status: 'completed',
          stage: 'Approved',
          outcome: 'approved',
          complete_date: new Date().toISOString().split('T')[0],
          other: processMeta as unknown as Record<string, unknown>,
        })
        .eq('id', processInstance.id)
        .eq('tenant_id', effectiveTenantId);

      // 4. Update project status
      await supabase
        .from('project')
        .update({
          current_status: 'approved',
        })
        .eq('id', project.id)
        .eq('tenant_id', effectiveTenantId);

      // 5. Notify analyst of approval
      const analystId = projectMeta.analyst_user_id;
      if (analystId) {
        await supabase.from('case_event').insert({
          tenant_id: effectiveTenantId,
          parent_process_id: processInstance.id,
          name: 'Case Approved',
          description: `Your environmental analysis for "${project.title}" has been approved!${comments ? ` Comment: ${comments}` : ''}`,
          type: 'notification',
          status: 'pending',
          assigned_entity: analystId,
          other: {
            notification_type: 'approved',
            project_id: project.id,
            read: false,
          },
        });
      }

      // Navigate to case detail
      router.push(`/case/${processInstance.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
      setLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!comments.trim()) {
      setError('Please provide feedback on what changes are needed');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const effectiveTenantId = tenantId || await getTenantIdClient();
      const taskMeta = (task?.other as CaseEventWorkflowMeta) || {};
      const projectMeta = (project.other as ProjectWorkflowMeta) || {};

      // 1. Mark approval task as completed with changes requested
      if (task) {
        await supabase
          .from('case_event')
          .update({
            status: 'completed',
            outcome: 'changes_requested',
            other: {
              ...taskMeta,
              completed_by: userId,
              completed_at: new Date().toISOString(),
              approval_decision: 'changes_requested',
              approval_comments: comments,
            },
          })
          .eq('id', task.id)
          .eq('tenant_id', effectiveTenantId);
      }

      // 2. Create decision payload
      await supabase.from('process_decision_payload').insert({
        tenant_id: effectiveTenantId,
        process_decision_element: 5,
        process: processInstance.id,
        project: project.id,
        result: 'changes_requested',
        result_bool: false,
        result_notes: comments,
        evaluation_data: {
          approver_id: userId,
          decision_at: new Date().toISOString(),
        },
      });

      // 3. Update process instance back to step 4
      const processMeta: ProcessInstanceWorkflowMeta = {
        ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
        current_step: 4,
        workflow_status: 'in_progress',
      };

      await supabase
        .from('process_instance')
        .update({
          stage: 'Step 4: Analyst Review (Revision)',
          other: processMeta as unknown as Record<string, unknown>,
        })
        .eq('id', processInstance.id)
        .eq('tenant_id', effectiveTenantId);

      // 4. Create new task for analyst with revision request
      const analystId = projectMeta.analyst_user_id || '';
      const newTaskMeta: CaseEventWorkflowMeta = {
        step_number: 4,
        decision_element_id: 4,
        assigned_user_id: analystId,
        assigned_role_id: 2,
        task_type: 'document',
        revision_requested: true,
        revision_comments: comments,
        revision_requested_by: userId,
      } as CaseEventWorkflowMeta & { revision_requested: boolean; revision_comments: string; revision_requested_by: string };

      await supabase.from('case_event').insert({
        tenant_id: effectiveTenantId,
        parent_process_id: processInstance.id,
        name: 'Revise Environmental Review',
        description: `Revisions requested: ${comments}`,
        type: 'task',
        tier: 4,
        status: 'pending',
        assigned_entity: analystId,
        other: newTaskMeta as unknown as Record<string, unknown>,
      });

      // 5. Notify analyst of revision request
      if (analystId) {
        await supabase.from('case_event').insert({
          tenant_id: effectiveTenantId,
          parent_process_id: processInstance.id,
          name: 'Revisions Requested',
          description: `Your environmental analysis for "${project.title}" requires revisions: ${comments}`,
          type: 'notification',
          status: 'pending',
          assigned_entity: analystId,
          other: {
            notification_type: 'revision_requested',
            project_id: project.id,
            read: false,
          },
        });
      }

      // Navigate to case detail
      router.push(`/case/${processInstance.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request changes');
      setLoading(false);
    }
  };

  const isCurrentStep = currentStep === 5;
  const isCompleted = currentStep > 5 || processInstance.status === 'completed';
  const analysisMeta = analysisDoc?.other as DocumentWorkflowMeta;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>Step 5 of 5</span>
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Approval</h1>
          <p className="text-gray-600 mt-1">
            {decisionElement?.description || 'Review the environmental analysis and make an approval decision'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {isCompleted ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-900">Case Approved</p>
            <p className="mt-2 text-gray-600">This case has been approved and is now complete.</p>
            <button
              onClick={() => router.push(`/case/${processInstance.id}`)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              View Case
            </button>
          </div>
        ) : (
          <>
            {/* Analysis document preview */}
            {analysisDoc && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Environmental Analysis</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                    {analysisMeta?.markdown_content || 'No content available'}
                  </pre>
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments (optional for approval, required for changes)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                disabled={!isCurrentStep}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Add any comments or feedback..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => router.push(`/case/${processInstance.id}`)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Back to Case
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={handleRequestChanges}
                  disabled={loading || !isCurrentStep}
                  className="px-4 py-2 border border-yellow-500 text-yellow-700 rounded-md hover:bg-yellow-50 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Request Changes'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading || !isCurrentStep}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
