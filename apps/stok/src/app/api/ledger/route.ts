import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getCachedLedgerTransaksi } from '@suka/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outletId');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!outletId) {
      return NextResponse.json(
        { success: false, error: 'outletId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const data = await getCachedLedgerTransaksi(supabase, outletId, page, forceRefresh);

    return NextResponse.json({
      success: true,
      data,
      page,
      outletId,
    });
  } catch (error: any) {
    console.error('[API /api/ledger] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
