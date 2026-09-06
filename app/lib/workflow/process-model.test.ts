import { describe, it, expect } from 'vitest';
import { resolveProcessModelId, PROCESS_MODEL_TITLE } from '@/lib/workflow/process-model';
import { createMockSupabase } from '@/lib/test/supabase-mock';

// resolveProcessModelId memoises per tenant+title, so each test uses its own tenant id
// to stay independent of the others.
let n = 0;
const tenant = () => `tenant-${++n}`;

describe('resolveProcessModelId', () => {
  it('resolves by tenant and title', async () => {
    const t = tenant();
    const { client, calls } = createMockSupabase(() => ({ data: { id: 7 }, error: null }));

    await expect(resolveProcessModelId(client, t)).resolves.toBe(7);

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('process_model');
    expect(calls[0].filters).toEqual({ tenant_id: t, title: PROCESS_MODEL_TITLE });
  });

  // IDs come from one sequence shared across every tenant in the project, so resolving
  // by number is what could point us at another tenant's workflow.
  it('never looks a model up by numeric id', async () => {
    const { client, calls } = createMockSupabase(() => ({ data: { id: 1 }, error: null }));

    await resolveProcessModelId(client, tenant());

    expect(calls[0].filters).not.toHaveProperty('id');
  });

  it('throws when the tenant has no such model', async () => {
    const { client } = createMockSupabase(() => ({ data: null, error: { code: 'PGRST116' } }));

    await expect(resolveProcessModelId(client, tenant())).rejects.toThrow(/not found for this tenant/);
  });

  it('does not re-query once resolved', async () => {
    const t = tenant();
    const { client, calls } = createMockSupabase(() => ({ data: { id: 3 }, error: null }));

    await resolveProcessModelId(client, t);
    await resolveProcessModelId(client, t);

    expect(calls).toHaveLength(1);
  });

  it('keeps tenants separate in the cache', async () => {
    const a = tenant();
    const b = tenant();
    const { client, calls } = createMockSupabase((call) => ({
      data: { id: call.filters.tenant_id === a ? 10 : 20 },
      error: null,
    }));

    await expect(resolveProcessModelId(client, a)).resolves.toBe(10);
    await expect(resolveProcessModelId(client, b)).resolves.toBe(20);
    expect(calls).toHaveLength(2);
  });

  it('accepts an explicit title', async () => {
    const { client, calls } = createMockSupabase(() => ({ data: { id: 5 }, error: null }));

    await resolveProcessModelId(client, tenant(), 'Basic Permit (SF-299)');

    expect(calls[0].filters.title).toBe('Basic Permit (SF-299)');
  });
});
