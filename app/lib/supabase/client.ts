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

export function createClient() {
  const supabaseUrl = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_URL) 
    || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_ANON_KEY) 
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(supabaseUrl, supabaseKey);
}
