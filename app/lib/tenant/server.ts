import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getConfiguredTenantSlug } from '@/lib/tenant/config';

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

export const getTenantContextForUser = cache(async (userId: string) => {
  const tenant = await getTenantBySlug();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_tenant_membership')
    .select('tenant_id, role, is_active, tenant:tenant_id(id, slug, name, is_active, is_default)')
    .eq('auth_provider', 'supabase')
    .eq('auth_user_id', userId)
    .eq('tenant_id', tenant.id)
    .single();

  if (error || !data) {
    throw new Error('No active tenant membership for authenticated user');
  }

  const membership = data as unknown as UserTenantMembershipRow;
  if (!membership.is_active) {
    throw new Error('Tenant membership is inactive');
  }

  return {
    tenantId: membership.tenant_id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    role: membership.role,
  };
});
