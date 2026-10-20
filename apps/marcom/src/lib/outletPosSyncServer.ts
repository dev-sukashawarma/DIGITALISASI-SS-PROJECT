import { prisma } from '@/lib/prisma'
import { fetchPosOutlets } from '@/lib/supabase-pos'
import { rencanakanSinkronOutlet, type OutletSyncPlan } from '@/lib/outletPosSync'

const AUTO_SYNC_TTL_MS = 30_000
let lastAutoSyncAt = 0
let inFlightAutoSync: Promise<void> | null = null

/** Menerapkan rencana sinkron dalam satu transaksi (urutan dipertahankan agar rename tak bentrok unik). */
export async function terapkanRencanaSinkronOutlet(plan: OutletSyncPlan) {
  if (plan.updates.length === 0 && plan.creates.length === 0) return
  await prisma.$transaction([
    ...plan.updates.map((u) => prisma.outlet.update({ where: { id: u.id }, data: u.data })),
    ...plan.creates.map((data) => prisma.outlet.create({ data })),
  ])
}

/**
 * Penyelarasan otomatis dengan pembatas interval (30 detik) agar halaman lain
 * (Endorsements, Ads, Budget, Calendar) juga langsung mendapatkan outlet POS baru
 * tanpa membebani database di setiap perpindahan tab.
 */
export async function pastikanOutletPosTersinkron(): Promise<void> {
  const now = Date.now()
  if (now - lastAutoSyncAt < AUTO_SYNC_TTL_MS) return
  if (inFlightAutoSync) return inFlightAutoSync

  inFlightAutoSync = (async () => {
    try {
      const [posOutlets, marcomOutlets] = await Promise.all([
        fetchPosOutlets(),
        prisma.outlet.findMany({
          select: {
            id: true,
            name: true,
            type: true,
            posOutletId: true,
            posName: true,
            posType: true,
            region: true,
            address: true,
            phone: true,
            isActive: true,
          },
        }),
      ])
      if (posOutlets.length === 0) return
      const plan = rencanakanSinkronOutlet(posOutlets, marcomOutlets, 'otomatis')
      if (plan.updates.length > 0 || plan.creates.length > 0) {
        await terapkanRencanaSinkronOutlet(plan)
      }
      lastAutoSyncAt = Date.now()
    } catch (err) {
      console.error('Auto-sync outlet dari POS gagal:', err)
    } finally {
      inFlightAutoSync = null
    }
  })()

  return inFlightAutoSync
}
