import { prisma } from '@/lib/prisma'
import type { OutletSyncPlan } from '@/lib/outletPosSync'

/** Menerapkan rencana sinkron dalam satu transaksi (urutan dipertahankan agar rename tak bentrok unik). */
export async function terapkanRencanaSinkronOutlet(plan: OutletSyncPlan) {
  if (plan.updates.length === 0 && plan.creates.length === 0) return
  await prisma.$transaction([
    ...plan.updates.map((u) => prisma.outlet.update({ where: { id: u.id }, data: u.data })),
    ...plan.creates.map((data) => prisma.outlet.create({ data })),
  ])
}
