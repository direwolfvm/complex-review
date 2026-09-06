import { describe, it, expect, vi } from 'vitest';
import { submitProjectInformation } from '@/lib/workflow/steps';
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
