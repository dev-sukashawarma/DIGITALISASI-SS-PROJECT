import { Suspense } from 'react'
import { prisma, withDbRetry } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getVideoAnalysesAction } from '@/app/actions/video-analysis'
import VideoAnalysisClient from './VideoAnalysisClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Analisis Video AI - Konten Planner MARCOM',
  description: 'Evaluasi pro, kontra, hook, food appeal, dan retensi draf video internal Suka Shawarma menggunakan AI.',
}

export default async function VideoAnalysisPage() {
  const user = await getCurrentUser()

  const [initialAnalyses, internalContents] = await withDbRetry(
    () =>
      Promise.all([
        getVideoAnalysesAction(),
        prisma.internalContent.findMany({
          orderBy: { postDate: 'desc' },
          take: 50,
          select: {
            id: true,
            title: true,
            platform: true,
            status: true,
            pillar: true,
            postDate: true,
          },
        }),
      ]),
    { retries: 2, delayMs: 300, label: 'VideoAnalysisPage' }
  )

  const serializedContents = internalContents.map((c) => ({
    id: c.id.toString(),
    title: c.title,
    platform: c.platform,
    status: c.status,
    pillar: c.pillar,
    postDate: c.postDate.toISOString().split('T')[0],
  }))

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-stone-500 font-medium animate-pulse">
          Memuat modul Analisis Video AI...
        </div>
      }
    >
      <VideoAnalysisClient
        initialAnalyses={initialAnalyses}
        internalContents={serializedContents}
        userRole={user?.role || 'MARCOM'}
      />
    </Suspense>
  )
}
