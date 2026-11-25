import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/authz'
import { ambilStatusPenutupan, apakahPembukaanDibatalkan } from '../actions'
import { PapanPenutupan } from '@/components/penutupan-outlet/PapanPenutupan'

export const dynamic = 'force-dynamic'

export default async function PapanPenutupanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { role } = await requireRole(['admin', 'owner'])
  const bolehTulis = role === 'admin' || role === 'developer'

  let status
  let pembukaanDibatalkan
  try {
    ;[status, pembukaanDibatalkan] = await Promise.all([ambilStatusPenutupan(id), apakahPembukaanDibatalkan(id)])
  } catch {
    notFound()
  }

  // Semua yang bisa membuka papan (admin/owner/developer) boleh mencentang.
  return <PapanPenutupan status={status} bolehTulis={bolehTulis} bolehCentang pembukaanDibatalkan={pembukaanDibatalkan} />
}
