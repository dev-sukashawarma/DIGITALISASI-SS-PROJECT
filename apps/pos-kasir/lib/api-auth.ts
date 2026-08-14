import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Resolves the caller for both the browser's Supabase cookie session and the
 * Android client's short-lived Bearer access token. Privileged routes still
 * authorize roles/outlets server-side; this function never trusts a user id
 * supplied by the client.
 */
export async function resolveApiUser(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()
    if (token) {
      const { data, error } = await createServiceClient().auth.getUser(token)
      if (!error && data.user) return data.user
    }
  }

  const cookieClient = await createClient()
  const { data } = await cookieClient.auth.getUser()
  return data.user ?? null
}
