import { fetchOutletsList, getSalesReferenceData } from '@/app/actions/sales-reference'
import SalesReferenceView from './SalesReferenceView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Referensi Data Penjualan • Konten Planner',
  description: 'Ranking outlet berdasarkan omzet kotor dan ranking penjualan item POS Suka Shawarma.',
}

export default async function SalesReferencePage() {
  const [outlets, initialData] = await Promise.all([
    fetchOutletsList(),
    getSalesReferenceData({ period: 'thisMonth', outletId: 'ALL' }),
  ])

  return (
    <SalesReferenceView
      initialData={initialData}
      outlets={outlets}
    />
  )
}
