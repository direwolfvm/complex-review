'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { Project, ProcessInstance, DecisionElement, CaseEvent, Document, CaseEventWorkflowMeta, ProcessInstanceWorkflowMeta, DocumentWorkflowMeta, ProjectWorkflowMeta } from '@/lib/types/database';

interface Step3DocumentProps {
  processInstance: ProcessInstance;
  project: Project;
  decisionElement: DecisionElement | null;
  currentStep: number;
  userId: string;
  task: CaseEvent | null;
  documents: Document[];
}

export default function Step3Document({
  processInstance,
  project,
  decisionElement,
  currentStep,
  userId,
  task,
  documents,
}: Step3DocumentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [document, setDocument] = useState<Document | null>(null);

  // Find draft document
  useEffect(() => {
    const draftDoc = documents.find(d => {
      const meta = d.other as DocumentWorkflowMeta;
      return meta?.document_role === 'draft';
    });

    if (draftDoc) {
      setDocument(draftDoc);
      const meta = draftDoc.other as DocumentWorkflowMeta;
      setContent(meta?.markdown_content || '');
    }
  }, [documents]);

  const handleSave = async () => {
    if (!document) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const docMeta = (document.other as DocumentWorkflowMeta) || {};

      await supabase
        .from('document')
        .update({
          other: {
            ...docMeta,
            markdown_content: content,
            last_edited_by_user_id: userId,
          },
        })
        .eq('id', document.id);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Save document content
      if (document) {
        const docMeta = (document.other as DocumentWorkflowMeta) || {};
        await supabase
          .from('document')
          .update({
            status: 'submitted',
            other: {
              ...docMeta,
              markdown_content: content,
              last_edited_by_user_id: userId,
            },
          })
          .eq('id', document.id);
      }

      // 2. Create decision payload
      await supabase.from('process_decision_payload').insert({
        process_decision_element: 3,
        process: processInstance.id,
        project: project.id,
        result: 'completed',
        result_bool: true,
        evaluation_data: { document_id: document?.id, submitted_at: new Date().toISOString() },
      });

      // 3. Mark current task as completed
      if (task) {
        const taskMeta = (task.other as CaseEventWorkflowMeta) || {};
        await supabase
          .from('case_event')
          .update({
            status: 'completed',
            outcome: 'completed',
            other: {
              ...taskMeta,
              completed_by: userId,
              completed_at: new Date().toISOString(),
            },
          })
          .eq('id', task.id);
      }

      // 4. Update process instance to step 4
      const processMeta: ProcessInstanceWorkflowMeta = {
        ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
        current_step: 4,
        workflow_status: 'in_progress',
      };

      await supabase
        .from('process_instance')
        .update({
          stage: 'Step 4: Analyst Review',
          other: processMeta as unknown as Record<string, unknown>,
        })
        .eq('id', processInstance.id);

      // 5. Find an analyst to assign (or leave unassigned)
      const projectMeta = (project.other as ProjectWorkflowMeta) || {};
      let analystId = projectMeta.analyst_user_id;

      if (!analystId) {
        const { data: analystAssignment } = await supabase
          .from('user_assignments')
          .select('user_id')
          .eq('user_role', 2) // Analyst role
          .limit(1)
          .single();

        analystId = analystAssignment?.user_id || '';

        // Update project with analyst
        if (analystId) {
          await supabase
            .from('project')
            .update({
              other: {
                ...projectMeta,
                analyst_user_id: analystId,
              },
            })
            .eq('id', project.id);
        }
      }

      // 6. Create task for step 4 (Analyst)
      const newTaskMeta: CaseEventWorkflowMeta = {
        step_number: 4,
        decision_element_id: 4,
        assigned_user_id: analystId || '',
        assigned_role_id: 2, // Analyst
        task_type: 'document',
      };

      await supabase.from('case_event').insert({
        parent_process_id: processInstance.id,
        name: 'Complete Environmental Review',
        description: 'Review the applicant document and produce the environmental analysis',
        type: 'task',
        tier: 4,
        status: 'pending',
        assigned_entity: analystId || '',
        other: newTaskMeta as unknown as Record<string, unknown>,
      });

      // 7. Create the analysis document
      const analysisDocMeta: DocumentWorkflowMeta = {
        document_role: 'analysis',
        created_by_user_id: analystId || '',
        markdown_content: `# Environmental Review Analysis

## Review Summary
[Summarize the environmental review findings for "${project.title}"]

## Applicant Submission Review
[Review of the applicant's submitted document]

## Compliance Assessment
[Assess compliance with applicable regulations]

## Recommendations
[Provide recommendations]

## Conclusion
[State the conclusion of the analysis]
`,
      };

      await supabase.from('document').insert({
        parent_process_id: processInstance.id,
        title: 'Environmental Analysis',
        document_type: 'analysis',
        status: 'draft',
        related_document_id: document?.id,
        prepared_by: analystId || '',
        other: analysisDocMeta as unknown as Record<string, unknown>,
      });

      // 8. Create notification for analyst
      if (analystId) {
        await supabase.from('case_event').insert({
          parent_process_id: processInstance.id,
          name: 'New Case Assigned',
          description: `You have been assigned to review "${project.title}"`,
          type: 'notification',
          status: 'pending',
          assigned_entity: analystId,
          other: {
            notification_type: 'assignment',
            project_id: project.id,
            read: false,
          },
        });
      }

      // Navigate to case detail
      router.push(`/case/${processInstance.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete step');
      setLoading(false);
    }
  };

  const isCurrentStep = currentStep === 3;
  const isCompleted = currentStep > 3;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>Step 3 of 5</span>
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Applicant Document</h1>
          <p className="text-gray-600 mt-1">
            {decisionElement?.description || 'Draft your project analysis document'}
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
            <p className="mt-4 text-gray-600">This step has been completed.</p>
            <button
              onClick={() => router.push(`/case/${processInstance.id}`)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              View Case
            </button>
          </div>
        ) : (
          <>
            {/* Editor */}
            <div className="mb-6">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                disabled={!isCurrentStep}
                placeholder="Write your project analysis document..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={handleSave}
                disabled={saving || !isCurrentStep}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={() => router.push(`/case/${processInstance.id}`)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Back to Case
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading || !isCurrentStep || !content.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit and Continue'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
