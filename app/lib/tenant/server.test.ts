import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase, type RecordedCall } from '@/lib/test/supabase-mock';

const state = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: null as any,
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import { getTenantContextForUser, requireTenantContext, NotEnrolledError } from '@/lib/tenant/server';

const TENANT = { id: 't-1', slug: 'reviewworks', name: 'Review Works', is_active: true, is_default: false };
const LOGIN_GOV_USER = { id: 'u-1', app_metadata: { provider: 'keycloak', providers: ['keycloak'] } };
const PASSWORD_USER = { id: 'u-1', app_metadata: { provider: 'email', providers: ['email'] } };

function setup(opts: {
  user: object;
  memberships: Array<{ role: string; is_active: boolean } | null>;
  rpcError?: { message: string } | null;
}) {
  let membershipReads = 0;
  const mock = createMockSupabase((call: RecordedCall) => {
    if (call.table === 'tenant') return { data: TENANT, error: null };
    if (call.table === 'user_tenant_membership') {
      const row = opts.memberships[Math.min(membershipReads++, opts.memberships.length - 1)];
      return row
        ? { data: { tenant_id: TENANT.id, tenant: TENANT, ...row }, error: null }
        : { data: null, error: { code: 'PGRST116' } };
    }
    return undefined;
  });
  const rpc = vi.fn(async () => ({ data: opts.rpcError ? null : { enrolled: true }, error: opts.rpcError ?? null }));
  state.client = {
    ...mock.client,
    rpc,
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
  };
  return { rpc };
}

beforeEach(() => {
  delete process.env.CANONICAL_TENANT_SLUG;
  delete process.env.NEXT_PUBLIC_TENANT_SLUG;
});

describe('getTenantContextForUser', () => {
  it('returns an existing membership without enrolling', async () => {
    const { rpc } = setup({ user: LOGIN_GOV_USER, memberships: [{ role: 'analyst', is_active: true }] });
    await expect(getTenantContextForUser('u-1')).resolves.toMatchObject({ tenantId: 't-1', role: 'analyst' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enrolls a Login.gov user with no membership, then reads the new one', async () => {
    const { rpc } = setup({ user: LOGIN_GOV_USER, memberships: [null, { role: 'applicant', is_active: true }] });
    await expect(getTenantContextForUser('u-1')).resolves.toMatchObject({ role: 'applicant' });
    expect(rpc).toHaveBeenCalledWith('login_gov_enroll', { p_tenant_slug: 'reviewworks' });
  });

  it('is not enrolled when the database refuses (not .gov/.mil)', async () => {
    const { rpc } = setup({ user: LOGIN_GOV_USER, memberships: [null], rpcError: { message: 'Joining requires ...' } });
    await expect(getTenantContextForUser('u-1')).rejects.toBeInstanceOf(NotEnrolledError);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('never calls the RPC for a password user', async () => {
    const { rpc } = setup({ user: PASSWORD_USER, memberships: [null] });
    await expect(getTenantContextForUser('u-1')).rejects.toBeInstanceOf(NotEnrolledError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('treats an inactive membership as not enrolled', async () => {
    setup({ user: LOGIN_GOV_USER, memberships: [{ role: 'applicant', is_active: false }] });
    await expect(getTenantContextForUser('u-1')).rejects.toBeInstanceOf(NotEnrolledError);
  });
});

describe('requireTenantContext', () => {
  it('sends a user without membership to the not-enrolled page', async () => {
    setup({ user: PASSWORD_USER, memberships: [null] });
    await expect(requireTenantContext('u-1')).rejects.toThrow('REDIRECT /not-enrolled');
  });
});
