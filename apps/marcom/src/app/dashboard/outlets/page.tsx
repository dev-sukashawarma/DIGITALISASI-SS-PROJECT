import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import OutletList, { SerializedOutlet } from './OutletList'

export const dynamic = 'force-dynamic'

export default async function OutletsPage() {
  const user = await getCurrentUser()

  const outlets = await prisma.outlet.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          endorsements: true,
          ads: true,
        },
      },
    },
  })

  // Serialize BigInt to string to safely pass to Client Component
  const serializedOutlets: SerializedOutlet[] = outlets.map((outlet: any) => ({
    id: outlet.id.toString(),
    name: outlet.name,
    createdAt: outlet.createdAt.toISOString(),
    _count: {
      endorsements: outlet._count.endorsements,
      ads: outlet._count.ads,
    },
  }))

  return (
    <OutletList
      initialOutlets={serializedOutlets}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
