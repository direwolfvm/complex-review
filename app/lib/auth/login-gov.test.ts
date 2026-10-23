import { describe, it, expect } from 'vitest';
import { hasLoginGovIdentity, publicOrigin, safeRedirectPath } from '@/lib/auth/login-gov';

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

describe('publicOrigin', () => {
  const internal = 'https://localhost:8080/auth/callback?code=abc';
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

  it('prefers the configured base URL', () => {
    expect(publicOrigin(internal, headers({}), 'https://reviewworks.app.cloud.gov/')).toBe('https://reviewworks.app.cloud.gov');
  });

  it('uses the forwarded host behind the router', () => {
    expect(publicOrigin(internal, headers({ 'x-forwarded-host': 'reviewworks.app.cloud.gov', 'x-forwarded-proto': 'https' }), '')).toBe('https://reviewworks.app.cloud.gov');
  });

  it('ignores a malformed forwarded host', () => {
    expect(publicOrigin(internal, headers({ 'x-forwarded-host': 'evil.example/path' }), '')).toBe('https://localhost:8080');
  });

  it('falls back to the request origin', () => {
    expect(publicOrigin('http://localhost:3000/auth/callback', headers({}), '')).toBe('http://localhost:3000');
  });
});
