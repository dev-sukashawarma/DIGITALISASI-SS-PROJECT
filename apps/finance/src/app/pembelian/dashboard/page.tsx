import { Metadata } from 'next'
import { PurchasingDashboardClient } from './PurchasingDashboardClient'

export const metadata: Metadata = {
  title: 'Dashboard Purchasing - Suka Finance',
  description: 'Dashboard ringkasan untuk memantau status pengadaan barang dan tagihan (Hutang).'
}

export default function PurchasingDashboardPage() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <PurchasingDashboardClient />
    </div>
  )
}
