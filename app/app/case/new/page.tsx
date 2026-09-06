'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCase = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cases', { method: 'POST' });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to create case');
      }

      router.push(`/step/2/${body.processInstanceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Start New Case</h1>
        <p className="text-gray-600 mb-6">
          Begin a new environmental review process. You&apos;ll be guided through a 5-step workflow:
        </p>

        <ol className="space-y-3 mb-8">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
              ✓
            </span>
            <div>
              <span className="font-medium text-gray-900">Step 1: Authentication</span>
              <span className="text-green-600 ml-2">(Complete)</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
              2
            </span>
            <div>
              <span className="font-medium text-gray-900">Step 2: Project Information</span>
              <p className="text-sm text-gray-500">Fill out the project details form</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
              3
            </span>
            <div>
              <span className="font-medium text-gray-900">Step 3: Applicant Document</span>
              <p className="text-sm text-gray-500">Draft your project analysis document</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
              4
            </span>
            <div>
              <span className="font-medium text-gray-900">Step 4: Analyst Review</span>
              <p className="text-sm text-gray-500">Agency analyst reviews and creates analysis</p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-800 rounded-full flex items-center justify-center text-sm font-medium mr-3">
              5
            </span>
            <div>
              <span className="font-medium text-gray-900">Step 5: Approval</span>
              <p className="text-sm text-gray-500">Final review and approval</p>
            </div>
          </li>
        </ol>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={handleCreateCase}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Start Case'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
