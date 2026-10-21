import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasPlaceholderConfig = [supabaseUrl, supabaseAnonKey].some(
  (value) =>
    typeof value === 'string' &&
    /(your-project-ref|your-supabase-anon-key|replace[-_ ]?me|placeholder)/i.test(value),
)

if (!supabaseUrl || !supabaseAnonKey || hasPlaceholderConfig) {
  throw new Error(
    'Supabase configuration is missing or still has example values. Set the real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase Project Settings → API in .env.local, then restart Vite.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
