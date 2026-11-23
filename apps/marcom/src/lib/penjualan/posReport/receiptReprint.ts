/* Label status struk di Histori Transaksi Laporan POS.
 *
 * - receiptStatusLabels: tercetak / tidak dicetak (crew menekan "Lewati & Tutup") /
 *   dicetak susulan (dilewati lalu dicetak ulang dari kartu order).
 * - receiptReprintLabels: "dicetak Nx" untuk struk yang dicetak lebih dari sekali.
 *
 * Hitungan diisi RPC record_receipt_print setiap kali tablet kasir berhasil
 * mengirim struk ke printer (cetak pertama di layar "Order Berhasil" + cetak ulang
 * dari kartu tab Selesai). Label hanya muncul bila lebih dari sekali, jadi order
 * lama / dari APK lama (hitungan 0) tidak pernah berlabel.
 *
 * Catatan: Order Food Apps (GoFood, GrabFood, ShopeeFood, TikTok Go, dll)
 * tidak dideteksi sebagai struk tidak dicetak (hanya order Offline & Website).
 */
export type ReceiptReprintLabel = { kind: 'customer' | 'kitchen'; count: number; text: string }

type ReceiptFields = {
  channel?: string | null
  sales_source?: string | null
  customer_receipt_print_count?: number | null
  kitchen_receipt_print_count?: number | null
  customer_receipt_skipped?: boolean | null
  kitchen_receipt_skipped?: boolean | null
}

const FOOD_APP_RECEIPT_IGNORE = new Set([
  'gofood',
  'gojek',
  'go_food',
  '1284ac2a-e753-4380-9f32-59219a322459',
  'grabfood',
  'grab',
  'grab_food',
  'shopeefood',
  'shopee',
  'shopee_food',
  'tiktokgo',
  'tiktok',
  'tiktok_go',
  'generic_food_app',
  'food_apps',
  'foodapp',
  'food_app',
  'tiktok_shop',
  'tiktokshop',
  'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
  'shopee_shop',
  'shopeeseller',
  'shopee_seller',
  'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
])

export function isIgnoredFoodAppReceiptOrder(order: Pick<ReceiptFields, 'channel' | 'sales_source'>): boolean {
  const ch = (order.channel || '').trim().toLowerCase()
  const src = (order.sales_source || '').trim().toLowerCase()
  return FOOD_APP_RECEIPT_IGNORE.has(ch) || FOOD_APP_RECEIPT_IGNORE.has(src)
}

export function receiptReprintLabels(order: ReceiptFields): ReceiptReprintLabel[] {
  const labels: ReceiptReprintLabel[] = []
  const customer = Number(order.customer_receipt_print_count) || 0
  const kitchen = Number(order.kitchen_receipt_print_count) || 0
  if (customer > 1) labels.push({ kind: 'customer', count: customer, text: `Struk customer dicetak ${customer}x` })
  if (kitchen > 1) labels.push({ kind: 'kitchen', count: kitchen, text: `Struk dapur dicetak ${kitchen}x` })
  return labels
}

export type ReceiptStatusLabel = { tone: 'ok' | 'late' | 'skipped'; text: string }

type KindStatus = 'printed' | 'late' | 'skipped' | 'unknown'

function kindStatus(
  count: number | null | undefined,
  skipped: boolean | null | undefined,
  ignoreSkip = false
): KindStatus {
  const printed = (Number(count) || 0) > 0
  const effectiveSkip = ignoreSkip ? false : Boolean(skipped)
  if (printed) return effectiveSkip ? 'late' : 'printed'
  return effectiveSkip ? 'skipped' : 'unknown'
}

const KIND_NAME = { customer: 'customer', kitchen: 'dapur' } as const

function phrase(kinds: (keyof typeof KIND_NAME)[], suffix: string) {
  return kinds.length === 2 ? `Struk ${suffix}` : `Struk ${KIND_NAME[kinds[0]]} ${suffix}`
}

/** Order lama / dari APK lama (belum pernah tercatat cetak maupun lewati) tidak berlabel.
 *  Order Food Apps tidak pernah dideteksi sebagai struk tidak dicetak. */
export function receiptStatusLabels(order: ReceiptFields): ReceiptStatusLabel[] {
  const ignoreSkip = isIgnoredFoodAppReceiptOrder(order)
  const status = {
    customer: kindStatus(order.customer_receipt_print_count, order.customer_receipt_skipped, ignoreSkip),
    kitchen: kindStatus(order.kitchen_receipt_print_count, order.kitchen_receipt_skipped, ignoreSkip),
  }
  const kinds = ['customer', 'kitchen'] as const
  const skipped = kinds.filter((k) => status[k] === 'skipped')
  const late = kinds.filter((k) => status[k] === 'late')
  const printed = kinds.filter((k) => status[k] === 'printed')

  const labels: ReceiptStatusLabel[] = []
  if (skipped.length > 0) labels.push({ tone: 'skipped', text: phrase(skipped, 'tidak dicetak') })
  if (late.length > 0) labels.push({ tone: 'late', text: phrase(late, 'dicetak susulan') })
  if (labels.length === 0 && printed.length > 0) labels.push({ tone: 'ok', text: 'Struk tercetak' })
  return labels
}

/* Filter "Status Struk" di Histori Transaksi. */
export const RECEIPT_FILTERS = ['all', 'not_printed', 'reprinted'] as const
export type ReceiptFilter = (typeof RECEIPT_FILTERS)[number]

export const RECEIPT_FILTER_LABEL: Record<ReceiptFilter, string> = {
  all: 'Semua Status Struk',
  not_printed: 'Tidak cetak struk',
  reprinted: 'Struk dicetak > 1x',
}

export function toReceiptFilter(value: unknown): ReceiptFilter {
  return (RECEIPT_FILTERS as readonly unknown[]).includes(value) ? (value as ReceiptFilter) : 'all'
}

/**
 * - not_printed: ada struk yang dilewati crew dan belum pernah dicetak (label merah).
 *   Struk yang dicetak susulan tidak ikut, karena akhirnya tercetak.
 * - reprinted: struk customer atau dapur dicetak lebih dari sekali.
 */
export function matchesReceiptFilter(order: ReceiptFields, filter: ReceiptFilter): boolean {
  if (filter === 'not_printed') return receiptStatusLabels(order).some((l) => l.tone === 'skipped')
  if (filter === 'reprinted') return receiptReprintLabels(order).length > 0
  return true
}

/* Riwayat waktu cetak (tabel order_receipt_prints), dimuat saat label diklik. */
export type ReceiptPrintLogRow = { kind: 'customer' | 'kitchen'; printed_at: string; printed_by_name: string | null }
export type ReceiptPrintTimeline = {
  entries: { nth: number; printedAt: string; by: string | null }[]
  /** Cetakan yang terjadi sebelum log ada (hitungan > jumlah baris log). */
  untracked: number
}

/**
 * Baris log satu jenis struk, diberi nomor cetak ke-N. Cetakan lama yang tidak punya
 * baris log dihitung sebagai cetak paling awal, jadi nomor log dimulai setelahnya.
 */
export function receiptPrintTimeline(
  logs: ReceiptPrintLogRow[],
  kind: 'customer' | 'kitchen',
  totalCount: number
): ReceiptPrintTimeline {
  const rows = logs
    .filter((l) => l.kind === kind)
    .sort((a, b) => a.printed_at.localeCompare(b.printed_at))
  const untracked = Math.max(0, (Number(totalCount) || 0) - rows.length)
  return {
    untracked,
    entries: rows.map((r, i) => ({ nth: untracked + i + 1, printedAt: r.printed_at, by: r.printed_by_name })),
  }
}

/* Satu chip per jenis struk (Customer, Dapur) untuk tabel Histori Transaksi:
 * status + jumlah cetak digabung, menggantikan label terpisah. */
export type ReceiptChip = {
  kind: 'customer' | 'kitchen'
  name: 'Customer' | 'Dapur'
  tone: 'ok' | 'late' | 'skipped'
  status: string
  count: number
}

export function receiptChips(order: ReceiptFields): ReceiptChip[] {
  const chips: ReceiptChip[] = []
  const ignoreSkip = isIgnoredFoodAppReceiptOrder(order)
  const kinds = [
    ['customer', 'Customer', order.customer_receipt_print_count, order.customer_receipt_skipped],
    ['kitchen', 'Dapur', order.kitchen_receipt_print_count, order.kitchen_receipt_skipped],
  ] as const
  for (const [kind, name, rawCount, skipped] of kinds) {
    const count = Number(rawCount) || 0
    const s = kindStatus(count, skipped, ignoreSkip)
    if (s === 'unknown') continue
    chips.push({
      kind,
      name,
      count,
      tone: s === 'printed' ? 'ok' : s,
      status: s === 'skipped' ? 'Tidak dicetak' : s === 'late' ? 'Dicetak susulan' : 'Tercetak',
    })
  }
  return chips
}
