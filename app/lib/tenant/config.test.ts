import { describe, it, expect, afterEach } from 'vitest';
import { getConfiguredTenantSlug } from '@/lib/tenant/config';

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe('getConfiguredTenantSlug', () => {
  it('prefers the server-side slug', () => {
    process.env.CANONICAL_TENANT_SLUG = 'from-canonical';
    process.env.NEXT_PUBLIC_TENANT_SLUG = 'from-public';
    expect(getConfiguredTenantSlug()).toBe('from-canonical');
  });

  it('falls back to the public slug', () => {
    delete process.env.CANONICAL_TENANT_SLUG;
    process.env.NEXT_PUBLIC_TENANT_SLUG = 'from-public';
    expect(getConfiguredTenantSlug()).toBe('from-public');
  });

  it('defaults to reviewworks', () => {
    delete process.env.CANONICAL_TENANT_SLUG;
    delete process.env.NEXT_PUBLIC_TENANT_SLUG;
    expect(getConfiguredTenantSlug()).toBe('reviewworks');
  });
});
