import { NextRequest, NextResponse } from 'next/server'
import { syncAllActiveVideos } from '@/app/actions/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow up to 5 minutes for scraping multiple videos

async function handleSync(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  // If CRON_SECRET is configured, check Authorization header or query param
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const queryKey = request.nextUrl.searchParams.get('key')
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      )
    }
  }

  const startTime = Date.now()
  try {
    const report = await syncAllActiveVideos(true)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: report.success,
      message: report.message,
      duration: `${duration}s`,
      totalProcessed: report.totalProcessed,
      updatedCount: report.updatedCount,
      failedCount: report.failedCount,
      details: report.details,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Gagal menjalankan cron sync video',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}
