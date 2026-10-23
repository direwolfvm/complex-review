import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getConfiguredTenantSlug } from '@/lib/tenant/config';
import { hasLoginGovIdentity } from '@/lib/auth/login-gov';

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
}

interface UserTenantMembershipRow {
  tenant_id: string;
  role: string | null;
  is_active: boolean;
  tenant: TenantRow | TenantRow[] | null;
}

export const getTenantBySlug = cache(async (slug?: string): Promise<TenantRow> => {
  const effectiveSlug = slug || getConfiguredTenantSlug();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenant')
    .select('id, slug, name, is_active, is_default')
    .eq('slug', effectiveSlug)
    .single();

  if (error || !data) {
    throw new Error(`Tenant not found for slug "${effectiveSlug}"`);
  }

  if (!data.is_active) {
    throw new Error(`Tenant "${effectiveSlug}" is inactive`);
  }

  return data as TenantRow;
});

/** The signed-in user has no active membership in the configured tenant. */
export class NotEnrolledError extends Error {
  constructor(message = 'No active tenant membership for authenticated user') {
    super(message);
    this.name = 'NotEnrolledError';
  }
}

export const getTenantContextForUser = cache(async (userId: string) => {
  const tenant = await getTenantBySlug();
  const supabase = await createClient();

  const loadMembership = async () => {
    const { data, error } = await supabase
      .from('user_tenant_membership')
      .select('tenant_id, role, is_active, tenant:tenant_id(id, slug, name, is_active, is_default)')
      .eq('auth_provider', 'supabase')
      .eq('auth_user_id', userId)
      .eq('tenant_id', tenant.id)
      .single();
    return error || !data ? null : (data as unknown as UserTenantMembershipRow);
  };

  let membership = await loadMembership();

  // A Login.gov user with no membership is enrolled once as applicant, if the database
  // finds a verified .gov or .mil email and the tenant allows it. Anyone else stays
  // signed in without a membership and sees the not-enrolled page.
  if (!membership) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === userId && hasLoginGovIdentity(user)) {
      const { error } = await supabase.rpc('login_gov_enroll', { p_tenant_slug: tenant.slug });
      if (error) {
        console.warn('Login.gov enrollment refused:', error.message);
      } else {
        membership = await loadMembership();
      }
    }
  }

  if (!membership) {
    throw new NotEnrolledError();
  }
  if (!membership.is_active) {
    throw new NotEnrolledError('Tenant membership is inactive');
  }

  return {
    tenantId: membership.tenant_id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    role: membership.role,
  };
});

/** For pages and layouts: the tenant context, or the not-enrolled page. */
export async function requireTenantContext(userId: string) {
  try {
    return await getTenantContextForUser(userId);
  } catch (err) {
    if (err instanceof NotEnrolledError) {
      redirect('/not-enrolled');
    }
    throw err;
  }
}
