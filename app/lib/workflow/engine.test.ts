import { describe, it, expect } from 'vitest';
import { canUserAccessStep, advanceToStep, getRoleName } from '@/lib/workflow/engine';
import { createMockSupabase, type RecordedCall, type MockResult } from '@/lib/test/supabase-mock';

const TENANT = 'f73ba828-b1d3-4357-986e-0094877a0188';
const APPLICANT = 'applicant-user-id';
const ANALYST = 'analyst-user-id';
const APPROVER = 'approver-user-id';

/** decision_element rows for reviewworks are currently absent from the shared project. */
const NO_CATALOG: MockResult = { data: null, error: { code: 'PGRST116' } };

function assignments(rows: Array<{ user_id: string; user_role: number }>) {
  return (call: RecordedCall): MockResult | undefined => {
    if (call.table !== 'user_assignments') return undefined;
    if (call.filters.user_id !== undefined) {
      return { data: rows.filter((r) => r.user_id === call.filters.user_id), error: null };
    }
    if (call.filters.user_role !== undefined) {
      return { data: rows.filter((r) => r.user_role === call.filters.user_role), error: null };
    }
    return { data: rows, error: null };
  };
}

const ROSTER = assignments([
  { user_id: APPLICANT, user_role: 1 },
  { user_id: ANALYST, user_role: 2 },
  { user_id: APPROVER, user_role: 3 },
]);

function processWithApplicant(applicantId: string) {
  return {
    id: 34,
    other: { current_step: 3 },
    project: { id: 1, other: { applicant_user_id: applicantId } },
  };
}

describe('canUserAccessStep', () => {
  describe('when the decision_element catalog is unreadable', () => {
    // The catalog returns zero rows for our tenant today. Before this was fixed the
    // function fell through to "no required role, so anyone can access", which meant
    // any signed-in user could open the analyst and approver steps on any case.
    it('does not admit an unprivileged user to the approver step', async () => {
      const { client } = createMockSupabase((call) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return ROSTER(call);
      });

      const result = await canUserAccessStep(client, APPLICANT, 5, 34, TENANT);

      expect(result.canAccess).toBe(false);
      expect(result.requiredRole).toBe(3);
    });

    it('does not admit an unprivileged user to the analyst step', async () => {
      const { client } = createMockSupabase((call) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return ROSTER(call);
      });

      const result = await canUserAccessStep(client, APPLICANT, 4, 34, TENANT);

      expect(result.canAccess).toBe(false);
      expect(result.requiredRole).toBe(2);
    });

    it('still admits the analyst to the analyst step', async () => {
      const { client } = createMockSupabase((call) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return ROSTER(call);
      });

      const result = await canUserAccessStep(client, ANALYST, 4, 34, TENANT);

      expect(result.canAccess).toBe(true);
      expect(result.userRoles).toEqual([2]);
    });

    it('blocks the applicant from reviewing their own case even with the analyst role', async () => {
      const roster = assignments([{ user_id: APPLICANT, user_role: 2 }]);
      const { client } = createMockSupabase((call) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return roster(call);
      });

      const result = await canUserAccessStep(client, APPLICANT, 4, 34, TENANT);

      expect(result.canAccess).toBe(false);
    });

    it('admits only the case creator to the applicant steps', async () => {
      const respond = (call: RecordedCall) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return ROSTER(call);
      };

      for (const step of [2, 3]) {
        const own = await canUserAccessStep(createMockSupabase(respond).client, APPLICANT, step, 34, TENANT);
        expect(own.canAccess).toBe(true);

        const other = await canUserAccessStep(createMockSupabase(respond).client, ANALYST, step, 34, TENANT);
        expect(other.canAccess).toBe(false);
      }
    });

    it('fails closed on a step it has no definition for', async () => {
      const { client } = createMockSupabase((call) => {
        if (call.table === 'decision_element') return NO_CATALOG;
        if (call.table === 'process_instance') {
          return { data: processWithApplicant(APPLICANT), error: null };
        }
        return ROSTER(call);
      });

      const result = await canUserAccessStep(client, ANALYST, 9, 34, TENANT);

      expect(result.canAccess).toBe(false);
      expect(result.requiredRole).toBeNull();
    });
  });

  it('prefers the catalog role over the built-in fallback', async () => {
    // Catalog says step 4 belongs to role 3, contradicting the fallback of role 2.
    const { client } = createMockSupabase((call) => {
      if (call.table === 'decision_element') {
        return { data: { other: { responsible_role: 3 } }, error: null };
      }
      if (call.table === 'process_instance') {
        return { data: processWithApplicant(APPLICANT), error: null };
      }
      return ROSTER(call);
    });

    const result = await canUserAccessStep(client, APPROVER, 4, 34, TENANT);

    expect(result.requiredRole).toBe(3);
    expect(result.canAccess).toBe(true);
  });

  it('scopes every lookup to the caller tenant', async () => {
    const { client, calls } = createMockSupabase((call) => {
      if (call.table === 'decision_element') return NO_CATALOG;
      if (call.table === 'process_instance') {
        return { data: processWithApplicant(APPLICANT), error: null };
      }
      return ROSTER(call);
    });

    await canUserAccessStep(client, ANALYST, 4, 34, TENANT);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.filters.tenant_id, `${call.table} query was not tenant-scoped`).toBe(TENANT);
    }
  });
});

describe('advanceToStep', () => {
  const baseProcess = {
    id: 34,
    other: { current_step: 2 },
    project: { id: 1, other: { applicant_user_id: APPLICANT } },
  };

  it('completes the process once the last step is passed', async () => {
    const { client, calls } = createMockSupabase((call) => {
      if (call.table === 'process_instance') return { data: baseProcess, error: null };
      return undefined;
    });

    await advanceToStep(client, 34, 6, APPROVER, TENANT);

    const update = calls.find((c) => c.table === 'process_instance' && c.op === 'update');
    expect(update?.payload).toMatchObject({ status: 'completed', stage: 'Completed' });
  });

  it('does not consult the catalog to decide completion', async () => {
    const { client, calls } = createMockSupabase((call) => {
      if (call.table === 'process_instance') return { data: baseProcess, error: null };
      return undefined;
    });

    await advanceToStep(client, 34, 6, APPROVER, TENANT);

    expect(calls.filter((c) => c.table === 'decision_element')).toHaveLength(0);
  });

  // The regression that mattered: an unreadable catalog used to be read as "the
  // workflow is over", which wrote workflow_status 'approved' and turned an ordinary
  // step transition into an automatic permit approval.
  it('never approves a mid-workflow step when the catalog is missing', async () => {
    const { client, calls } = createMockSupabase((call) => {
      if (call.table === 'decision_element') return NO_CATALOG;
      if (call.table === 'process_instance') return { data: baseProcess, error: null };
      if (call.table === 'case_event') return { data: { id: 99, other: {} }, error: null };
      return ROSTER(call);
    });

    await advanceToStep(client, 34, 3, APPLICANT, TENANT);

    const writes = calls.filter((c) => c.table === 'process_instance' && c.op === 'update');
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      const payload = write.payload as Record<string, unknown>;
      expect(payload.status).not.toBe('completed');
      expect((payload.other as Record<string, unknown>)?.workflow_status).not.toBe('approved');
    }
  });

  it('still creates the step task when the catalog is missing', async () => {
    const { client, calls } = createMockSupabase((call) => {
      if (call.table === 'decision_element') return NO_CATALOG;
      if (call.table === 'process_instance') return { data: baseProcess, error: null };
      if (call.table === 'case_event') return { data: { id: 99, other: {} }, error: null };
      return ROSTER(call);
    });

    await advanceToStep(client, 34, 4, APPLICANT, TENANT);

    const task = calls.find((c) => c.table === 'case_event' && c.op === 'insert');
    expect(task).toBeDefined();
    const payload = task!.payload as Record<string, unknown>;
    expect(payload.name).toBe('Step 4: Analyst Review');
    expect(payload.tenant_id).toBe(TENANT);
    // Role 2 comes from the fallback, so the step is assigned to the analyst rather
    // than to whoever happened to trigger the transition.
    expect(payload.assigned_entity).toBe(ANALYST);
  });
});

describe('getRoleName', () => {
  it('names the three workflow roles', () => {
    expect(getRoleName(1)).toBe('Applicant');
    expect(getRoleName(2)).toBe('Analyst');
    expect(getRoleName(3)).toBe('Approver');
  });

  it('falls back for an unknown role', () => {
    expect(getRoleName(42)).toBe('Role 42');
  });
});
