import { Suspense } from 'react'
import { SuratJalanList } from '@/components/distribusi/SuratJalanList'

export default function SuratJalanListPage() {
  return (
    <Suspense fallback={null}>
      <SuratJalanList />
    </Suspense>
  )
}
