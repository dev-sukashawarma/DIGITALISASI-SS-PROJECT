'use server'

import { createClient } from '@/lib/supabase/server'

export async function getOpnameDetails(opnameId: string) {
  const supabase = await createClient()

  // Fetch Header
  const { data: headerData, error: headerErr } = await supabase
    .from('opname')
    .select(`
      id, outlet_id, tanggal, tipe, status, notes, created_at,
      outlet_staff!created_by ( name )
    `)
    .eq('id', opnameId)
    .single()

  if (headerErr) {
    console.error('Failed to fetch opname header', headerErr)
    throw new Error('Gagal memuat detail opname.')
  }

  const hData = headerData as any
  const header = {
    ...hData,
    outlet_staff: Array.isArray(hData.outlet_staff) ? hData.outlet_staff[0] : hData.outlet_staff
  }

  // Fetch Items
  const { data: itemsData, error: itemsErr } = await supabase
    .from('opname_item')
    .select(`
      id, bahan_baku_id, qty_fisik, qty_system, selisih, flagged, catatan,
      bahan_baku ( nama, satuan )
    `)
    .eq('opname_id', opnameId)

  if (itemsErr) {
    console.error('Failed to fetch opname items', itemsErr)
    throw new Error('Gagal memuat daftar item opname.')
  }

  const formattedItems = (itemsData as any[]).map(item => ({
    ...item,
    bahan_baku: Array.isArray(item.bahan_baku) ? item.bahan_baku[0] : item.bahan_baku
  }))

  // Sort by selisih absolute value descending to show issues at top, then alphabetically
  formattedItems.sort((a, b) => {
    const selisihA = Math.abs(Number(a.selisih) || 0)
    const selisihB = Math.abs(Number(b.selisih) || 0)
    if (selisihA !== selisihB) return selisihB - selisihA
    return a.bahan_baku.nama.localeCompare(b.bahan_baku.nama)
  })

  return {
    header,
    items: formattedItems
  }
}
