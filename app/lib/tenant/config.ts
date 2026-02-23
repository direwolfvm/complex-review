export function getConfiguredTenantSlug(): string {
  return process.env.CANONICAL_TENANT_SLUG
    || process.env.NEXT_PUBLIC_TENANT_SLUG
    || 'reviewworks';
}

