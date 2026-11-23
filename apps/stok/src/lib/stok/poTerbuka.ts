// Daftar PO yang masih menunggu diterima gudang (halaman Penerimaan PO & badge
// "Terima PO").
//
// Dulu kedua pemakai meminta RPC get_purchase_orders untuk tanggal_po 30 hari
// terakhir lalu menyaring status di klien → PO terbuka yang berumur >30 hari
// (mis. PO 28 Sep berstatus sebagian_diterima) hilang dari halaman dan badge.
// Batas atasnya juga tanggal UTC, sehingga PO hari ini tak muncul sebelum
// 07.00 WIB. Kini RPC diminta per status terbuka dengan p_from & p_to NULL
// (RPC: "p_from IS NULL OR ..."), jadi umur PO tak lagi menentukan.

export const STATUS_PO_TERBUKA = ['dikirim_ke_supplier', 'sebagian_diterima'] as const

export interface KlienRpcPo {
  rpc: (
    fn: 'get_purchase_orders',
    args: { p_from: null; p_to: null; p_status: string }
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export async function ambilPoTerbuka<T extends { id: string; status: string; created_at?: string | null }>(
  supabase: KlienRpcPo
): Promise<T[]> {
  const hasil = await Promise.all(
    STATUS_PO_TERBUKA.map(async (status) => {
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: null,
        p_to: null,
        p_status: status,
      })
      if (error) throw new Error(error.message)
      return (Array.isArray(data) ? data : []) as T[]
    })
  )

  const perId = new Map<string, T>()
  for (const po of hasil.flat()) {
    if (!(STATUS_PO_TERBUKA as readonly string[]).includes(po.status)) continue
    if (!perId.has(po.id)) perId.set(po.id, po)
  }

  // Urutan sama dengan RPC (created_at terbaru di atas).
  return [...perId.values()].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
}
