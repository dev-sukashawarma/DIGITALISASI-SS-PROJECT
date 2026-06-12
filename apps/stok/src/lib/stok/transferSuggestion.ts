import type { MonitoringItem } from '@/lib/types/monitoring'

export interface TransferSuggestion {
  bahan_baku_id: string
  item_name: string
  satuan: string
  donorOutletId: string
  donorOutletName: string
  recipientOutletId: string
  recipientOutletName: string
  qty: number
  recipientStatus: 'below' | 'warning'
}

/**
 * Suggest cross-outlet transfers: pair surplus outlets with critical
 * (below/warning) outlets on the same item. Greedy allocation that never
 * drops a donor below its own threshold.
 */
export function computeTransferSuggestions(
  items: MonitoringItem[]
): TransferSuggestion[] {
  const byItem = new Map<string, MonitoringItem[]>()
  for (const item of items) {
    const list = byItem.get(item.bahan_baku_id) ?? []
    list.push(item)
    byItem.set(item.bahan_baku_id, list)
  }

  const suggestions: TransferSuggestion[] = []
  const severityRank = (s: string) => (s === 'below' ? 0 : 1)

  for (const group of byItem.values()) {
    const recipients = group
      .filter((i) => i.status === 'below' || i.status === 'warning')
      .map((i) => ({ item: i, need: i.threshold - i.current_qty }))
      .filter((r) => r.need > 0)
      .sort(
        (a, b) =>
          severityRank(a.item.status) - severityRank(b.item.status) ||
          b.need - a.need
      )

    const donors = group
      .filter((i) => i.current_qty > i.threshold)
      .map((i) => ({ item: i, surplus: i.current_qty - i.threshold }))
      .sort((a, b) => b.surplus - a.surplus)

    for (const recipient of recipients) {
      let remaining = recipient.need
      for (const donor of donors) {
        if (remaining <= 0) break
        if (donor.surplus <= 0) continue
        const qty = Math.min(remaining, donor.surplus)
        if (qty <= 0) continue
        suggestions.push({
          bahan_baku_id: recipient.item.bahan_baku_id,
          item_name: recipient.item.item_name,
          satuan: recipient.item.satuan,
          donorOutletId: donor.item.outlet_id,
          donorOutletName: donor.item.outlet_name,
          recipientOutletId: recipient.item.outlet_id,
          recipientOutletName: recipient.item.outlet_name,
          qty,
          recipientStatus: recipient.item.status as 'below' | 'warning',
        })
        donor.surplus -= qty
        remaining -= qty
      }
    }
  }

  const severityRankOut = (s: 'below' | 'warning') => (s === 'below' ? 0 : 1)
  suggestions.sort(
    (a, b) =>
      severityRankOut(a.recipientStatus) - severityRankOut(b.recipientStatus) ||
      a.item_name.localeCompare(b.item_name)
  )

  return suggestions
}
