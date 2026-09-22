import { NextRequest, NextResponse } from 'next/server';
import { invalidateLedgerCache } from '@suka/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let outletId: string | undefined;
    try {
      const body = await req.json();
      outletId = body?.outletId;
    } catch {
      // Body might be empty, invalidate for all outlets
    }

    await invalidateLedgerCache(outletId);

    return NextResponse.json({
      success: true,
      invalidated: outletId || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/ledger/invalidate] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
