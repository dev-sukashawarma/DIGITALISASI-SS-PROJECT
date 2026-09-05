import { cleanItemName } from './order-item-name'

/**
 * Peta "nama menu bersih" -> menu_items.id untuk order yang masuk dari luar
 * (pemesanan web / order-system), yang hanya mengirim NAMA menu.
 *
 * Kenapa perlu: aplikasi pemesanan web memakai database Supabase TERPISAH
 * dengan id menu sendiri, jadi id-nya tidak bisa dipakai langsung di pos-kasir.
 * Dulu jalannya `menu_item_id: null` -- dan itu punya dua akibat yang tidak
 * kelihatan:
 *   1. Trigger BOM `trg_process_bom_stok` melewati item ber-menu_item_id NULL
 *      (`IF rec.menu_item_id IS NULL THEN CONTINUE`), sehingga bahan baku
 *      pesanan web TIDAK PERNAH dipotong dari stok. Terbukti Agustus 2026:
 *      98 order web menghasilkan 0 baris `ledger_stok`, sementara 200 order
 *      biasa menghasilkan 3.334 baris.
 *   2. Laporan yang mencari HPP lewat id menghitungnya Rp 0, sehingga laba
 *      terlihat lebih besar (sempat menggeser bagi hasil mitra Rp 3,98 juta
 *      untuk Agustus 2026 saja).
 *
 * Aman dicocokkan lewat nama: nama menu di pos-kasir unik setelah dibersihkan
 * dari metadata checkout ("Nama|ID|..|PARENT|..|NOTE|..").
 */
export function buildMenuNameIndex(
  menuRows: { id: string; name: string | null }[] | null | undefined
): Map<string, string> {
  const index = new Map<string, string>()
  for (const row of menuRows ?? []) {
    if (!row?.name) continue
    const key = cleanItemName(row.name).trim().toLowerCase()
    // Baris pertama menang -- deterministik kalau kelak ada nama kembar.
    if (key && !index.has(key)) index.set(key, row.id)
  }
  return index
}

/** null bila nama tidak dikenal -- ingest tidak boleh gagal karenanya. */
export function resolveMenuItemId(
  index: Map<string, string>,
  rawName: string | null | undefined
): string | null {
  if (!rawName) return null
  return index.get(cleanItemName(rawName).trim().toLowerCase()) ?? null
}
