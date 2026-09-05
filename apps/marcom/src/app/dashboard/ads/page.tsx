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
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const serializedAds: SerializedAd[] = ads.map((item: any) => ({
    id: item.id.toString(),
    outletId: item.outletId.toString(),
    scheduleDate: item.scheduleDate.toISOString().split('T')[0],
    budget: Number(item.budget),
    adUrl: item.adUrl,
    initialViews: item.initialViews,
    finalViews: item.finalViews,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    outlet: {
      id: item.outlet.id.toString(),
      name: item.outlet.name,
    },
  }))

  const serializedOutlets = outlets.map((o: any) => ({
    id: o.id.toString(),
    name: o.name,
  }))

  return (
    <AdsList
      initialAds={serializedAds}
      outlets={serializedOutlets}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
