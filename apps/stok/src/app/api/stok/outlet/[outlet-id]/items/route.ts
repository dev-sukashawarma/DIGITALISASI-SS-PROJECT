import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ 'outlet-id': string }> }
) {
  const { 'outlet-id': outletId } = await params;

  if (!outletId) {
    return NextResponse.json({ error: 'outlet-id diperlukan' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    // Fetch items untuk outlet ini dari monitoring_view_spv
    const { data: items, error: itemsError } = await supabase
      .from('monitoring_view_spv')
      .select('*')
      .eq('outlet_id', outletId)
      .order('item_name');

    if (itemsError) throw itemsError;

    // Fetch ledger history untuk setiap item
    const enrichedItems = await Promise.all(
      (items || []).map(async (item) => {
        const { data: ledger, error: ledgerError } = await supabase
          .from('ledger_stok')
          .select('tipe, qty, catatan, created_at')
          .eq('outlet_id', outletId)
          .eq('bahan_baku_id', item.bahan_baku_id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (ledgerError) {
          console.error(`Gagal fetch ledger untuk item ${item.bahan_baku_id}:`, ledgerError);
          return { ...item, recent_ledger: [] };
        }

        return {
          ...item,
          recent_ledger: ledger || [],
        };
      })
    );

    return NextResponse.json(enrichedItems);
  } catch (error) {
    console.error('Error fetching outlet items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memuat data' },
      { status: 500 }
    );
  }
}
