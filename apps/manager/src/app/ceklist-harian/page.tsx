import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { mengisiCeklist, ROLE_CEKLIST } from '@/lib/ceklist-harian'
import CeklistIsiClient from './CeklistIsiClient'
import CeklistPantauClient from './CeklistPantauClient'

/**
 * Satu rute, dua wajah — sama dengan native: area manager mengisi, regional
 * manager (dan admin/owner) memantau & menyetujui. Kewenangan sebenarnya dijaga
 * RLS + RPC di database; cek role di sini hanya untuk tampilan.
 */
export default async function CeklistHarianPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  if (!staff) return null
  if (!ROLE_CEKLIST.includes(staff.role)) {
    return <p className="p-8 text-center text-sm font-bold text-suka-gray-500">Ceklist harian hanya untuk area manager dan regional manager.</p>
  }
  return mengisiCeklist(staff.role)
    ? <CeklistIsiClient staffId={staff.id} role={staff.role} />
    : <CeklistPantauClient staffId={staff.id} role={staff.role} />
}
