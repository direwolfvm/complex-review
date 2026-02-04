import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getOrigin(requestUrl: URL): string {
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const authorizationId = params.get('authorization_id') || '';
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const responseType = params.get('response_type') || '';
  const scope = params.get('scope') || '';
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/login?redirectTo=${returnTo}`, url.origin));
  }

  let appName = clientId || 'Unknown App';
  let scopes = scope ? scope.split(' ') : [];

  if (authorizationId) {
    const { data: details } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (details?.client?.name) {
      appName = details.client.name;
    }
    if (typeof details?.scope === 'string' && details.scope.trim().length > 0) {
      scopes = details.scope.split(' ');
    }
  }

  const csrfToken = crypto.randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('oauth_consent_csrf', csrfToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/oauth/consent',
  });

  const scopeList = scopes.length
    ? scopes.map(s => `<li>${htmlEscape(s)}</li>`).join('')
    : '<li>(none)</li>';

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Consent</title>
  </head>
  <body>
    <main style="max-width: 560px; margin: 48px auto; font-family: system-ui, -apple-system, sans-serif;">
      <h1>Authorize ${htmlEscape(appName)}</h1>
      <p>This app is requesting access to your account.</p>
      <h2>Requested scopes</h2>
      <ul>${scopeList}</ul>

      <form method="post" action="/oauth/consent" style="margin-top: 24px; display: inline-block;">
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <input type="hidden" name="authorization_id" value="${htmlEscape(authorizationId)}" />
        <input type="hidden" name="client_id" value="${htmlEscape(clientId)}" />
        <input type="hidden" name="redirect_uri" value="${htmlEscape(redirectUri)}" />
        <input type="hidden" name="response_type" value="${htmlEscape(responseType)}" />
        <input type="hidden" name="scope" value="${htmlEscape(scope)}" />
        <input type="hidden" name="state" value="${htmlEscape(state)}" />
        <input type="hidden" name="code_challenge" value="${htmlEscape(codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${htmlEscape(codeChallengeMethod)}" />
        <input type="hidden" name="action" value="allow" />
        <button type="submit">Allow</button>
      </form>

      <form method="post" action="/oauth/consent" style="margin-top: 24px; display: inline-block; margin-left: 12px;">
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <input type="hidden" name="authorization_id" value="${htmlEscape(authorizationId)}" />
        <input type="hidden" name="client_id" value="${htmlEscape(clientId)}" />
        <input type="hidden" name="redirect_uri" value="${htmlEscape(redirectUri)}" />
        <input type="hidden" name="response_type" value="${htmlEscape(responseType)}" />
        <input type="hidden" name="scope" value="${htmlEscape(scope)}" />
        <input type="hidden" name="state" value="${htmlEscape(state)}" />
        <input type="hidden" name="code_challenge" value="${htmlEscape(codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${htmlEscape(codeChallengeMethod)}" />
        <input type="hidden" name="action" value="deny" />
        <button type="submit">Deny</button>
      </form>
    </main>
  </body>
</html>`;

  return new NextResponse(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const originHeader = (await headers()).get('origin');
  const requestOrigin = getOrigin(url);

  if (originHeader && originHeader !== requestOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const form = await request.formData();
  const csrfToken = String(form.get('csrf_token') || '');
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('oauth_consent_csrf')?.value || '';

  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const action = String(form.get('action') || '');
  const authorizationId = String(form.get('authorization_id') || '');
  const redirectUri = String(form.get('redirect_uri') || '');
  const state = String(form.get('state') || '');

  if (!redirectUri) {
    return NextResponse.json({ error: 'Missing redirect_uri' }, { status: 400 });
  }

  if (!authorizationId) {
    const redirect = new URL(redirectUri);
    redirect.searchParams.set('error', 'access_denied');
    if (state) redirect.searchParams.set('state', state);
    return NextResponse.redirect(redirect);
  }

  const supabase = await createClient();

  if (action === 'deny') {
    const { data } = await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (data?.redirect_url) {
      return NextResponse.redirect(data.redirect_url);
    }

    const redirect = new URL(redirectUri);
    redirect.searchParams.set('error', 'access_denied');
    if (state) redirect.searchParams.set('state', state);
    return NextResponse.redirect(redirect);
  }

  const { data } = await supabase.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });

  if (data?.redirect_url) {
    return NextResponse.redirect(data.redirect_url);
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set('error', 'server_error');
  if (state) redirect.searchParams.set('state', state);
  return NextResponse.redirect(redirect);
}
