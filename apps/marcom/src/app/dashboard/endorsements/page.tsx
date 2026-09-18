import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { fetchPosMenuItems } from '@/lib/supabase-pos'
import { syncClaimedEndorsements } from '@/app/actions/endorsements'
import EndorsementList, { SerializedEndorsement } from './EndorsementList'

export const dynamic = 'force-dynamic'

export default async function EndorsementsPage() {
  const user = await getCurrentUser()

  // Sinkronisasi otomatis klaim POS yang berstatus CLAIMED
  await syncClaimedEndorsements()

  const [endorsements, outlets, kols, posMenuItems] = await Promise.all([
    prisma.endorsement.findMany({
      orderBy: { scheduleDate: 'desc' },
      include: {
        kol: true,
        outlet: true,
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.outlet.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        posOutletId: true,
        posName: true,
        posType: true,
        region: true,
        isActive: true,
      },
    }),
    prisma.kol.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phoneNumber: true, bankAccount: true },
    }),
    fetchPosMenuItems(),
  ])

  const serializedEndorsements: SerializedEndorsement[] = endorsements.map((item: any) => {
    const rateCard = Number(item.rateCard || 0)
    const hppMenu = Number(item.hppMenu || 0)
    const shippingCost = Number(item.shippingCost || 0)
    const totalCost = rateCard + hppMenu + shippingCost

    return {
      id: item.id.toString(),
      kolId: item.kolId.toString(),
      outletId: item.outletId.toString(),
      scheduleDate: item.scheduleDate.toISOString().split('T')[0],
      rateCard,
      menuGiven: item.menuGiven || null,
      menuItems: item.menuItems || null,
      hppMenu,
      shippingCost,
      totalCost,
      posOrderId: item.posOrderId || null,
      posOrderNumber: item.posOrderNumber || null,
      type: item.type || 'VISIT',
      shippingAddress: item.shippingAddress || null,
      recipientName: item.recipientName || null,
      courierResi: item.courierResi || null,
      isShipped: item.isShipped ?? false,
      shippingDate: item.shippingDate ? item.shippingDate.toISOString().split('T')[0] : null,
      postUrl: item.postUrl,
      initialViews: item.initialViews,
      finalViews: item.finalViews,
      likes: item.likes ?? 0,
      comments: item.comments ?? 0,
      shares: item.shares ?? 0,
      saves: item.saves ?? 0,
      visitStatus: item.visitStatus,
      postStatus: item.postStatus,
      draftStatus: item.draftStatus || 'PENDING',
      paymentStatus: item.paymentStatus || 'UNPAID',
      paymentDate: item.paymentDate ? item.paymentDate.toISOString().split('T')[0] : null,
      paymentNotes: item.paymentNotes || null,
      bankAccountCustom: item.bankAccountCustom || null,
      createdAt: item.createdAt.toISOString(),
      posts: (item.posts || []).map((p: any) => ({
        id: p.id.toString(),
        endorsementId: p.endorsementId.toString(),
        platform: p.platform,
        customPlatformName: p.customPlatformName,
        postUrl: p.postUrl,
        status: p.status,
        views: p.views || 0,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        saves: p.saves || 0,
        postedAt: p.postedAt ? p.postedAt.toISOString().split('T')[0] : null,
      })),
      kol: {
        id: item.kol.id.toString(),
        name: item.kol.name,
        tiktokUrl: item.kol.tiktokUrl,
        instagramUrl: item.kol.instagramUrl,
        youtubeUrl: item.kol.youtubeUrl,
        facebookUrl: item.kol.facebookUrl,
        threadsUrl: item.kol.threadsUrl,
        phoneNumber: item.kol.phoneNumber,
        bankAccount: item.kol.bankAccount,
      },
      outlet: {
        id: item.outlet.id.toString(),
        name: item.outlet.name,
        type: item.outlet.type || 'INTERNAL',
      },
    }
  })

  const serializedOutlets = outlets.map((o: any) => ({
    id: o.id.toString(),
    name: o.name,
    type: o.type || 'INTERNAL',
    posOutletId: o.posOutletId || null,
    posName: o.posName || null,
    posType: o.posType || null,
    region: o.region || null,
    isActive: o.isActive ?? true,
  }))

  const serializedKols = kols.map((k: any) => ({
    id: k.id.toString(),
    name: k.name,
    phoneNumber: k.phoneNumber || null,
    bankAccount: k.bankAccount || null,
  }))

  return (
    <EndorsementList
      initialEndorsements={serializedEndorsements}
      outlets={serializedOutlets}
      kols={serializedKols}
      userRole={user?.role || 'MARCOM'}
      posMenuItems={posMenuItems}
    />
  )
}
