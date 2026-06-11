'use client'

import { useParams } from 'next/navigation'
import { RiwayatDetail } from '@/components/distribusi/RiwayatDetail'

export default function RiwayatDetailPage() {
  const params = useParams()
  const id = params?.id as string
  if (!id) return <p>Invalid ID</p>
  return <RiwayatDetail id={id} />
}
