import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const SukaDrinkId = 'ed4510dc-11a7-4fd1-b37f-16a99a72b609' // ID for Suka Drink
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SERVICE_KEY) {
    console.error('Missing service key')
    return
  }

  // Fetch Orange Jus
  const res = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?name=eq.Orange%20Jus`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    }
  })
  const menu = await res.json()
  console.log('Found Orange Jus:', menu)

  if (menu && menu.length > 0) {
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?id=eq.${menu[0].id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ category_id: SukaDrinkId })
    })
    const updated = await updateRes.json()
    console.log('Updated:', updated)
  }
}

main()
