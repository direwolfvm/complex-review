import { createBrowserClient } from '@supabase/ssr';

// Read from runtime-injected config first, fall back to build-time env vars
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    };
  }
}

// Cache the client instance to avoid recreating on every call
let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_URL)
    || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    // Only handle in browser context
    if (typeof window !== 'undefined') {
      // Check if we've already tried to reload (prevent infinite loop)
      const urlParams = new URLSearchParams(window.location.search);
      const reloadAttempt = urlParams.get('_reload');

      if (!reloadAttempt) {
        // First attempt: clear caches and reload with cache-busting param
        console.warn('Missing Supabase environment variables. Attempting cache-busting reload...');

        // Clear service worker caches if available
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }

        // Reload with cache-busting parameter
        const separator = window.location.search ? '&' : '?';
        window.location.href = window.location.href.split('?')[0] +
          separator + '_reload=' + Date.now() +
          (window.location.search ? '&' + window.location.search.slice(1) : '');

        // Return a dummy object to prevent immediate crash while redirecting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {} as any;
      }

      // Already tried reloading - show user-friendly message
      console.error('Missing Supabase environment variables after reload. Please clear your browser cache and try again.');

      // Return a dummy client that won't crash but will fail gracefully on API calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any;
    }

    // Server-side: throw as before (this shouldn't happen in normal operation)
    throw new Error('Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cachedClient = createBrowserClient<any>(supabaseUrl, supabaseKey);
  return cachedClient;
}
