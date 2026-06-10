'use client'

import { useParams } from 'next/navigation'
import { SuratJalanDetail } from '@/components/distribusi/SuratJalanDetail'

export default function SuratJalanDetailPage() {
  const params = useParams()
  const id = params?.id as string

  if (!id) {
    return <p>Invalid ID</p>
  }

  return <SuratJalanDetail id={id} />
}
