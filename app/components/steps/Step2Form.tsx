'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema } from '@rjsf/utils';
import type { Project, ProcessInstance, DecisionElement, CaseEvent, Document, CaseEventWorkflowMeta, ProcessInstanceWorkflowMeta, DocumentWorkflowMeta } from '@/lib/types/database';

interface Step2FormProps {
  processInstance: ProcessInstance;
  project: Project;
  decisionElement: DecisionElement | null;
  currentStep: number;
  userId: string;
  task: CaseEvent | null;
  documents: Document[];
}

// Default form schema if decision element doesn't have one
const defaultSchema: RJSFSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: {
      type: 'string',
      title: 'Project Title',
    },
    description: {
      type: 'string',
      title: 'Description',
    },
    sector: {
      type: 'string',
      title: 'Sector',
      enum: ['Energy', 'Transportation', 'Land Management', 'Water Resources', 'Other'],
    },
    lead_agency: {
      type: 'string',
      title: 'Lead Agency',
    },
    location_text: {
      type: 'string',
      title: 'Location',
    },
  },
};

const defaultUiSchema = {
  description: {
    'ui:widget': 'textarea',
  },
};

export default function Step2Form({
  processInstance,
  project,
  decisionElement,
  currentStep,
  userId,
  task,
}: Step2FormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get schema from decision element or use default
  const formSchema = (decisionElement?.form_data as RJSFSchema) || defaultSchema;
  const uiSchema = defaultUiSchema;

  // Pre-fill form with existing project data
  const initialFormData = {
    title: project.title || '',
    description: project.description || '',
    sector: project.sector || '',
    lead_agency: project.lead_agency || '',
    location_text: project.location_text || '',
    ...((project as unknown as Record<string, unknown>) || {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    const formData = data.formData as Record<string, unknown>;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Update project with form data
      const { error: projectError } = await supabase
        .from('project')
        .update({
          title: formData.title as string,
          description: formData.description as string,
          sector: formData.sector as string,
          lead_agency: formData.lead_agency as string,
          location_text: formData.location_text as string,
          current_status: 'underway',
        })
        .eq('id', project.id);

      if (projectError) throw projectError;

      // 2. Create decision payload with form data
      await supabase.from('process_decision_payload').insert({
        process_decision_element: 2,
        process: processInstance.id,
        project: project.id,
        result: 'completed',
        result_bool: true,
        evaluation_data: formData,
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

      // 4. Update process instance to step 3
      const processMeta: ProcessInstanceWorkflowMeta = {
        ...(processInstance.other as ProcessInstanceWorkflowMeta || {}),
        current_step: 3,
        workflow_status: 'in_progress',
      };

      await supabase
        .from('process_instance')
        .update({
          stage: 'Step 3: Applicant Document',
          other: processMeta as unknown as Record<string, unknown>,
        })
        .eq('id', processInstance.id);

      // 5. Create task for step 3
      const newTaskMeta: CaseEventWorkflowMeta = {
        step_number: 3,
        decision_element_id: 3,
        assigned_user_id: userId,
        assigned_role_id: 1, // Applicant
        task_type: 'document',
      };

      await supabase.from('case_event').insert({
        parent_process_id: processInstance.id,
        name: 'Complete Analysis Document',
        description: 'Draft your project analysis document',
        type: 'task',
        tier: 3,
        status: 'pending',
        assigned_entity: userId,
        other: newTaskMeta as unknown as Record<string, unknown>,
      });

      // 6. Create the draft document
      const docMeta: DocumentWorkflowMeta = {
        document_role: 'draft',
        created_by_user_id: userId,
        markdown_content: `# ${formData.title}

## Executive Summary
[Provide a brief overview of the project]

## Project Description
${formData.description || '[Describe the project in detail]'}

## Environmental Considerations
[List any environmental factors to consider]

## Supporting Documentation
[Reference any supporting documents]
`,
      };

      await supabase.from('document').insert({
        parent_process_id: processInstance.id,
        title: 'Applicant Draft Document',
        document_type: 'draft',
        status: 'draft',
        prepared_by: userId,
        other: docMeta as unknown as Record<string, unknown>,
      });

      // Navigate to step 3
      router.push(`/step/3/${processInstance.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
      setLoading(false);
    }
  };

  const isCurrentStep = currentStep === 2;
  const isCompleted = currentStep > 2;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>Step 2 of 5</span>
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Project Information</h1>
          <p className="text-gray-600 mt-1">
            {decisionElement?.description || 'Provide details about your project'}
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
              onClick={() => router.push(`/step/3/${processInstance.id}`)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Continue to Step 3
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Form<any>
            schema={formSchema}
            uiSchema={uiSchema}
            formData={initialFormData}
            validator={validator}
            onSubmit={handleSubmit}
            disabled={loading || !isCurrentStep}
          >
            <div className="mt-6 flex space-x-4">
              <button
                type="submit"
                disabled={loading || !isCurrentStep}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save and Continue'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/case/${processInstance.id}`)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Back to Case
              </button>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
