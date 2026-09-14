// Label nama bahan di layar verifikasi terima: bahan yang dipecah beberapa vendor
// dalam satu surat jalan diberi nama vendor supaya crew tak melihat baris kembar.
export type ItemLabel = { id: string; bahan_baku_id: string; bahan_baku?: { nama?: string | null } | null; vendor?: { nama?: string | null } | null }

export function namaVendorTampil(nama: string): string {
  return nama.replace(/\s*-\s*Tempo\s*\d+\s*$/i, '')
}

export function labelNamaBahan(items: ItemLabel[]): Record<string, string> {
  const jumlah = new Map<string, number>()
  for (const it of items) jumlah.set(it.bahan_baku_id, (jumlah.get(it.bahan_baku_id) ?? 0) + 1)
  const hasil: Record<string, string> = {}
  for (const it of items) {
    const nama = it.bahan_baku?.nama ?? ''
    const vendor = it.vendor?.nama
    hasil[it.id] = (jumlah.get(it.bahan_baku_id) ?? 0) > 1 && vendor ? `${nama} · ${namaVendorTampil(vendor)}` : nama
  }
  return hasil
}
