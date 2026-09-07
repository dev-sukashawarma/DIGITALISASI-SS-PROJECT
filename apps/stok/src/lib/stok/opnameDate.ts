// Tanggal hari ini dalam WIB (UTC+7) format "YYYY-MM-DD", timezone-safe.
export function getTodayWIB(): string {
  const now = new Date()
  const wibOffset = 7 * 60 // menit
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000)
  return wibNow.toISOString().slice(0, 10)
}

export async function getEffectiveTodayWIB(outletId: string, supabase: any): Promise<string> {
  const today = getTodayWIB()
  if (outletId === '62a56103-2085-4dd5-9d25-a3c0cffc88ff' && today === '2026-08-21') {
    // Cileungsi exception: check if there's a finalized opname for Aug 20
    const { data } = await supabase.from('opname')
      .select('id')
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-08-20')
      .eq('status', 'finalized')
      .limit(1)
      .maybeSingle()
    if (!data) return '2026-08-20'
  }
  
  if (outletId === '550e8400-e29b-41d4-a716-446655440002' && today === '2026-08-24') {
    // Empang exception: check if there are 2 finalized opnames for Aug 23
    const { count } = await supabase.from('opname')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-08-23')
      .eq('status', 'finalized')
    if ((count ?? 0) < 2) return '2026-08-23'
  }
  
  if (outletId === '550e8400-e29b-41d4-a716-446655440003' && today === '2026-08-26') {
    // Paledang exception: check if there is a finalized opname for Aug 25
    const { count } = await supabase.from('opname')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-08-25')
      .eq('status', 'finalized')
    if ((count ?? 0) < 1) return '2026-08-25'
  }
  
  if (outletId === '550e8400-e29b-41d4-a716-446655440010' && today === '2026-08-30') {
    // Jatiwaringin exception: check if there is a finalized opname for Aug 29
    const { count } = await supabase.from('opname')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-08-29')
      .eq('status', 'finalized')
    if ((count ?? 0) < 1) return '2026-08-29'
  }
  
  if (outletId === 'd9a2ef93-c298-4501-a471-1c5e2b3dff08' && (today === '2026-09-03' || today === '2026-09-09')) {
    // Cicurug exception: check if there is a finalized opname for Sep 2
    const { count } = await supabase.from('opname')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-09-02')
      .eq('status', 'finalized')
    if ((count ?? 0) < 1) return '2026-09-02'
  }

  // 6 September 2026 catch-up: Cibinong, Pekayon, BNR, Dramaga, Jatiwaringin
  // Jika belum opname finalized untuk 5 September, input pertama masuk ke 5 September.
  // Setelah itu, opname kedua otomatis masuk ke 6 September.
  const CATCHUP_OUTLETS_SEP5 = [
    '550e8400-e29b-41d4-a716-446655440014', // MITRA CIBINONG
    '550e8400-e29b-41d4-a716-446655440018', // MITRA PEKAYON
    '550e8400-e29b-41d4-a716-446655440001', // SUKA SHAWARMA BNR
    '550e8400-e29b-41d4-a716-446655440013', // SUKA SHAWARMA DRAMAGA
    '550e8400-e29b-41d4-a716-446655440010', // SUKA SHAWARMA JATIWARINGIN
  ]
  if (CATCHUP_OUTLETS_SEP5.includes(outletId) && today === '2026-09-06') {
    const { count } = await supabase.from('opname')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', outletId)
      .eq('tanggal', '2026-09-05')
      .eq('status', 'finalized')
    if ((count ?? 0) < 1) return '2026-09-05'
  }

  return today
}
