'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTenantIdClient } from '@/lib/tenant/client';
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
  tenantId: string;
  task: CaseEvent | null;
  documents: Document[];
  hedgedocBaseUrl?: string | null;
}

// These are auto-populated by Supabase or the system
const HIDDEN_SYSTEM_FIELDS = [
  'id',
  'created_at',
  'last_updated',
  'retrieved_timestamp',
  'parent_project_id',
  'location_object',
  'other',
  'record_owner_agency',
  'data_source_agency',
  'data_source_system',
  'data_record_version',
];

// Make a property type nullable (allows null/empty values)
function makeNullable(prop: unknown): unknown {
  if (typeof prop !== 'object' || prop === null) return prop;

  const propObj = prop as Record<string, unknown>;
  const propType = propObj.type;

  // If it already allows null or has no type, return as-is
  if (!propType || (Array.isArray(propType) && propType.includes('null'))) {
    return prop;
  }

  // Create a copy to modify
  const result = { ...propObj };

  // Convert single type to array with null
  if (typeof propType === 'string') {
    result.type = [propType, 'null'];
  } else if (Array.isArray(propType)) {
    // Add null to existing array of types
    result.type = [...propType, 'null'];
  }

  // For object types, also make nested properties nullable
  if (propType === 'object' && propObj.properties) {
    const nestedProps = propObj.properties as Record<string, unknown>;
    const nullableNestedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(nestedProps)) {
      nullableNestedProps[key] = makeNullable(value);
    }
    result.properties = nullableNestedProps;
    // Remove required from nested objects
    delete result.required;
  }

  // For array types, make items nullable too
  if (propType === 'array' && propObj.items) {
    result.items = makeNullable(propObj.items);
  }

  return result;
}

// Filter out hidden fields from a schema and ensure only title is required
function filterSchema(schema: RJSFSchema): RJSFSchema {
  if (!schema.properties) return schema;

  const filteredProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    if (!HIDDEN_SYSTEM_FIELDS.includes(key)) {
      // Make all fields except 'title' nullable
      if (key === 'title') {
        filteredProperties[key] = value;
      } else {
        filteredProperties[key] = makeNullable(value);
      }
    }
  }

  return {
    ...schema,
    properties: filteredProperties,
    // Only require title - all other fields are optional
    required: ['title'],
  };
}

// Generate uiSchema to hide system fields
function generateUiSchema(baseUiSchema: Record<string, unknown>): Record<string, unknown> {
  const hiddenFields: Record<string, unknown> = {};
  for (const field of HIDDEN_SYSTEM_FIELDS) {
    hiddenFields[field] = { 'ui:widget': 'hidden' };
  }
  return { ...hiddenFields, ...baseUiSchema };
}

// Default form schema if decision element doesn't have one
// Only title is required - all other fields are optional (nullable)
const defaultSchema: RJSFSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: {
      type: 'string',
      title: 'Project Title',
      minLength: 1,
    },
    description: {
      type: ['string', 'null'],
      title: 'Description',
    },
    sector: {
      type: ['string', 'null'],
      title: 'Sector',
      enum: ['', 'Energy', 'Transportation', 'Land Management', 'Water Resources', 'Other', null],
    },
    lead_agency: {
      type: ['string', 'null'],
      title: 'Lead Agency',
    },
    location_text: {
      type: ['string', 'null'],
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
  tenantId,
  task,
  hedgedocBaseUrl = null,
}: Step2FormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get schema from decision element or use default, filtering out hidden system fields
  const rawSchema = (decisionElement?.form_data as RJSFSchema) || defaultSchema;
  const formSchema = filterSchema(rawSchema);
  const uiSchema = generateUiSchema(defaultUiSchema);

  // Pre-fill form with existing project data, excluding hidden system fields
  const projectData = project as unknown as Record<string, unknown>;
  const filteredProjectData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(projectData || {})) {
    if (!HIDDEN_SYSTEM_FIELDS.includes(key)) {
      filteredProjectData[key] = value;
    }
  }

  const initialFormData = {
    title: project.title || '',
    description: project.description || '',
    sector: project.sector || '',
    lead_agency: project.lead_agency || '',
    location_text: project.location_text || '',
    ...filteredProjectData,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    const formData = data.formData as Record<string, unknown>;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const effectiveTenantId = tenantId || await getTenantIdClient();

      // 1. Update project with form data (convert empty strings to null for optional fields)
      const { error: projectError } = await supabase
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
        .eq('tenant_id', effectiveTenantId);

      if (projectError) throw projectError;

      // 2. Create decision payload with form data
      await supabase.from('process_decision_payload').insert({
        tenant_id: effectiveTenantId,
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
          .eq('id', task.id)
          .eq('tenant_id', effectiveTenantId);
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
        .eq('id', processInstance.id)
        .eq('tenant_id', effectiveTenantId);

      // 5. Create task for step 3
      const newTaskMeta: CaseEventWorkflowMeta = {
        step_number: 3,
        decision_element_id: 3,
        assigned_user_id: userId,
        assigned_role_id: 1, // Applicant
        task_type: 'document',
      };

      await supabase.from('case_event').insert({
        tenant_id: effectiveTenantId,
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
        tenant_id: effectiveTenantId,
        parent_process_id: processInstance.id,
        title: 'Applicant Draft Document',
        document_type: 'draft',
        status: 'draft',
        prepared_by: userId,
        other: docMeta as unknown as Record<string, unknown>,
      });

      if (hedgedocBaseUrl) {
        const { data: latestDoc } = await supabase
          .from('document')
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .eq('parent_process_id', processInstance.id)
          .eq('document_type', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestDoc) {
          const response = await fetch('/api/hedgedoc/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: latestDoc.title || 'Applicant Draft Document',
              initialContent: docMeta.markdown_content || '',
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as { noteId: string; url: string };
            await supabase
              .from('document')
              .update({
                other: {
                  ...docMeta,
                  hedgedoc_note_id: data.noteId,
                  hedgedoc_url: data.url,
                },
              })
              .eq('id', latestDoc.id)
              .eq('tenant_id', effectiveTenantId);
          }
        }
      }

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
