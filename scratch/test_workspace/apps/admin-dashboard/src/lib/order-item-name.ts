// Saat checkout, nama item disisipi metadata relasi memakai pemisah:
//   "<Nama Produk>|ID|<cartItemId>|PARENT|<parentId>|NOTE|<catatan>"
// (lihat app/api/checkout/route.ts). Helper ini sumber-tunggal untuk
// mengurai/membersihkannya agar SEMUA halaman menampilkan nama yang rapi.

export interface ParsedItemName {
  name: string
  cartItemId: string | null
  parentId: string | null
  note: string | null
}

export function parseItemName(raw: string): ParsedItemName {
  let name = raw ?? ''
  let note: string | null = null
  let parentId: string | null = null
  let cartItemId: string | null = null

  const noteSplit = name.split('|NOTE|')
  if (noteSplit.length > 1) { note = noteSplit[1]; name = noteSplit[0] }

  const parentSplit = name.split('|PARENT|')
  if (parentSplit.length > 1) { parentId = parentSplit[1]; name = parentSplit[0] }

  const idSplit = name.split('|ID|')
  if (idSplit.length > 1) { cartItemId = idSplit[1]; name = idSplit[0] }

  return { name, cartItemId, parentId, note }
}

/** Nama produk bersih tanpa metadata. */
export function cleanItemName(raw: string): string {
  return parseItemName(raw).name
}

/** True bila item ini adalah extra/tambahan (punya parent). */
export function isExtraItem(raw: string): boolean {
  return typeof raw === 'string' && raw.includes('|PARENT|')
}
