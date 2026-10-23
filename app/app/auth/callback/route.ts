import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { NEXT_PATH_COOKIE, hasLoginGovIdentity, safeRedirectPath } from '@/lib/auth/login-gov';
import { getTenantContextForUser, NotEnrolledError } from '@/lib/tenant/server';

// Handles both the email-confirmation link and the Login.gov (Keycloak) PKCE redirect.
// The Login.gov redirect URL carries no query string, so it matches the exact entry on the
// shared Supabase project's redirect allow-list; the return path travels in a cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next') ?? request.cookies.get(NEXT_PATH_COOKIE)?.value);

  const finish = (path: string) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.delete(NEXT_PATH_COOKIE);
    return response;
  };

  // A missing code is left to Supabase to reject, so the outcome rests on the exchange
  // result rather than on a request parameter.
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code ?? '');
  if (!error) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && hasLoginGovIdentity(user)) {
      // Enrolls a first-time Login.gov user (login_gov_enroll) or finds their membership.
      try {
        await getTenantContextForUser(user.id);
      } catch (err) {
        if (err instanceof NotEnrolledError) return finish('/not-enrolled');
        throw err;
      }
    }
    return finish(next);
  }

  // Return the user to the login page with the reason
  const message = searchParams.get('error_description') || 'Could not authenticate user';
  return finish(`/login?error=${encodeURIComponent(message)}`);
}
