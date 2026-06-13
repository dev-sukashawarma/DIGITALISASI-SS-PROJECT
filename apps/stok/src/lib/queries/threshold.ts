// apps/stok/src/lib/queries/threshold.ts
import { createClient } from '@/lib/supabase'

export interface ThresholdItem {
  bahan_baku_id: string
  nama: string
  satuan: string
  kategori: string
  default_reorder_point: number
  outlet_threshold: number | null  // null = belum ada override
}

type RawThresholdRow = {
  id: string
  nama: string
  satuan: string
  kategori: string
  default_reorder_point: number
  outlet_reorder_point: Array<{ reorder_point: number }> | null
}

export async function fetchThresholds(outletId: string): Promise<ThresholdItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bahan_baku')
    .select(`
      id,
      nama,
      satuan,
      kategori,
      default_reorder_point,
      outlet_reorder_point!left(reorder_point)
    `)
    .eq('is_active', true)
    .eq('outlet_reorder_point.outlet_id', outletId)
    .order('kategori')
    .order('nama')

  if (error) throw error

  return (data || []).map((row: RawThresholdRow) => ({
    bahan_baku_id: row.id,
    nama: row.nama,
    satuan: row.satuan,
    kategori: row.kategori,
    default_reorder_point: row.default_reorder_point,
    outlet_threshold: row.outlet_reorder_point?.[0]?.reorder_point ?? null,
  }))
}

export async function upsertThreshold(
  outletId: string,
  bahanBakuId: string,
  value: number,
  updatedBy: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('outlet_reorder_point')
    .upsert(
      { outlet_id: outletId, bahan_baku_id: bahanBakuId, reorder_point: value, updated_by: updatedBy },
      { onConflict: 'outlet_id,bahan_baku_id' }
    )
  if (error) throw error
}

export async function resetThreshold(outletId: string, bahanBakuId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('outlet_reorder_point')
    .delete()
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahanBakuId)
  if (error) throw error
}
