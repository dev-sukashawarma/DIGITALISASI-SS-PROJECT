import { fetchFullPosMenuData } from '@/lib/supabase-pos'
import MenuManagementClient from './MenuManagementClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Katalog & Harga Menu | MARCOM SS',
  description: 'Kelola harga menu multi-channel, ketersediaan, dan katalog POS Suka Shawarma',
}

export default async function MenuPage() {
  const {
    items,
    categories,
    channels,
    outlets,
    upsells,
    bestsellers,
    recommendations,
    promos,
  } = await fetchFullPosMenuData()

  return (
    <MenuManagementClient
      initialItems={items}
      categories={categories}
      channels={channels}
      outlets={outlets}
      initialUpsells={upsells}
      initialBestsellers={bestsellers}
      initialRecommendations={recommendations}
      promos={promos}
    />
  )
}
