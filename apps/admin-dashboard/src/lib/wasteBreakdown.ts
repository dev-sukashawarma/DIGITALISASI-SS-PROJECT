// apps/admin-dashboard/src/lib/wasteBreakdown.ts
// Agregasi murni dari baris granular get_waste_breakdown untuk 4 view
// dashboard analitik waste (per outlet, per alasan, per bahan, tren waktu).

export interface WasteBreakdownRow {
  outlet_id: string
  outlet_name: string
  reason: string
  bahan_baku_id: string
  bahan_nama: string
  tanggal: string // 'YYYY-MM-DD'
  qty: number
  nilai: number
}

export interface OutletAgg { id: string; name: string; nilai: number; qty: number }
export interface ReasonAgg { reason: string; nilai: number; qty: number }
export interface BahanAgg { id: string; name: string; nilai: number; qty: number }
export interface DateAgg { date: string; nilai: number }

export function aggregateByOutlet(rows: WasteBreakdownRow[]): OutletAgg[] {
  const map = new Map<string, OutletAgg>()
  for (const r of rows) {
    const cur = map.get(r.outlet_id) ?? { id: r.outlet_id, name: r.outlet_name, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.outlet_id, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByReason(rows: WasteBreakdownRow[]): ReasonAgg[] {
  const map = new Map<string, ReasonAgg>()
  for (const r of rows) {
    const cur = map.get(r.reason) ?? { reason: r.reason, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.reason, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByBahan(rows: WasteBreakdownRow[]): BahanAgg[] {
  const map = new Map<string, BahanAgg>()
  for (const r of rows) {
    const cur = map.get(r.bahan_baku_id) ?? { id: r.bahan_baku_id, name: r.bahan_nama, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.bahan_baku_id, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByDate(rows: WasteBreakdownRow[]): DateAgg[] {
  const map = new Map<string, DateAgg>()
  for (const r of rows) {
    const cur = map.get(r.tanggal) ?? { date: r.tanggal, nilai: 0 }
    cur.nilai += r.nilai
    map.set(r.tanggal, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}
