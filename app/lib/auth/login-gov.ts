/**
 * Login.gov sign-in helpers.
 *
 * Login.gov is brokered through Keycloak, so a Login.gov user arrives in Supabase with
 * the `keycloak` provider. Keycloak only accepts Login.gov for the Supabase clients, so
 * `keycloak` means "came from Login.gov". Enrollment itself is decided in the database
 * by `public.login_gov_enroll(slug)`: a verified .gov or .mil email gets the tenant's
 * lowest role (applicant), anyone else signs in with no membership.
 */

export const DEFAULT_REDIRECT = '/dashboard';

/** Cookie that carries the post-sign-in path across the Login.gov round trip. */
export const NEXT_PATH_COOKIE = 'rw_login_next';

/** Same-origin paths only; anything else falls back to the dashboard. */
export function safeRedirectPath(raw: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback;
  }
  return raw;
}

export interface LoginGovCandidate {
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
}

/** True when the user has signed in through the Keycloak (Login.gov) provider. */
export function hasLoginGovIdentity(user: LoginGovCandidate | null | undefined): boolean {
  const meta = user?.app_metadata;
  if (!meta) return false;
  if (meta.provider === 'keycloak') return true;
  return Array.isArray(meta.providers) && meta.providers.includes('keycloak');
}

/**
 * The public origin for redirects. Behind the cloud.gov router, request.url carries the
 * app's internal address (https://localhost:8080), so prefer the configured base URL,
 * then the router's forwarded host.
 */
export function publicOrigin(
  requestUrl: string,
  headers: { get(name: string): string | null },
  baseUrl: string | undefined = process.env.NEXT_PUBLIC_APP_BASE_URL,
): string {
  if (baseUrl) {
    try {
      return new URL(baseUrl).origin;
    } catch {
      // Fall through to the request's own address.
    }
  }
  const host = headers.get('x-forwarded-host')?.split(',')[0].trim();
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const proto = headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'http' ? 'http' : 'https';
    return `${proto}://${host}`;
  }
  return new URL(requestUrl).origin;
}
