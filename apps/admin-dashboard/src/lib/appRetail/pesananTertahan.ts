export type PesananApp = {
  id: string
  order_number: number | null
  outlet_id: string
  status: string
  kitchen_receipt_printed: boolean | null
  created_at: string
  total_amount: number
}

/**
 * Pesanan aplikasi masuk POS dengan status 'preparing' TANPA cetak dapur;
 * tombol POS "Mulai Masak" yang men-set kitchen_receipt_printed. Jadi belum
 * ditekan setelah N menit = outlet belum menyadari pesanan ini.
 */
export function tertahan(p: PesananApp, sekarang: Date, menitTertahan: number): boolean {
  if (p.status !== 'preparing' || p.kitchen_receipt_printed === true) return false
  return sekarang.getTime() - new Date(p.created_at).getTime() >= menitTertahan * 60 * 1000
}

export function urutkanPesanan(ps: PesananApp[], sekarang: Date, menitTertahan: number): PesananApp[] {
  return [...ps].sort((a, b) => {
    const ta = tertahan(a, sekarang, menitTertahan) ? 1 : 0
    const tb = tertahan(b, sekarang, menitTertahan) ? 1 : 0
    if (ta !== tb) return tb - ta
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
