import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { fetchPosOutlets } from '@/lib/supabase-pos'
import { rencanakanSinkronOutlet } from '@/lib/outletPosSync'
import { terapkanRencanaSinkronOutlet } from '@/lib/outletPosSyncServer'
import OutletList, { SerializedOutlet } from './OutletList'

export const dynamic = 'force-dynamic'

export default async function OutletsPage() {
  const [user, outlets, posOutlets] = await Promise.all([
    getCurrentUser(),
    prisma.outlet.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            endorsements: true,
            ads: true,
          },
        },
      },
    }),
    fetchPosOutlets(),
  ])

  // Nama/tipe outlet diedit di admin (tabel outlets POS) — selaraskan salinan MARCOM
  // setiap halaman dibuka. Biasanya nol baris berubah, jadi tak ada query tulis.
  const plan = rencanakanSinkronOutlet(posOutlets, outlets, 'otomatis')
  if (plan.updates.length > 0) {
    try {
      await terapkanRencanaSinkronOutlet(plan)
    } catch (err) {
      console.error('Auto-sync outlet dari POS gagal:', err)
    }
  }
  const perubahan = new Map(plan.updates.map((u) => [u.id, u.data]))
  const outletsTerkini = outlets
    .map((o) => ({ ...o, ...perubahan.get(o.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  // Serialize BigInt to string to safely pass to Client Component
  const serializedOutlets: SerializedOutlet[] = outletsTerkini.map((outlet: any) => ({
    id: outlet.id.toString(),
    name: outlet.name,
    type: outlet.type || 'INTERNAL',
    posOutletId: outlet.posOutletId || null,
    posName: outlet.posName || null,
    posType: outlet.posType || null,
    region: outlet.region || null,
    address: outlet.address || null,
    phone: outlet.phone || null,
    isActive: outlet.isActive ?? true,
    createdAt: outlet.createdAt.toISOString(),
    _count: {
      endorsements: outlet._count.endorsements,
      ads: outlet._count.ads,
    },
  }))

  return (
    <OutletList
      initialOutlets={serializedOutlets}
      posOutlets={posOutlets}
      userRole={user?.role || 'MARCOM'}
    />
  )
}

