'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ProcessInstance, DecisionElement, Document, DocumentWorkflowMeta } from '@/lib/types/database';

interface Step5ApprovalProps {
  processInstance: ProcessInstance;
  decisionElement: DecisionElement | null;
  currentStep: number;
  documents: Document[];
}

export default function Step5Approval({
  processInstance,
  decisionElement,
  currentStep,
  documents,
}: Step5ApprovalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  // Derived from props rather than mirrored into state via an effect.
  const analysisDoc = useMemo(
    () =>
      documents.find(d => {
        const meta = d.other as DocumentWorkflowMeta;
        return meta?.document_role === 'analysis';
      }) || null,
    [documents]
  );

  const submitDecision = async (decision: 'approved' | 'changes_requested') => {
    if (decision === 'changes_requested' && !comments.trim()) {
      setError('Please provide feedback on what changes are needed');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${processInstance.id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to record decision');
      }

      router.push(`/case/${processInstance.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record decision');
      setLoading(false);
    }
  };

  const handleApprove = () => submitDecision('approved');
  const handleRequestChanges = () => submitDecision('changes_requested');


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
              className="mt-4 text-green-600 hover:text-green-800"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
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
