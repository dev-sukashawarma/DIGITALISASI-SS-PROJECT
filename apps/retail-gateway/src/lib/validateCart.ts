import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

export const JUMLAH_MAKS_PER_ITEM = 99

export type MasalahKeranjang = {
  menu_item_id: string
  name: string
  jenis: 'habis' | 'harga_berubah' | 'tidak_ada'
  harga_baru?: number
}

/**
 * Menjaga jumlah pesanan tetap masuk akal SEBELUM harga dihitung.
 * Tanpa ini, klien yang dibongkar bisa mengirim jumlah negatif atau pecahan
 * dan menghasilkan total yang aneh -- modul harga sengaja murni dan tidak
 * memvalidasi masukan, jadi penjagaan itu tugas lapisan ini.
 */
export function jumlahWajar(items: ItemPesanan[]): boolean {
  return items.every(
    (it) =>
      Number.isInteger(it.quantity) &&
      it.quantity >= 1 &&
      it.quantity <= JUMLAH_MAKS_PER_ITEM
  )
}

/**
 * Membandingkan keranjang aplikasi dengan katalog yang baru dibaca dari
 * produksi. Mengembalikan SEMUA masalah, bukan berhenti di yang pertama --
 * pelanggan harus melihat seluruhnya sekaligus, bukan satu per satu.
 */
export function periksaKeranjang(
  items: ItemPesanan[],
  katalog: MenuApp[]
): MasalahKeranjang[] {
  const peta = new Map(katalog.map((m) => [m.id, m]))
  const masalah: MasalahKeranjang[] = []
  // Deduplikasi per (menu_item_id, jenis): keranjang bisa mengirim menu_item_id
  // yang sama lebih dari sekali (topping sama di 2 menu, atau menu sama dengan
  // catatan berbeda). Tanpa deduplikasi, klien menerima masalah kembar.
  const terlihat = new Set<string>()

  for (const it of items) {
    const menu = peta.get(it.menu_item_id)

    if (!menu) {
      const kunci = `${it.menu_item_id}:tidak_ada`
      if (!terlihat.has(kunci)) {
        terlihat.add(kunci)
        masalah.push({ menu_item_id: it.menu_item_id, name: it.name, jenis: 'tidak_ada' })
      }
      continue
    }
    if (!menu.is_available) {
      const kunci = `${it.menu_item_id}:habis`
      if (!terlihat.has(kunci)) {
        terlihat.add(kunci)
        masalah.push({ menu_item_id: it.menu_item_id, name: menu.name, jenis: 'habis' })
      }
      continue
    }
    if (menu.price !== it.unit_price) {
      const kunci = `${it.menu_item_id}:harga_berubah`
      if (!terlihat.has(kunci)) {
        terlihat.add(kunci)
        masalah.push({
          menu_item_id: it.menu_item_id,
          name: menu.name,
          jenis: 'harga_berubah',
          harga_baru: menu.price,
        })
      }
    }
  }

  return masalah
}
