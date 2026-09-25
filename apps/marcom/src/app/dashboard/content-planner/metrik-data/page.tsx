import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getContentTypes } from '@/app/actions/content'
import { getLastVideoSyncTime } from '@/app/actions/sync'
import ContentMetricsView, { SerializedInternalContent } from '../ContentMetricsView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Metrik Data Konten',
  description: 'Analisis performa mendalam jangkauan reach, views, interaksi, dan rasio EBR% video internal Suka Shawarma.',
}

export default async function ContentMetricsPage() {
  const user = await getCurrentUser()

  const [contents, outlets, contentTypes, lastSyncedAt] = await Promise.all([
    prisma.internalContent.findMany({
      orderBy: { postDate: 'desc' },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    }),
    prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    getContentTypes(),
    getLastVideoSyncTime(),
  ])

  const serializedContents: SerializedInternalContent[] = contents.map((item: any) => ({
    id: item.id.toString(),
    title: item.title,
    platform: item.platform,
    pillar: item.pillar,
    contentType: item.contentType || null,
    format: item.format || 'VIDEO',
    goal: item.goal || null,
    status: item.status || 'POSTED',
    isAds: item.isAds ?? false,
    creator: item.creator,
    outletId: item.outletId ? item.outletId.toString() : null,
    outletName: item.outlet?.name || 'Official',
    postUrl: item.postUrl,
    postDate: item.postDate.toISOString().split('T')[0],
    postTime: item.postTime || null,
    reach: item.reach || 0,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    saves: item.saves,
    followersBaseline: item.followersBaseline || null,
    groupId: item.groupId || null,
    createdAt: item.createdAt.toISOString(),
  }))

  const serializedOutlets = outlets.map((o: any) => ({
    id: o.id.toString(),
    name: o.name,
  }))

  return (
    <ContentMetricsView
      initialContents={serializedContents}
      outlets={serializedOutlets}
      userRole={user?.role || 'VIEWER'}
      initialContentTypes={contentTypes.map((c) => c.name)}
      initialLastSyncedAt={lastSyncedAt}
    />
  )
}
