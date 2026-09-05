import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import EndorsementList, { SerializedEndorsement } from './EndorsementList'

export const dynamic = 'force-dynamic'

export default async function EndorsementsPage() {
  const user = await getCurrentUser()

  const [endorsements, outlets, kols] = await Promise.all([
    prisma.endorsement.findMany({
      orderBy: { scheduleDate: 'desc' },
      include: {
        kol: true,
        outlet: true,
      },
    }),
    prisma.outlet.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.kol.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const serializedEndorsements: SerializedEndorsement[] = endorsements.map((item: any) => ({
    id: item.id.toString(),
    kolId: item.kolId.toString(),
    outletId: item.outletId.toString(),
    scheduleDate: item.scheduleDate.toISOString().split('T')[0],
    rateCard: Number(item.rateCard),
    postUrl: item.postUrl,
    initialViews: item.initialViews,
    finalViews: item.finalViews,
    visitStatus: item.visitStatus,
    postStatus: item.postStatus,
    createdAt: item.createdAt.toISOString(),
    kol: {
      id: item.kol.id.toString(),
      name: item.kol.name,
      tiktokUrl: item.kol.tiktokUrl,
      instagramUrl: item.kol.instagramUrl,
      phoneNumber: item.kol.phoneNumber,
    },
    outlet: {
      id: item.outlet.id.toString(),
      name: item.outlet.name,
    },
  }))

  const serializedOutlets = outlets.map((o: any) => ({
    id: o.id.toString(),
    name: o.name,
  }))

  const serializedKols = kols.map((k: any) => ({
    id: k.id.toString(),
    name: k.name,
  }))

  return (
    <EndorsementList
      initialEndorsements={serializedEndorsements}
      outlets={serializedOutlets}
      kols={serializedKols}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
