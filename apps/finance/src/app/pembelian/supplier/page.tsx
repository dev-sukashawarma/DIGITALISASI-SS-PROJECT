import { HalamanSupplier } from '@suka/master-data'
import { MasterDataFinance } from '@/components/MasterDataFinance'

export const dynamic = 'force-dynamic'

// Layar yang sama persis dengan admin-dashboard (paket @suka/master-data).
export default function Page() {
  return (
    <MasterDataFinance>
      <HalamanSupplier />
    </MasterDataFinance>
  )
}
