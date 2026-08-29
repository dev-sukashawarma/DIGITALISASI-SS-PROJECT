import { createClient as createServerClient } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'

export const createClient = () => createSupabaseBrowserClient()

export const supabase = createSupabaseBrowserClient()

export const createServerSupabaseClient = () =>
  createServerClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '')
