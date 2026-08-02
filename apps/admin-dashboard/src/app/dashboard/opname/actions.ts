'use server'

import { createClient } from '@/lib/supabase/server'

export async function getOpnamesData(fromDate: string, toDate: string, outletId: string) {
  const supabase = await createClient()

  // Prepare start and end boundaries in UTC corresponding to WIB
  const start = new Date(`${fromDate}T00:00:00+07:00`).toISOString()
  const end = new Date(`${toDate}T23:59:59+07:00`).toISOString()

  let query = supabase
    .from('opname')
    .select(`
      id,
      tanggal,
      tipe,
      status,
      created_at,
      outlets!inner ( id, name ),
      outlet_staff!created_by ( name ),
      opname_item ( selisih )
    `)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })

  if (outletId !== 'ALL') {
    query = query.eq('outlet_id', outletId)
  }

  const { data: opnames, error } = await query

  if (error) {
    console.error('Failed to fetch opnames', error)
    throw new Error('Gagal memuat data opname.')
  }

  // Format data and calculate stats
  const formattedOpnames = (opnames || []).map((op: any) => {
    const items = op.opname_item || []
    const totalItem = items.length
    const totalSelisih = items.filter((i: any) => Number(i.selisih) !== 0).length
    
    return {
      id: op.id,
      tanggal: op.tanggal,
      created_at: op.created_at,
      tipe: op.tipe,
      status: op.status,
      outletName: Array.isArray(op.outlets) ? op.outlets[0]?.name : op.outlets?.name,
      staffName: Array.isArray(op.outlet_staff) ? op.outlet_staff[0]?.name : op.outlet_staff?.name,
      totalItem,
      totalSelisih
    }
  })

  return formattedOpnames
}
