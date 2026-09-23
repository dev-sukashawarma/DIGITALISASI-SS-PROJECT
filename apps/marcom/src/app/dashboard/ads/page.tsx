import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import AdsList, { SerializedAd } from './AdsList'

export const dynamic = 'force-dynamic'

export default async function AdsPage() {
  const user = await getCurrentUser()

  const [ads, outlets] = await Promise.all([
    prisma.ad.findMany({
      orderBy: { scheduleDate: 'desc' },
      include: {
        outlet: true,
      },
    }),
    prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
  ])

  const serializedAds: SerializedAd[] = ads.map((item: any) => ({
    id: item.id.toString(),
    outletId: item.outletId ? item.outletId.toString() : null,
    category: item.category || 'MITRA',
    platform: item.platform || 'TIKTOK',
    accountName: item.accountName || null,
    scheduleDate: item.scheduleDate.toISOString().split('T')[0],
    budget: Number(item.budget || 0),
    spent: Number(item.spent || 0),
    adUrl: item.adUrl || null,
    initialViews: item.initialViews,
    finalViews: item.finalViews,
    status: item.status || 'OFF',
    createdAt: item.createdAt.toISOString(),
    outlet: item.outlet
      ? {
          id: item.outlet.id.toString(),
          name: item.outlet.name,
        }
      : null,
  }))

  const serializedOutlets = outlets.map((o: any) => ({
    id: o.id.toString(),
    name: o.name,
    type: o.type || 'INTERNAL',
  }))

  return (
    <AdsList
      initialAds={serializedAds}
      outlets={serializedOutlets}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
