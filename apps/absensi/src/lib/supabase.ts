import { createSupabaseBrowserClient } from '@suka/auth'
import { createClient as createServerClient } from '@supabase/supabase-js'

export const createClient = () => createSupabaseBrowserClient()

// Server-side (Edge Functions, API routes)
export const createServerSupabaseClient = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
