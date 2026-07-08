import { createClient } from '@/lib/supabase/server'
import RecommendationsClient, { type RecommendationSettings } from './RecommendationsClient'

export const dynamic = 'force-dynamic'

const PUSAT_OUTLET_ID = '11111111-1111-1111-1111-111111111111'

export default async function RecommendationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('outlet_staff').select('outlet_id').eq('id', user.id).single()
    : { data: null }
  const outletId = profile?.outlet_id || PUSAT_OUTLET_ID

  const { data: settingsRows } = await supabase
    .from('kiosk_settings')
    .select('key, value')
    .eq('outlet_id', outletId)
    .in('key', ['upsell_ids', 'unavailable_menu_ids', 'recommendation_ids'])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  let unavIds: string[] = []
  let upIds: string[] = []
  let recIds: string[] = []

  settingsRows?.forEach(s => {
    if (s.key === 'unavailable_menu_ids') unavIds = parseIds(s.value)
    if (s.key === 'upsell_ids') upIds = parseIds(s.value)
    if (s.key === 'recommendation_ids') recIds = parseIds(s.value)
  })

  const settings: RecommendationSettings = { recIds, upIds, unavIds }

  return <RecommendationsClient settings={settings} />
}
