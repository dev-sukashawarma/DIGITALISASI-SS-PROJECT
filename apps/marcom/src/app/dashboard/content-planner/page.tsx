import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getContentTypes } from '@/app/actions/content'
import ContentPlannerView, { SerializedInternalContent } from './ContentPlannerView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Konten Planner & Insight Video',
  description: 'Pelacakan hasil video organik buatan tim kreatif internal Suka Shawarma dan analisis performa pilar konten.',
}

export default async function ContentPlannerPage() {
  const user = await getCurrentUser()

  const [contents, outlets, contentTypes] = await Promise.all([
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
    <ContentPlannerView
      initialContents={serializedContents}
      outlets={serializedOutlets}
      userRole={user?.role || 'MARCOM'}
      initialContentTypes={contentTypes.map((c) => c.name)}
    />
  )
}
