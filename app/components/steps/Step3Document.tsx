'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { ProcessInstance, DecisionElement, Document, DocumentWorkflowMeta } from '@/lib/types/database';

interface Step3DocumentProps {
  processInstance: ProcessInstance;
  decisionElement: DecisionElement | null;
  currentStep: number;
  documents: Document[];
  hedgedocBaseUrl?: string | null;
}

export default function Step3Document({
  processInstance,
  decisionElement,
  currentStep,
  documents,
  hedgedocBaseUrl = null,
}: Step3DocumentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [document, setDocument] = useState<Document | null>(null);
  const [hedgedocNoteId, setHedgedocNoteId] = useState<string | null>(null);
  const hedgedocOrigin = hedgedocBaseUrl?.replace(/\/$/, '') || null;

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
      setHedgedocNoteId(meta?.hedgedoc_note_id || null);
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
    if (!hedgedocBaseUrl || !document) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await ensureHedgeDocNote(document);
        if (!cancelled && result) {
          setHedgedocNoteId(result.noteId);
        }
      } catch (err) {
        // In anonymous HedgeDoc mode, note pre-creation can fail.
        // Fall back to `/new` embed instead of blocking the step.
        console.warn('HedgeDoc pre-create failed, falling back to /new', err);
        if (!cancelled) {
          setHedgedocNoteId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hedgedocBaseUrl, document]);

  const handleSave = async () => {
    if (!document) return;
    if (hedgedocBaseUrl) return;
    setSaving(true);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
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
      const response = await fetch(`/api/cases/${processInstance.id}/steps/3`, {
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
              className="mt-4 text-green-600 hover:text-green-800"
            >
              View Case
            </button>
          </div>
        ) : (
          <>
            {/* Editor */}
            <div className="mb-6">
              {hedgedocBaseUrl ? (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <iframe
                    title="HedgeDoc Editor"
                    src={hedgedocNoteId && hedgedocOrigin
                      ? `${hedgedocOrigin}/${hedgedocNoteId}`
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
                  placeholder="Write your project analysis document..."
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
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
