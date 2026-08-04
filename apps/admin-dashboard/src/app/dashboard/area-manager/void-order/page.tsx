import { getVoidOrders } from '@/app/actions/cancellations'
import VoidOrderClient from './VoidOrderClient'
import { PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function VoidOrderPage() {
  const result = await getVoidOrders()
  const requests = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Pembatalan Pesanan (Void Order)" 
        description="Kelola pengajuan pembatalan pesanan dari kasir."
      />

      {!result.success && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          Gagal mengambil data: {result.error}
        </div>
      )}

      {result.success && <VoidOrderClient initialRequests={requests} />}
    </div>
  )
}
