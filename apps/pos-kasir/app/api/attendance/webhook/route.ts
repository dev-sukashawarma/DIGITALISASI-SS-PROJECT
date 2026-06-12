import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

let supabaseAdmin: ReturnType<typeof createServiceClient> | null = null

function getSupabaseClient() {
  if (!supabaseAdmin) {
    supabaseAdmin = createServiceClient()
  }
  return supabaseAdmin
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, outlet_id, branch_name, cashier_name } = body

    if (!email || !password || !outlet_id || !branch_name || !cashier_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const channel = supabase.channel('attendance_events')

    try {
      await new Promise((resolve, reject) => {
        // Set a timeout in case channel takes too long
        const timeout = setTimeout(() => {
          reject(new Error('Channel subscription timeout'))
        }, 5000)

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout)
            try {
              // SECURITY WARNING: Broadcasting plaintext credentials is a significant security risk.
              // In production, Realtime Row Level Security (RLS) MUST be configured to ensure
              // only authenticated and authorized clients can listen to the `attendance_events` channel.
              const res = await channel.send({
                type: 'broadcast',
                event: 'attendance_login',
                payload: { email, password, outlet_id, branch_name, cashier_name }
              })
              resolve(res)
            } catch (e) {
              reject(e)
            }
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            clearTimeout(timeout)
            reject(new Error(`Channel error: ${status}`))
          }
        })
      })
    } finally {
      await supabase.removeChannel(channel)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
