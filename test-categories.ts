import { config } from 'dotenv'

config({ path: 'apps/admin-dashboard/.env.local' })

async function main() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?select=*`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
    }
  })
  const data = await res.json()
  console.log(data)
}

main()
