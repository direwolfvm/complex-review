'use client';

import { Suspense, useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { NEXT_PATH_COOKIE, safeRedirectPath } from '@/lib/auth/login-gov';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get('redirectTo'));
  // Errors handed back by /auth/callback
  const queryError = searchParams.get('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;
        setMessage('Check your email for the confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Login.gov, brokered by Keycloak. The demo email/password form below stays as it is.
  const handleLoginGov = async () => {
    setSsoLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      // The callback URL must match the shared project's allow-list exactly, so the
      // return path goes in a short-lived cookie instead of the query string.
      document.cookie = `${NEXT_PATH_COOKIE}=${encodeURIComponent(redirectTo)}; Path=/auth; Max-Age=900; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'keycloak' as Provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Keycloak requires the OIDC "openid" scope to treat this as OIDC.
          scopes: 'openid email profile',
          // Tell Keycloak to skip its login selector and go straight to the broker.
          queryParams: { kc_idp_hint: 'login-gov' },
        },
      });

      if (error) throw error;

      // Some environments return a URL instead of doing an immediate redirect.
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Login.gov sign-in.');
      setSsoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16" viewBox="0 0 32 32" fill="none">
              <rect x="14" y="22" width="4" height="8" rx="1" fill="#854d0e"/>
              <polygon points="16,2 24,12 20,12 26,20 6,20 12,12 8,12" fill="#22c55e"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Review Works
          </h1>
          <h2 className="mt-4 text-xl text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
        </div>

        {(error || queryError) && (
          <div className="mt-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error || queryError}
          </div>
        )}

        {!isSignUp && (
          <div className="mt-8 space-y-6">
            <button
              type="button"
              onClick={handleLoginGov}
              disabled={ssoLoading || loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ssoLoading ? 'Redirecting...' : 'Sign in with Login.gov'}
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <div className="text-xs text-gray-500 font-medium">OR</div>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || ssoLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-sm text-green-600 hover:text-green-500"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
