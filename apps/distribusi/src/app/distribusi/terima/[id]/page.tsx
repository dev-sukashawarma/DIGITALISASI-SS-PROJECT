'use client'

import { useParams } from 'next/navigation'
import { VerifikasiForm } from '@/components/distribusi/VerifikasiForm'

export default function VerifikasiPage() {
  const params = useParams()
  const id = params?.id as string

  if (!id) {
    return <p>Invalid ID</p>
  }

  return <VerifikasiForm id={id} />
}
