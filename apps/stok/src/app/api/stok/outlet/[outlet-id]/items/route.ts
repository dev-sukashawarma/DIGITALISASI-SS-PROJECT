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

    // Fetch semua bahan_baku dulu
    const { data: bahanBaku, error: bahanError } = await supabase
      .from('bahan_baku')
      .select('id, nama, satuan, default_reorder_point');

    if (bahanError) throw bahanError;

    const bahanMap = new Map((bahanBaku || []).map((b: any) => [b.id, b]));

    // Fetch stok_balance untuk outlet ini
    const { data: stokBalance, error: stokError } = await supabase
      .from('stok_balance')
      .select('saldo, bahan_baku_id')
      .eq('outlet_id', outletId);

    if (stokError) throw stokError;

    // Transform data
    const items = (stokBalance || [])
      .map((sb: any) => {
        const bahan = bahanMap.get(sb.bahan_baku_id);
        if (!bahan) return null;

        const threshold = bahan.default_reorder_point || 10;
        const currentQty = sb.saldo || 0;
        let status: 'below' | 'warning' | 'ok' = 'ok';

        if (currentQty < threshold / 2) {
          status = 'below';
        } else if (currentQty < threshold) {
          status = 'warning';
        }

        return {
          bahan_baku_id: sb.bahan_baku_id,
          item_name: bahan.nama,
          current_qty: currentQty,
          threshold,
          satuan: bahan.satuan || 'kg',
          status,
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => {
        // Sort by status (below > warning > ok), then by name
        const statusOrder: Record<string, number> = { below: 0, warning: 1, ok: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.item_name.localeCompare(b.item_name);
      });

    // Fetch ledger history untuk setiap item
    const enrichedItems = await Promise.all(
      items.map(async (item: any) => {
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
