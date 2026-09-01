
/** Batas potongan. Rem darurat untuk kombinasi promo yang tidak terduga. */
export const MAKS_POTONGAN_PERSEN = 50

export type ItemPesanan = {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  note?: string
}

export type RincianHarga = {
  subtotal: number
  discountAmount: number
  total: number
}

export function hitungTotal(
  items: ItemPesanan[],
  diskonPersen: number
): RincianHarga {
  const subtotal = items.reduce(
    (jumlah, it) => jumlah + it.unit_price * it.quantity,
    0
  )

  const persenEfektif = Math.min(Math.max(diskonPersen, 0), MAKS_POTONGAN_PERSEN)
  const discountAmount = Math.round((subtotal * persenEfektif) / 100)

  return { subtotal, discountAmount, total: subtotal - discountAmount }
}
