import { Suspense } from 'react'
import { Spinner } from '@suka/design-system'
import { MasterBahanPage } from '@/components/master-bahan/MasterBahanPage'

// useSearchParams di MasterBahanPage wajib dibungkus Suspense agar build produksi lolos.
export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <MasterBahanPage />
    </Suspense>
  )
}
