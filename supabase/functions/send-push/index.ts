import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'npm:web-push@3.6.7'

const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@sukashawarma.com'
const VAPID_PUBLIC_KEY = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || 'BMLoQBbriWY03kgcC8yF4XO7W_K9RdmN0Lbgl1Vu1OWe_NGyvWrnAFA-2xwsfjNPpFv0WGB-dYxfgKWKftehlTI'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'dHji5xK3Y3CqDc55P7GWKgtTaWQ-KmODw9JLNxLRloM'

webPush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, outlet_id, title, body, url, app, broadcast, target_roles } = await req.json()

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (title, body)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    if (!user_id && !outlet_id && !broadcast) {
       return new Response(
        JSON.stringify({ error: 'Must provide user_id, outlet_id, or broadcast flag' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Query subscriptions
    let query = supabase.from('push_subscriptions').select('*, outlet_staff!inner(outlet_id, role)')

    if (!broadcast) {
      if (user_id) {
        query = query.eq('user_id', user_id)
      } else if (outlet_id) {
        query = query.eq('outlet_staff.outlet_id', outlet_id)
        if (target_roles && Array.isArray(target_roles) && target_roles.length > 0) {
          query = query.in('outlet_staff.role', target_roles)
        }
      }
    }

    // Optionally filter by app
    if (app) {
      query = query.eq('app', app)
    }

    const { data: subscriptions, error } = await query

    if (error) {
      throw error
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webPush.sendNotification(pushSubscription, payload)
          return { status: 'fulfilled', endpoint: sub.endpoint }
        } catch (e: any) {
          // Clean up invalid or expired subscriptions
          if (e.statusCode === 404 || e.statusCode === 410) {
            console.log(`Subscription ${sub.endpoint} has expired or is no longer valid. Deleting...`)
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
          }
          throw e
        }
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.length - successCount

    return new Response(
      JSON.stringify({
        message: `Sent push notification`,
        successCount,
        failCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
