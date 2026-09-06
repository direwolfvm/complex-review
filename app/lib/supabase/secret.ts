import { createClient } from '@supabase/supabase-js';

/**
 * Privileged server-side client.
 *
 * Deliberately built with createClient rather than createServerClient, and with no
 * cookie integration. The SSR client resolves its Authorization header as
 * `(await getSessionToken()) ?? supabaseKey`, so wiring cookies into a privileged
 * client makes it send the signed-in user's JWT instead of the secret key and quietly
 * run as `authenticated`. Keeping this client sessionless is what makes it privileged.
 *
 * Never import this from a client component: the key must not reach the browser.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSecretClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || '';

  if (!url || !secretKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. The server needs a secret key (sb_secret_...) to write on behalf of authenticated users.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
