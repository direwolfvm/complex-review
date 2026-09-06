import { describe, it, expect } from 'vitest';
import { decideApproval } from '@/lib/workflow/approval';
import { createMockSupabase, type RecordedCall, type MockResult } from '@/lib/test/supabase-mock';

const TENANT = 'f73ba828-b1d3-4357-986e-0094877a0188';
const APPROVER = 'approver-user-id';
const ANALYST = 'analyst-user-id';

const PROCESS = {
  id: 34,
  other: { current_step: 5, workflow_status: 'pending_approval' },
  project: {
    id: 1,
    title: 'Big Tree Farm',
    other: { applicant_user_id: 'applicant-user-id', analyst_user_id: ANALYST },
  },
};

/** Step 5 is element 5 and step 4 is element 4 in the rebuilt catalog. */
function responder(overrides: { task?: unknown } = {}) {
  return (call: RecordedCall): MockResult | undefined => {
    if (call.table === 'process_instance' && call.op === 'select') {
      return { data: PROCESS, error: null };
    }
    if (call.table === 'case_event' && call.op === 'select') {
      return { data: overrides.task ?? { id: 77, other: { step_number: 5 } }, error: null };
    }
    if (call.table === 'decision_element') {
      const step = call.filters['other->>step_number'];
      return { data: { id: Number(step) }, error: null };
    }
    return undefined;
  };
}

const inserts = (calls: RecordedCall[], table: string) =>
  calls.filter((c) => c.table === table && c.op === 'insert');
const updates = (calls: RecordedCall[], table: string) =>
  calls.filter((c) => c.table === table && c.op === 'update');

describe('decideApproval', () => {
  describe('approved', () => {
    it('completes the process and marks the project approved', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'approved', comments: 'Looks good',
      });

      const process = updates(calls, 'process_instance')[0].payload as Record<string, unknown>;
      expect(process).toMatchObject({ status: 'completed', stage: 'Approved', outcome: 'approved' });

      const project = updates(calls, 'project')[0].payload as Record<string, unknown>;
      expect(project).toEqual({ current_status: 'approved' });
    });

    it('records the decision against the resolved element, not a hardcoded id', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'approved', comments: '',
      });

      const lookup = calls.find((c) => c.table === 'decision_element');
      expect(lookup?.filters).toMatchObject({ 'other->>step_number': '5' });
      expect(lookup?.filters).not.toHaveProperty('id');

      const payload = inserts(calls, 'process_decision_payload')[0].payload as Record<string, unknown>;
      expect(payload).toMatchObject({ result: 'approved', result_bool: true, process: 34 });
      expect(payload.process_decision_element).toBe(5);
    });

    it('notifies the analyst', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'approved', comments: '',
      });

      const notification = inserts(calls, 'case_event')
        .map((c) => c.payload as Record<string, unknown>)
        .find((p) => p.type === 'notification');
      expect(notification).toMatchObject({ assigned_entity: ANALYST, name: 'Case Approved' });
    });

    it('closes the open approval task', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'approved', comments: 'ok',
      });

      const closed = updates(calls, 'case_event')[0].payload as Record<string, unknown>;
      expect(closed).toMatchObject({ status: 'completed', outcome: 'approved' });
      expect((closed.other as Record<string, unknown>).approval_decision).toBe('approved');
    });
  });

  describe('changes requested', () => {
    it('does not complete the process or approve the project', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'changes_requested', comments: 'Needs more detail',
      });

      for (const write of updates(calls, 'process_instance')) {
        const payload = write.payload as Record<string, unknown>;
        expect(payload.status).not.toBe('completed');
        expect((payload.other as Record<string, unknown>)?.workflow_status).not.toBe('approved');
      }
      expect(updates(calls, 'project')).toHaveLength(0);
    });

    it('sends the case back to the analyst as a revision task', async () => {
      const { client, calls } = createMockSupabase(responder());

      await decideApproval(client, {
        tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
        decision: 'changes_requested', comments: 'Needs more detail',
      });

      const task = inserts(calls, 'case_event')
        .map((c) => c.payload as Record<string, unknown>)
        .find((p) => p.type === 'task');
      expect(task).toMatchObject({ tier: 4, assigned_entity: ANALYST, status: 'pending' });
      const meta = task!.other as Record<string, unknown>;
      expect(meta.revision_requested).toBe(true);
      expect(meta.decision_element_id).toBe(4);
    });

    it('refuses to send a case back without feedback', async () => {
      const { client } = createMockSupabase(responder());

      await expect(
        decideApproval(client, {
          tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
          decision: 'changes_requested', comments: '   ',
        })
      ).rejects.toThrow(/Feedback is required/);
    });
  });

  it('scopes every write to the caller tenant', async () => {
    const { client, calls } = createMockSupabase(responder());

    await decideApproval(client, {
      tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
      decision: 'approved', comments: '',
    });

    for (const call of calls) {
      if (call.op === 'insert') {
        expect((call.payload as Record<string, unknown>).tenant_id, `${call.table} insert`).toBe(TENANT);
      } else {
        expect(call.filters.tenant_id, `${call.table} ${call.op}`).toBe(TENANT);
      }
    }
  });

  it('still records the decision when the approval task is already gone', async () => {
    const { client, calls } = createMockSupabase(responder({ task: null }));

    await decideApproval(client, {
      tenantId: TENANT, userId: APPROVER, processInstanceId: 34,
      decision: 'approved', comments: '',
    });

    expect(inserts(calls, 'process_decision_payload')).toHaveLength(1);
  });
});
