'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema } from '@rjsf/utils';

// The schema's own property map, so filterSchema can hand its result straight back
// to RJSFSchema without widening to Record<string, unknown>.
type SchemaProperties = NonNullable<RJSFSchema['properties']>;
type SchemaProperty = SchemaProperties[string];
import type { Project, ProcessInstance, DecisionElement } from '@/lib/types/database';

interface Step2FormProps {
  processInstance: ProcessInstance;
  project: Project;
  decisionElement: DecisionElement | null;
  currentStep: number;
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
function makeNullable(prop: SchemaProperty): SchemaProperty {
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
    const nestedProps = propObj.properties as SchemaProperties;
    const nullableNestedProps: SchemaProperties = {};
    for (const [key, value] of Object.entries(nestedProps)) {
      nullableNestedProps[key] = makeNullable(value);
    }
    result.properties = nullableNestedProps;
    // Remove required from nested objects
    delete result.required;
  }

  // For array types, make items nullable too
  if (propType === 'array' && propObj.items) {
    result.items = makeNullable(propObj.items as SchemaProperty);
  }

  return result as SchemaProperty;
}

// Filter out hidden fields from a schema and ensure only title is required
function filterSchema(schema: RJSFSchema): RJSFSchema {
  if (!schema.properties) return schema;

  const filteredProperties: SchemaProperties = {};
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
      const response = await fetch(`/api/cases/${processInstance.id}/steps/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to submit form');
      }

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
              className="mt-4 text-green-600 hover:text-green-800"
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
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
