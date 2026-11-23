/* ── Data ekspor PDF Histori Transaksi Detail ────────────────────────────────
 *
 * Murni (tanpa React/Next/Supabase). Mengubah baris transaksi hasil filter tabel
 * (compute.ts: filterTableData + computeTableFooter) menjadi payload ringkas
 * agar pengiriman dari Server Action ke browser tetap ringan dan siap cetak PDF.
 */

import { cleanItemName } from '@/lib/laba-rugi/order-item-name'
import { resolveOrderSource } from '@/lib/laba-rugi/order-source'
import { isBigOrder } from '@/lib/penjualan/big-order'
import { extractOrderPackages, type OrderRow } from '@/lib/penjualan/posReport/compute'
import { receiptChips } from '@/lib/penjualan/posReport/receiptReprint'
import { rupiah } from '@/lib/penjualan/posReport/eksporUi'

export const MAX_HISTORI_PDF_ROWS = 5000

export interface HistoriTableFooter {
  totalGross: number
  totalNet: number
  totalOfflineDiscount: number
  totalAppSubsidy: number
  totalMerchantDeductions: number
  totalPlatformSubsidy: number
  totalEcommerceDiscount: number
  totalItems: number
}

export interface EksporHistoriRow {
  id: string
  orderNumberLabel: string
  createdAt: string
  outletName: string
  customerName: string | null
  cashierName: string | null
  itemsText: string
  packagesText: string
  sourceLabel: string
  paymentMethod: string
  totalAmount: number
  originalAmount: number | null
  deductionNotes: string[]
  promoBadges: string[]
  receiptNote: string | null
  hasSkippedReceipt: boolean
}

export interface PosHistoryExportReport {
  periode: { from: string; to: string }
  isSSOnlineSelected: boolean
  totalMatching: number
  truncated: boolean
  footer: HistoriTableFooter
  rows: EksporHistoriRow[]
}

export function buildHistoriTransaksiExport(params: {
  tableRows: OrderRow[]
  footer: HistoriTableFooter
  outlets: { id: string; name?: string | null }[]
  periode: { from: string; to: string }
  isSSOnlineSelected: boolean
  maxRows?: number
}): PosHistoryExportReport {
  const {
    tableRows,
    footer,
    outlets,
    periode,
    isSSOnlineSelected,
    maxRows = MAX_HISTORI_PDF_ROWS,
  } = params

  const outletNameMap = new Map<string, string>()
  for (const o of outlets) {
    if (o?.id) outletNameMap.set(o.id, o.name || 'Outlet')
  }

  const totalMatching = tableRows.length
  const limit = Math.max(1, maxRows)
  const slice = totalMatching > limit ? tableRows.slice(0, limit) : tableRows
  const truncated = totalMatching > slice.length

  const rows: EksporHistoriRow[] = slice.map((order) => {
    const anyOrder = order as any
    const items = order.order_items || []
    const orderSubtotal = items.reduce(
      (sum, i) => sum + (Number(i.subtotal) || Number(i.quantity) * Number(i.unit_price) || 0),
      0
    )
    const totalAmount = Number(order.total_amount) || 0
    const offlineDiscount = Number(anyOrder.discount_amount) || 0
    const appSubsidy = Number(anyOrder.promo_subsidy) || 0
    const settlementPromoMerchant: number | undefined = anyOrder.settlement_promo_merchant
    const isEcommerce = order.outlet_id === 'ss-online' || isSSOnlineSelected
    const orderIsBigOrder = isBigOrder(anyOrder)
    const itemPromoDiscount = orderSubtotal > totalAmount ? orderSubtotal - totalAmount : 0

    let originalAmount: number | null = null
    const deductionNotes: string[] = []

    if (isEcommerce) {
      if (orderSubtotal > totalAmount) originalAmount = orderSubtotal
      if (itemPromoDiscount > 0) deductionNotes.push(`Diskon: -${rupiah(itemPromoDiscount)}`)
      if (offlineDiscount > 0) deductionNotes.push(`Biaya Platform: -${rupiah(offlineDiscount)}`)
    } else {
      if (offlineDiscount > 0) {
        originalAmount = totalAmount + offlineDiscount
        deductionNotes.push(`${orderIsBigOrder ? 'Diskon Big Order 15%' : 'Diskon'}: -${rupiah(offlineDiscount)}`)
      }
      if (appSubsidy > 0) {
        if (settlementPromoMerchant !== undefined && settlementPromoMerchant !== appSubsidy) {
          if (settlementPromoMerchant > 0) {
            deductionNotes.push(`Promo Toko: -${rupiah(settlementPromoMerchant)}`)
          }
        } else {
          deductionNotes.push(`Diskon Promo: -${rupiah(appSubsidy)}`)
        }
      }
    }

    const itemsText = items
      .map((i) => {
        const clean = cleanItemName(i.menu_item_name)
        return `${i.quantity}x ${i.is_promo_reward ? `Gratis · ${clean}` : clean}`
      })
      .join('\n')

    const pkgs = isSSOnlineSelected ? [] : extractOrderPackages(order)
    const packagesText = pkgs
      .map((pkg) => {
        const choicesEntries = pkg.choices ? Object.entries(pkg.choices) : []
        const choicesStr =
          choicesEntries.length > 0
            ? ` (${choicesEntries.map(([k, v]) => `${k}: ${v}`).join(', ')})`
            : ''
        return `${pkg.qty}x ${pkg.name}${choicesStr}`
      })
      .join('\n')

    const promoBadges: string[] = []
    if (orderIsBigOrder) {
      promoBadges.push('Big Order -15%')
    }
    if (Array.isArray(anyOrder.scheduled_promo_names)) {
      for (const name of anyOrder.scheduled_promo_names) {
        if (name) promoBadges.push(String(name))
      }
    }
    const rewardItem = items.find((i) => i.is_promo_reward)
    if (rewardItem?.promo_name) {
      promoBadges.push(
        `BUY ${rewardItem.promo_buy_quantity ?? 1} GET ${rewardItem.promo_get_quantity ?? 1}`
      )
    }

    const chips = isSSOnlineSelected ? [] : receiptChips(order)
    const hasSkippedReceipt = chips.some((c) => c.tone === 'skipped')
    const receiptNote =
      chips.length > 0
        ? chips
            .map((c) => {
              const label = c.name === 'Customer' ? 'Cust' : 'Dapur'
              return c.tone === 'skipped' ? `${label}: Tidak cetak` : `${label}: Cetak (${c.count}x)`
            })
            .join(' | ')
        : null

    const outletName =
      order.outlet_id === 'ss-online'
        ? 'SS Online'
        : outletNameMap.get(order.outlet_id) || 'Outlet'

    const sourceLabel = resolveOrderSource(
      order.channel,
      order.sales_source,
      order.customer_name,
      order.is_endorse
    ).label

    return {
      id: order.id,
      orderNumberLabel: `#${order.order_number || 'ECOM'}`,
      createdAt: order.created_at,
      outletName,
      customerName: order.customer_name || null,
      cashierName: order.cashier_name || null,
      itemsText: itemsText || '-',
      packagesText: packagesText || '-',
      sourceLabel,
      paymentMethod: (order.payment_method || '-').toUpperCase(),
      totalAmount,
      originalAmount,
      deductionNotes,
      promoBadges,
      receiptNote,
      hasSkippedReceipt,
    }
  })

  return {
    periode,
    isSSOnlineSelected,
    totalMatching,
    truncated,
    footer,
    rows,
  }
}
