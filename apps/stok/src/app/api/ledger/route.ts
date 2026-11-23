import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getCachedLedgerTransaksi } from '@suka/cache';
import { periksaAksesLedger } from '@/lib/stok/aksesLedgerApi.server';

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

    // Wajib login + outlet dalam scope pemanggil: data dibaca dengan
    // service-role client (bypass RLS), jadi tanpa ini staf mana pun bisa
    // membaca ledger outlet lain lewat ?outletId=.
    const akses = await periksaAksesLedger(supabase, outletId);
    if (!akses.ok) {
      return NextResponse.json({ success: false, error: akses.error }, { status: akses.status });
    }

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
