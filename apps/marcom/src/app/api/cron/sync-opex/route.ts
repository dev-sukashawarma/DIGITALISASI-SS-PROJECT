import { NextRequest, NextResponse } from 'next/server'
import { syncAllHistoricalMarcomToOpex } from '@/lib/sync-finance-opex'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Timeout up to 5 minutes for bulk syncing

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
    const result = await syncAllHistoricalMarcomToOpex()
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: result.success,
      duration: `${duration}s`,
      totalProcessed: result.totalProcessed,
      syncedEndorsements: result.syncedEndorsements,
      syncedAds: result.syncedAds,
      syncedManual: result.syncedManual,
      errorsCount: result.errorsCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Error in cron sync-opex:', err)
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Gagal menjalankan cron sync OPEX ke Finance',
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
