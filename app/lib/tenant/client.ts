import { createClient } from '@/lib/supabase/client';

let cachedTenantId: string | null = null;
let cachedSlug: string | null = null;

function getConfiguredTenantSlugClient(): string {
  if (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_TENANT_SLUG) {
    return window.__ENV__.NEXT_PUBLIC_TENANT_SLUG;
  }

  return process.env.NEXT_PUBLIC_TENANT_SLUG || 'reviewworks';
}

export async function getTenantIdClient(): Promise<string> {
  const slug = getConfiguredTenantSlugClient();
  if (cachedTenantId && cachedSlug === slug) {
    return cachedTenantId;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('tenant')
    .select('id, slug')
    .eq('slug', slug)
    .single();

  if (error || !data?.id) {
    throw new Error(`Tenant lookup failed for slug "${slug}"`);
  }

  cachedTenantId = data.id as string;
  cachedSlug = slug;
  return data.id as string;
}
