import { describe, it, expect, vi } from 'vitest';
import { submitProjectInformation, submitDocumentStep } from '@/lib/workflow/steps';
import { createMockSupabase, type RecordedCall, type MockResult } from '@/lib/test/supabase-mock';

// HedgeDoc is optional and off in tests unless a case explicitly turns it on.
vi.mock('@/lib/hedgedoc/client', () => ({
  isHedgeDocConfigured: () => false,
  createNote: vi.fn(),
}));

const TENANT = 'f73ba828-b1d3-4357-986e-0094877a0188';
const APPLICANT = 'applicant-user-id';

const PROCESS = {
  id: 34,
  other: { current_step: 2, workflow_status: 'draft' },
  project: { id: 1, title: 'New Project', other: { applicant_user_id: APPLICANT } },
};

const FORM = {
  title: 'Highway 101 Environmental Review',
  description: 'Widening study',
  sector: 'Transportation',
  lead_agency: 'DOT',
  location_text: 'San Francisco, CA',
};

function responder(call: RecordedCall): MockResult | undefined {
  if (call.table === 'process_instance' && call.op === 'select') {
    return { data: PROCESS, error: null };
  }
  if (call.table === 'case_event' && call.op === 'select') {
    return { data: { id: 55, other: { step_number: 2 } }, error: null };
  }
  if (call.table === 'decision_element') {
    return { data: { id: Number(call.filters['other->>step_number']) }, error: null };
  }
  if (call.table === 'document' && call.op === 'insert') {
    return { data: { id: 90, title: 'Applicant Draft Document' }, error: null };
  }
  return undefined;
}

const inserts = (calls: RecordedCall[], table: string) =>
  calls.filter((c) => c.table === table && c.op === 'insert');

describe('submitProjectInformation', () => {
  it('writes the form onto the project', async () => {
    const { client, calls } = createMockSupabase(responder);

    await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    const update = calls.find((c) => c.table === 'project' && c.op === 'update');
    expect(update?.payload).toMatchObject({
      title: FORM.title,
      sector: 'Transportation',
      current_status: 'underway',
    });
    expect(update?.filters).toMatchObject({ id: 1, tenant_id: TENANT });
  });

  it('records the payload against the resolved step 2 element', async () => {
    const { client, calls } = createMockSupabase(responder);

    await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    const payload = inserts(calls, 'process_decision_payload')[0].payload as Record<string, unknown>;
    expect(payload.process_decision_element).toBe(2);
    expect(payload.evaluation_data).toEqual(FORM);
  });

  it('advances the case to step 3 and opens the next task', async () => {
    const { client, calls } = createMockSupabase(responder);

    const result = await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    expect(result.nextStep).toBe(3);

    const process = calls.find((c) => c.table === 'process_instance' && c.op === 'update');
    expect((process?.payload as Record<string, unknown>).stage).toBe('Step 3: Applicant Document');

    const task = inserts(calls, 'case_event')[0].payload as Record<string, unknown>;
    expect(task).toMatchObject({ tier: 3, status: 'pending', assigned_entity: APPLICANT });
    expect((task.other as Record<string, unknown>).decision_element_id).toBe(3);
  });

  it('seeds the draft document the applicant will edit', async () => {
    const { client, calls } = createMockSupabase(responder);

    await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    const doc = inserts(calls, 'document')[0].payload as Record<string, unknown>;
    expect(doc).toMatchObject({ document_type: 'draft', status: 'draft', prepared_by: APPLICANT });
    const meta = doc.other as Record<string, unknown>;
    expect(String(meta.markdown_content)).toContain(FORM.title);
  });

  it('closes the step 2 task', async () => {
    const { client, calls } = createMockSupabase(responder);

    await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    const closed = calls.find((c) => c.table === 'case_event' && c.op === 'update');
    expect(closed?.payload).toMatchObject({ status: 'completed', outcome: 'completed' });
  });

  it('rejects a submission with no project title', async () => {
    const { client } = createMockSupabase(responder);

    await expect(
      submitProjectInformation(client, {
        tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: { title: '  ' },
      })
    ).rejects.toThrow(/title is required/);
  });

  it('scopes every write to the caller tenant', async () => {
    const { client, calls } = createMockSupabase(responder);

    await submitProjectInformation(client, {
      tenantId: TENANT, userId: APPLICANT, processInstanceId: 34, formData: FORM,
    });

    for (const call of calls) {
      if (call.op === 'insert') {
        expect((call.payload as Record<string, unknown>).tenant_id, `${call.table} insert`).toBe(TENANT);
      } else {
        expect(call.filters.tenant_id, `${call.table} ${call.op}`).toBe(TENANT);
      }
    }
  });
});

describe('submitDocumentStep', () => {
  const APPLICANT2 = 'applicant-2';
  const ANALYST = 'analyst-1';
  const APPROVER = 'approver-1';

  function docResponder(opts: {
    step: number;
    projectMeta?: Record<string, unknown>;
    roster?: Array<{ user_id: string; user_role: number }>;
  }) {
    const projectMeta = opts.projectMeta ?? { applicant_user_id: APPLICANT2 };
    const roster = opts.roster ?? [
      { user_id: APPLICANT2, user_role: 2 }, // also an analyst, but ineligible here
      { user_id: ANALYST, user_role: 2 },
      { user_id: APPROVER, user_role: 3 },
    ];
    return (call: RecordedCall): MockResult | undefined => {
      if (call.table === 'process_instance' && call.op === 'select') {
        return {
          data: {
            id: 34,
            other: { current_step: opts.step },
            project: { id: 1, title: 'Big Tree Farm', other: projectMeta },
          },
          error: null,
        };
      }
      if (call.table === 'document' && call.op === 'select') {
        return {
          data: [
            { id: 10, other: { document_role: 'draft', markdown_content: 'draft body' } },
            { id: 11, other: { document_role: 'analysis', markdown_content: 'analysis body' } },
          ],
          error: null,
        };
      }
      if (call.table === 'case_event' && call.op === 'select') {
        return { data: { id: 60, other: {} }, error: null };
      }
      if (call.table === 'decision_element') {
        return { data: { id: Number(call.filters['other->>step_number']) }, error: null };
      }
      if (call.table === 'user_assignments') {
        return { data: roster.filter((r) => r.user_role === call.filters.user_role), error: null };
      }
      return undefined;
    };
  }

  // The rule that matters: whoever already acted on a case cannot be handed the next step.
  it('does not hand the review to the applicant, even when they hold the analyst role', async () => {
    const { client } = createMockSupabase(docResponder({ step: 3 }));

    const result = await submitDocumentStep(client, {
      tenantId: TENANT, userId: APPLICANT2, processInstanceId: 34, step: 3, content: 'body',
    });

    expect(result.assignedTo).toBe(ANALYST);
  });

  it('does not hand approval to the applicant or the analyst', async () => {
    const { client } = createMockSupabase(
      docResponder({
        step: 4,
        projectMeta: { applicant_user_id: APPLICANT2, analyst_user_id: ANALYST },
        roster: [
          { user_id: APPLICANT2, user_role: 3 },
          { user_id: ANALYST, user_role: 3 },
          { user_id: APPROVER, user_role: 3 },
        ],
      })
    );

    const result = await submitDocumentStep(client, {
      tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step: 4, content: 'analysis',
    });

    expect(result.assignedTo).toBe(APPROVER);
  });

  it('submits the draft on step 3 and the analysis on step 4', async () => {
    for (const [step, expectedId] of [[3, 10], [4, 11]] as const) {
      const { client, calls } = createMockSupabase(docResponder({ step }));
      await submitDocumentStep(client, {
        tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step, content: 'body',
      });
      const update = calls.find((c) => c.table === 'document' && c.op === 'update');
      expect(update?.filters.id).toBe(expectedId);
      expect((update?.payload as Record<string, unknown>).status).toBe('submitted');
    }
  });

  it('advances step 3 to analyst review and step 4 to approval', async () => {
    for (const [step, stage, status] of [
      [3, 'Step 4: Analyst Review', 'in_progress'],
      [4, 'Step 5: Approval', 'pending_approval'],
    ] as const) {
      const { client, calls } = createMockSupabase(docResponder({ step }));
      await submitDocumentStep(client, {
        tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step, content: 'body',
      });
      const update = calls.find((c) => c.table === 'process_instance' && c.op === 'update');
      const payload = update?.payload as Record<string, unknown>;
      expect(payload.stage).toBe(stage);
      expect((payload.other as Record<string, unknown>).workflow_status).toBe(status);
    }
  });

  it('seeds the analysis document on step 3 only', async () => {
    const three = createMockSupabase(docResponder({ step: 3 }));
    await submitDocumentStep(three.client, {
      tenantId: TENANT, userId: APPLICANT2, processInstanceId: 34, step: 3, content: 'body',
    });
    expect(inserts(three.calls, 'document')).toHaveLength(1);

    const four = createMockSupabase(docResponder({ step: 4 }));
    await submitDocumentStep(four.client, {
      tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step: 4, content: 'body',
    });
    expect(inserts(four.calls, 'document')).toHaveLength(0);
  });

  it('records the payload against the resolved element for the step', async () => {
    const { client, calls } = createMockSupabase(docResponder({ step: 4 }));

    await submitDocumentStep(client, {
      tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step: 4, content: 'body',
    });

    const payload = inserts(calls, 'process_decision_payload')[0].payload as Record<string, unknown>;
    expect(payload.process_decision_element).toBe(4);
  });

  it('refuses a step that is not a document step', async () => {
    const { client } = createMockSupabase(docResponder({ step: 3 }));

    await expect(
      submitDocumentStep(client, {
        tenantId: TENANT, userId: ANALYST, processInstanceId: 34, step: 5, content: '',
      })
    ).rejects.toThrow(/not a document step/);
  });

  it('scopes every write to the caller tenant', async () => {
    const { client, calls } = createMockSupabase(docResponder({ step: 3 }));

    await submitDocumentStep(client, {
      tenantId: TENANT, userId: APPLICANT2, processInstanceId: 34, step: 3, content: 'body',
    });

    for (const call of calls) {
      if (call.op === 'insert') {
        expect((call.payload as Record<string, unknown>).tenant_id, `${call.table} insert`).toBe(TENANT);
      } else {
        expect(call.filters.tenant_id, `${call.table} ${call.op}`).toBe(TENANT);
      }
    }
  });
});
