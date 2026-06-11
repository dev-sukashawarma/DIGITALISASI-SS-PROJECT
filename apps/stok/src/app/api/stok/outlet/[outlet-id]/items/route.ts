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

    // Fetch ALL items untuk outlet ini — direct query dari stok_balance + join
    // (lebih reliable daripada dari view yang mungkin punya filter)
    const { data: items, error: itemsError } = await supabase
      .from('stok_balance')
      .select(`
        saldo as current_qty,
        bahan_baku_id,
        bahan_baku(nama as item_name, satuan, default_reorder_point)
      `)
      .eq('outlet_id', outletId)
      .order('bahan_baku(nama)');

    if (itemsError) throw itemsError;

    // Transform data & determine status
    const transformedItems = (items || []).map((item: any) => {
      const threshold = item.bahan_baku?.default_reorder_point || 10;
      const currentQty = item.current_qty || 0;
      let status: 'below' | 'warning' | 'ok' = 'ok';

      if (currentQty < threshold / 2) {
        status = 'below';
      } else if (currentQty < threshold) {
        status = 'warning';
      }

      return {
        bahan_baku_id: item.bahan_baku_id,
        item_name: item.bahan_baku?.item_name || 'Unknown',
        current_qty: currentQty,
        threshold,
        satuan: item.bahan_baku?.satuan || 'kg',
        status,
      };
    });

    // Fetch ledger history untuk setiap item
    const enrichedItems = await Promise.all(
      transformedItems.map(async (item) => {
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
