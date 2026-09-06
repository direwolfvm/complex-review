'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { ProcessInstance, DecisionElement, CaseEvent, Document, CaseEventWorkflowMeta, DocumentWorkflowMeta } from '@/lib/types/database';

interface Step4AnalysisProps {
  processInstance: ProcessInstance;
  decisionElement: DecisionElement | null;
  currentStep: number;
  task: CaseEvent | null;
  documents: Document[];
  hedgedocBaseUrl?: string | null;
}

export default function Step4Analysis({
  processInstance,
  decisionElement,
  currentStep,
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

  const ensureHedgeDocNote = async (doc: Document): Promise<{ noteId: string; url: string } | null> => {
    if (!hedgedocBaseUrl) return null;

    const response = await fetch(`/api/documents/${doc.id}/hedgedoc`, { method: 'POST' });

    if (!response.ok) {
      throw new Error('Failed to create HedgeDoc note');
    }

    return (await response.json()) as { noteId: string; url: string };
  };

  useEffect(() => {
    if (!hedgedocBaseUrl) return;

    let cancelled = false;

    (async () => {
      try {
        if (analysisDoc) {
          const analysisResult = await ensureHedgeDocNote(analysisDoc);
          if (!cancelled && analysisResult) {
            setAnalysisHedgeDocId(analysisResult.noteId);
          }
        }

        if (draftDoc) {
          const draftResult = await ensureHedgeDocNote(draftDoc);
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
      const response = await fetch(`/api/documents/${analysisDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to save');
      }

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
      const response = await fetch(`/api/cases/${processInstance.id}/steps/4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to complete step');
      }

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
              className="mt-4 text-green-600 hover:text-green-800"
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
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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
