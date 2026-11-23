import { NextRequest, NextResponse } from 'next/server';
import { invalidateLedgerCache } from '@suka/cache';
import { createServerSupabaseClient } from '@/lib/supabase';
import { periksaAksesLedger } from '@/lib/stok/aksesLedgerApi.server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let outletId: string | undefined;
    try {
      const body = await req.json();
      outletId = typeof body?.outletId === 'string' && body.outletId ? body.outletId : undefined;
    } catch {
      // Body might be empty, invalidate for all outlets
    }

    // Wajib login. Dengan outletId: outlet harus dalam scope pemanggil.
    // Tanpa outletId (kosongkan cache SEMUA outlet): hanya role pusat.
    const akses = await periksaAksesLedger(createServerSupabaseClient(), outletId);
    if (!akses.ok) {
      return NextResponse.json({ success: false, error: akses.error }, { status: akses.status });
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
