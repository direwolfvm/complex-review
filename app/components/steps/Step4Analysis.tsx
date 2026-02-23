'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTenantIdClient } from '@/lib/tenant/client';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { Project, ProcessInstance, DecisionElement, CaseEvent, Document, CaseEventWorkflowMeta, ProcessInstanceWorkflowMeta, DocumentWorkflowMeta, ProjectWorkflowMeta } from '@/lib/types/database';

interface Step4AnalysisProps {
  processInstance: ProcessInstance;
  project: Project;
  decisionElement: DecisionElement | null;
  currentStep: number;
  userId: string;
  tenantId: string;
  task: CaseEvent | null;
  documents: Document[];
  hedgedocBaseUrl?: string | null;
}

export default function Step4Analysis({
  processInstance,
  project,
  decisionElement,
  currentStep,
  userId,
  tenantId,
  task,
  documents,
  hedgedocBaseUrl = null,
}: Step4AnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [analysisDoc, setAnalysisDoc] = useState<Document | null>(null);
  const [draftDoc, setDraftDoc] = useState<Document | null>(null);
  const [showDraft, setShowDraft] = useState(true);
  const [analysisHedgeDocId, setAnalysisHedgeDocId] = useState<string | null>(null);
  const [draftHedgeDocId, setDraftHedgeDocId] = useState<string | null>(null);
  const hedgedocOrigin = hedgedocBaseUrl?.replace(/\/$/, '') || null;

  // Check for revision request
  const taskMeta = (task?.other as CaseEventWorkflowMeta) || {};
  const isRevision = taskMeta.revision_requested;
  const revisionComments = taskMeta.revision_comments;

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

    if (analysis) {
      setAnalysisDoc(analysis);
      const meta = analysis.other as DocumentWorkflowMeta;
      setContent(meta?.markdown_content || '');
      setAnalysisHedgeDocId(meta?.hedgedoc_note_id || null);
    }

    if (draft) {
      setDraftDoc(draft);
      const meta = draft.other as DocumentWorkflowMeta;
      setDraftHedgeDocId(meta?.hedgedoc_note_id || null);
    }
  }, [documents]);

  const ensureHedgeDocNote = async (doc: Document, defaultTitle: string): Promise<{ noteId: string; url: string } | null> => {
    if (!hedgedocBaseUrl) return null;

    const meta = (doc.other as DocumentWorkflowMeta) || {};
    if (meta.hedgedoc_note_id && meta.hedgedoc_url) {
      return { noteId: meta.hedgedoc_note_id, url: meta.hedgedoc_url };
    }

    const response = await fetch('/api/hedgedoc/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: doc.title || defaultTitle,
        initialContent: meta.markdown_content || '',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create HedgeDoc note');
    }

    const data = (await response.json()) as { noteId: string; url: string };

    const effectiveTenantId = tenantId || await getTenantIdClient();

    await createClient()
      .from('document')
      .update({
        other: {
          ...meta,
          hedgedoc_note_id: data.noteId,
          hedgedoc_url: data.url,
        },
      })
      .eq('id', doc.id)
      .eq('tenant_id', effectiveTenantId);

    return data;
  };

  useEffect(() => {
    if (!hedgedocBaseUrl) return;

    let cancelled = false;

    (async () => {
      try {
        if (analysisDoc) {
          const analysisResult = await ensureHedgeDocNote(analysisDoc, 'Environmental Analysis');
          if (!cancelled && analysisResult) {
            setAnalysisHedgeDocId(analysisResult.noteId);
          }
        }

        if (draftDoc) {
          const draftResult = await ensureHedgeDocNote(draftDoc, 'Applicant Draft Document');
          if (!cancelled && draftResult) {
            setDraftHedgeDocId(draftResult.noteId);
          }
        }
      } catch (err) {
        // In anonymous HedgeDoc mode, note pre-creation can fail.
        // Fall back to `/new` embed for editor and markdown fallback for draft preview.
        console.warn('HedgeDoc pre-create failed, falling back to /new', err);
        if (!cancelled) {
          setAnalysisHedgeDocId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hedgedocBaseUrl, analysisDoc, draftDoc]);

  const handleSave = async () => {
    if (!analysisDoc) return;
    if (hedgedocBaseUrl) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const effectiveTenantId = tenantId || await getTenantIdClient();
      const docMeta = (analysisDoc.other as DocumentWorkflowMeta) || {};

      await supabase
        .from('document')
        .update({
          other: {
            ...docMeta,
            markdown_content: content,
            last_edited_by_user_id: userId,
          },
        })
        .eq('id', analysisDoc.id)
        .eq('tenant_id', effectiveTenantId);

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
      const effectiveTenantId = tenantId || await getTenantIdClient();

      // Ensure HedgeDoc notes exist when embedded editor is enabled
      if (hedgedocBaseUrl) {
        if (analysisDoc) {
          const result = await ensureHedgeDocNote(analysisDoc, 'Environmental Analysis');
          if (result) setAnalysisHedgeDocId(result.noteId);
        }
        if (draftDoc) {
          const result = await ensureHedgeDocNote(draftDoc, 'Applicant Draft Document');
          if (result) setDraftHedgeDocId(result.noteId);
        }
      }

      // 1. Save document content
      if (analysisDoc) {
        const docMeta = (analysisDoc.other as DocumentWorkflowMeta) || {};
        await supabase
          .from('document')
          .update({
            status: 'submitted',
            other: {
              ...docMeta,
              markdown_content: hedgedocBaseUrl ? docMeta.markdown_content : content,
              last_edited_by_user_id: userId,
            },
          })
          .eq('id', analysisDoc.id)
          .eq('tenant_id', effectiveTenantId);
      }

      // 2. Create decision payload
      await supabase.from('process_decision_payload').insert({
        tenant_id: effectiveTenantId,
        process_decision_element: 4,
        process: processInstance.id,
        project: project.id,
        result: 'completed',
        result_bool: true,
        evaluation_data: {
          document_id: analysisDoc?.id,
          submitted_at: new Date().toISOString(),
          is_revision: isRevision,
        },
      });

      // 3. Mark current task as completed
      if (task) {
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
          .eq('id', task.id)
          .eq('tenant_id', effectiveTenantId);
      }

      // 4. Update process instance to step 5
      const processMeta: ProcessInstanceWorkflowMeta = {
        ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
        current_step: 5,
        workflow_status: 'pending_approval',
      };

      await supabase
        .from('process_instance')
        .update({
          stage: 'Step 5: Approval',
          other: processMeta as unknown as Record<string, unknown>,
        })
        .eq('id', processInstance.id)
        .eq('tenant_id', effectiveTenantId);

      // 5. Find an approver to assign (exclude applicant and analyst - can't approve your own work)
      const projectMeta = (project.other as ProjectWorkflowMeta) || {};
      const applicantId = projectMeta.applicant_user_id;
      const analystId = projectMeta.analyst_user_id;
      let approverId = projectMeta.approver_user_id;

      if (!approverId) {
        // Find an approver who is NOT the applicant or analyst
        const { data: approverAssignments } = await supabase
          .from('user_assignments')
            .select('user_id')
            .eq('tenant_id', effectiveTenantId)
            .eq('user_role', 3); // Approver role

        // Filter out the applicant and analyst
        const availableApprovers = (approverAssignments || []).filter(
          (a: { user_id: string | null }) => a.user_id !== applicantId && a.user_id !== analystId
        );

        approverId = availableApprovers[0]?.user_id || '';

        // Update project with approver
        if (approverId) {
          await supabase
            .from('project')
              .update({
              other: {
                ...projectMeta,
                approver_user_id: approverId,
              },
              })
              .eq('id', project.id)
              .eq('tenant_id', effectiveTenantId);
        }
      }

      // 6. Create task for step 5 (Approver)
      const newTaskMeta: CaseEventWorkflowMeta = {
        step_number: 5,
        decision_element_id: 5,
        assigned_user_id: approverId || '',
        assigned_role_id: 3, // Approver
        task_type: 'approval',
      };

      await supabase.from('case_event').insert({
        tenant_id: effectiveTenantId,
        parent_process_id: processInstance.id,
        name: 'Review and Approve',
        description: `Review the environmental analysis for "${project.title}"`,
        type: 'task',
        tier: 5,
        status: 'pending',
        assigned_entity: approverId || '',
        other: newTaskMeta as unknown as Record<string, unknown>,
      });

      // 7. Create notification for approver
      if (approverId) {
        await supabase.from('case_event').insert({
          tenant_id: effectiveTenantId,
          parent_process_id: processInstance.id,
          name: 'Approval Required',
          description: `Environmental analysis for "${project.title}" is ready for approval`,
          type: 'notification',
          status: 'pending',
          assigned_entity: approverId,
          other: {
            notification_type: 'approval_required',
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

  const isCurrentStep = currentStep === 4;
  const isCompleted = currentStep > 4;
  const draftMeta = draftDoc?.other as DocumentWorkflowMeta;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Revision notice */}
      {isRevision && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">Revisions Requested</span>
          </div>
          {revisionComments && (
            <p className="mt-2 text-sm">{revisionComments}</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>Step 4 of 5</span>
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Environmental Review Analysis</h1>
          <p className="text-gray-600 mt-1">
            {decisionElement?.description || 'Review the applicant document and produce the environmental analysis'}
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
            {/* Side by side view toggle */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowDraft(!showDraft)}
                  className={`px-3 py-1 rounded text-sm ${showDraft ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  {showDraft ? 'Hide' : 'Show'} Applicant Draft
                </button>
              </div>
            </div>

            {/* Content area - side by side when draft is shown */}
            <div className={`grid gap-4 ${showDraft ? 'md:grid-cols-2' : ''}`}>
              {/* Applicant draft (read-only) */}
              {showDraft && draftDoc && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Applicant Draft Document</h3>
                  {hedgedocBaseUrl ? (
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                      {!draftHedgeDocId ? (
                        <div className="p-4 text-sm text-gray-600">
                          Draft note is not linked yet. It will appear here once a HedgeDoc note ID is saved.
                        </div>
                      ) : (
                        <iframe
                          title="Applicant Draft"
                          src={`${hedgedocOrigin}/${draftHedgeDocId}`}
                          className="w-full min-h-[600px]"
                          allow="clipboard-read; clipboard-write; fullscreen"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none overflow-y-auto max-h-[600px] bg-white p-4 rounded border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                        {draftMeta?.markdown_content || 'No content'}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis editor */}
              <div className={showDraft ? '' : 'col-span-full'}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Your Analysis</h3>
                {hedgedocBaseUrl ? (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <iframe
                      title="HedgeDoc Analysis Editor"
                      src={analysisHedgeDocId && hedgedocOrigin
                        ? `${hedgedocOrigin}/${analysisHedgeDocId}`
                        : `${hedgedocOrigin}/new`}
                      className="w-full min-h-[600px]"
                      allow="clipboard-read; clipboard-write; fullscreen"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : (
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    disabled={!isCurrentStep}
                    placeholder="Write your environmental analysis..."
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={handleSave}
                disabled={saving || !isCurrentStep || !!hedgedocBaseUrl}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {hedgedocBaseUrl ? 'Auto-saved in HedgeDoc' : saving ? 'Saving...' : 'Save Draft'}
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
                  disabled={loading || !isCurrentStep || (!hedgedocBaseUrl && !content.trim())}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
