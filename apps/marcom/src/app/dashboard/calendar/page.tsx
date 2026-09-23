import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import CalendarView, {
  CalendarEndorsement,
  CalendarAd,
  CalendarPromoEvent,
} from './CalendarView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Kalender Marcom',
  description: 'Jadwal kolaborasi KOL, iklan digital mitra, dan agenda promo event cabang Suka Shawarma.',
}

export default async function CalendarPage() {
  const user = await getCurrentUser()

  const [endorsements, ads, promoEvents, outlets, kols] = await Promise.all([
    prisma.endorsement.findMany({
      orderBy: { scheduleDate: 'asc' },
      include: {
        kol: { select: { id: true, name: true } },
        outlet: { select: { id: true, name: true } },
      },
    }),
    prisma.ad.findMany({
      orderBy: { scheduleDate: 'asc' },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    }),
    prisma.promoEvent.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    }),
    prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.kol.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const serializedEndorsements: CalendarEndorsement[] = endorsements.map((item: any) => ({
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
    kolName: item.kol?.name || 'Unknown KOL',
    outletName: item.outlet?.name || 'Unknown Outlet',
  }))

  const serializedAds: CalendarAd[] = ads.map((item: any) => ({
    id: item.id.toString(),
    outletId: item.outletId.toString(),
    scheduleDate: item.scheduleDate.toISOString().split('T')[0],
    budget: Number(item.budget),
    adUrl: item.adUrl,
    initialViews: item.initialViews,
    finalViews: item.finalViews,
    status: item.status,
    outletName: item.outlet?.name || 'Unknown Outlet',
  }))

  const serializedPromoEvents: CalendarPromoEvent[] = promoEvents.map((item: any) => ({
    id: item.id.toString(),
    title: item.title,
    description: item.description,
    outletId: item.outletId ? item.outletId.toString() : null,
    outletName: item.outlet?.name || 'Semua Cabang (Nasional)',
    startDate: item.startDate.toISOString().split('T')[0],
    endDate: item.endDate.toISOString().split('T')[0],
    type: item.type,
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
    <CalendarView
      initialEndorsements={serializedEndorsements}
      initialAds={serializedAds}
      initialPromoEvents={serializedPromoEvents}
      outlets={serializedOutlets}
      kols={serializedKols}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
