'use server'
import { createClient } from '@supabase/supabase-js'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface ResepMenu {
  id: string
  nama: string
}

export interface CalculatedBahan {
  bahan_baku_id: string
  nama_bahan: string
  satuan: string
  kebutuhan: number
  sisa_stok: number
  saran_qty: number
}

// ---------------------------------------------------------------------------
// fetchActiveResep — ambil daftar resep menu yang aktif
// ---------------------------------------------------------------------------
export async function fetchActiveResep(outletId: string): Promise<ResepMenu[]> {
  const supabase = makeServiceClient()
  
  const { data, error } = await supabase
    .from('resep')
    .select('id, nama')
    .eq('is_active', true)
    .or(`scope.eq.global,and(scope.eq.outlet,outlet_id.eq.${outletId})`)
    .order('nama')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// calculateBahanBakuRequest — kalkulasi via RPC
// ---------------------------------------------------------------------------
export async function calculateBahanBakuRequest(
  outletId: string,
  targets: { resep_id: string; qty_target: number }[]
): Promise<CalculatedBahan[]> {
  if (targets.length === 0) return []
  
  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('calculate_bahan_baku_request', {
    p_outlet_id: outletId,
    p_targets: targets,
  })

  if (error) throw new Error(error.message)
  return data ?? []
}
