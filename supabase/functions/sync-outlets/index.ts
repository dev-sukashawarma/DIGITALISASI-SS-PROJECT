import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const ecosystemUrl = Deno.env.get('ECOSYSTEM_SUPABASE_URL')
const ecosystemServiceKey = Deno.env.get('ECOSYSTEM_SERVICE_ROLE_KEY')
const suiteUrl = Deno.env.get('SUPABASE_URL')
const suiteServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!ecosystemUrl || !ecosystemServiceKey || !suiteUrl || !suiteServiceKey) {
  throw new Error('Missing required environment variables')
}

const ecosystemClient = createClient(ecosystemUrl, ecosystemServiceKey)
const suiteClient = createClient(suiteUrl, suiteServiceKey)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const startTime = Date.now()

  try {
    // Fetch outlets from Ecosystem
    const { data: outlets, error: fetchError } = await ecosystemClient
      .from('outlets')
      .select('id, slug, name, address, lat, lng, type, is_active, created_at, updated_at')
      .eq('is_active', true)
      .limit(100)

    if (fetchError) throw fetchError

    if (!outlets || outlets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No active outlets found' }),
        { status: 200 }
      )
    }

    // Upsert into Suite project
    const { error: upsertError, data: upserted } = await suiteClient
      .from('outlets')
      .upsert(outlets, { onConflict: 'id' })
      .select()

    if (upsertError) throw upsertError

    const duration = Date.now() - startTime

    // Log success
    await suiteClient.from('sync_log').insert({
      function_name: 'sync-outlets',
      status: 'success',
      error_message: null,
      last_run_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        synced: upserted?.length || 0,
        duration: `${duration}ms`,
        message: `Synced ${upserted?.length || 0} outlets`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Log failure
    await suiteClient
      .from('sync_log')
      .insert({
        function_name: 'sync-outlets',
        status: 'failed',
        error_message: errorMsg,
        last_run_at: new Date().toISOString(),
      })
      .catch(() => {}) // Ignore log errors

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
