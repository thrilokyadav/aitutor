import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseAnonKey);

if (!SUPABASE_ENABLED) {
  // Don't throw at import-time in production builds; log a clear warning instead.
  // The app can still run without Supabase features.
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and persistence features will be disabled.');
}

// Note: We still construct a client object; callers must check SUPABASE_ENABLED before invoking network methods.
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'invalid');
