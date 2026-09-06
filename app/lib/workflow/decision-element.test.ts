import { describe, it, expect } from 'vitest';
import { findDecisionElementForStep } from '@/lib/workflow/decision-element';
import { createMockSupabase } from '@/lib/test/supabase-mock';

const TENANT = 'f73ba828-b1d3-4357-986e-0094877a0188';

describe('findDecisionElementForStep', () => {
  it('matches on tenant and step number', async () => {
    const { client, calls } = createMockSupabase(() => ({
      data: { id: 4, title: 'Environmental Review' },
      error: null,
    }));

    await findDecisionElementForStep(client, TENANT, 4);

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('decision_element');
    expect(calls[0].filters).toEqual({ tenant_id: TENANT, 'other->>step_number': '4' });
  });

  // decision_element ids come from a sequence shared with every other tenant. Our rows
  // were deleted once already and the ids reissued elsewhere, so matching a step to a
  // primary key would have pointed us at another tenant's workflow.
  it('never matches on the primary key', async () => {
    const { client, calls } = createMockSupabase(() => ({ data: { id: 4 }, error: null }));

    await findDecisionElementForStep(client, TENANT, 4);

    expect(calls[0].filters).not.toHaveProperty('id');
  });

  it('returns null when the tenant has no element for that step', async () => {
    const { client } = createMockSupabase(() => ({ data: null, error: { code: 'PGRST116' } }));

    await expect(findDecisionElementForStep(client, TENANT, 9)).resolves.toBeNull();
  });

  it('narrows the selected columns when asked', async () => {
    const { client } = createMockSupabase(() => ({ data: { other: {} }, error: null }));

    await expect(findDecisionElementForStep(client, TENANT, 2, 'other')).resolves.toEqual({ other: {} });
  });
});
