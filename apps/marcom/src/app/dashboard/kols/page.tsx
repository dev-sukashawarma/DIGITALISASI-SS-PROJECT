import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import KolList, { SerializedKol } from './KolList'

export const dynamic = 'force-dynamic'

export default async function KolsPage() {
  const user = await getCurrentUser()

  const kols = await prisma.kol.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          endorsements: true,
        },
      },
    },
  })

  const serializedKols: SerializedKol[] = kols.map((kol: any) => ({
    id: kol.id.toString(),
    name: kol.name,
    tiktokUrl: kol.tiktokUrl,
    instagramUrl: kol.instagramUrl,
    phoneNumber: kol.phoneNumber,
    bankAccount: kol.bankAccount,
    createdAt: kol.createdAt.toISOString(),
    _count: {
      endorsements: kol._count.endorsements,
    },
  }))

  return (
    <KolList
      initialKols={serializedKols}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
