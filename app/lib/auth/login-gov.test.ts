import { describe, it, expect } from 'vitest';
import { hasLoginGovIdentity, safeRedirectPath } from '@/lib/auth/login-gov';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths', () => {
    expect(safeRedirectPath('/case/12?tab=docs')).toBe('/case/12?tab=docs');
  });

  it('falls back for missing, absolute and protocol-relative values', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
    expect(safeRedirectPath('https://evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('//evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('/\\evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('@evil.example')).toBe('/dashboard');
  });
});

describe('hasLoginGovIdentity', () => {
  it('recognizes the keycloak provider', () => {
    expect(hasLoginGovIdentity({ app_metadata: { provider: 'keycloak' } })).toBe(true);
    expect(hasLoginGovIdentity({ app_metadata: { provider: 'email', providers: ['email', 'keycloak'] } })).toBe(true);
  });

  it('rejects password users and missing metadata', () => {
    expect(hasLoginGovIdentity({ app_metadata: { provider: 'email', providers: ['email'] } })).toBe(false);
    expect(hasLoginGovIdentity({ app_metadata: null })).toBe(false);
    expect(hasLoginGovIdentity(null)).toBe(false);
  });
});
