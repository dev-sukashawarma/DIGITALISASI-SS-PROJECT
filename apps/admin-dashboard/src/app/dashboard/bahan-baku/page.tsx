import { Suspense } from 'react'
import { Spinner } from '@suka/design-system'
import { MasterBahanPage } from '@suka/master-data'
import { MasterDataAdmin } from '@/components/MasterDataAdmin'

// useSearchParams di MasterBahanPage wajib dibungkus Suspense agar build produksi lolos.
export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <MasterDataAdmin>
        <MasterBahanPage />
      </MasterDataAdmin>
    </Suspense>
  )
}
