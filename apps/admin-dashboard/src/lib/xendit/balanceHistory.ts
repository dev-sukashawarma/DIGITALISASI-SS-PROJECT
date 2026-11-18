import Papa from 'papaparse'

/** Satu pembayaran masuk dari file "Balance History" Xendit. */
export type BarisXendit = {
  xenditId: string
  xenditRef: string
  refQris: string | null
  nominal: number
  /** ISO UTC, dari kolom "Payment Date" (zona dari kolom "Time Zone", bawaan +07). */
  dibayarAt: string
  channel: string
  /** Bukan penjualan Suka Shawarma: produk lain di akun Xendit yang sama (PR-…) atau transaksi uji (< Rp 1.000). */
  bukanPenjualan: boolean
}

const KOLOM_WAJIB = ['Transaction ID', 'Line Type', 'Debit or Credit', 'Amount', 'Payment Date', 'Reference']
const BULAN: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

/** "28 Oct 2026, 18:26:08" + offset menit → ISO UTC. */
function keIso(teks: string, offsetMenit: number): string | null {
  const m = /^(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2}):(\d{2})$/.exec(teks.trim())
  if (!m || BULAN[m[2]] === undefined) return null
  const utc = Date.UTC(+m[3], BULAN[m[2]], +m[1], +m[4], +m[5], +m[6]) - offsetMenit * 60_000
  return new Date(utc).toISOString()
}

/** "'+0700 UTC" → 420. Kosong / tak terbaca → 420 (WIB). */
function offsetDari(tz: string | undefined): number {
  const m = /([+-])(\d{2})(\d{2})/.exec(tz ?? '')
  if (!m) return 420
  return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3])
}

export function parseBalanceHistory(csv: string): BarisXendit[] {
  const { data, meta } = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
  })
  const hilang = KOLOM_WAJIB.filter(k => !meta.fields?.includes(k))
  if (hilang.length) {
    throw new Error(`Bukan file Balance History Xendit (kolom hilang: ${hilang.join(', ')})`)
  }

  const hasil: BarisXendit[] = []
  for (const r of data) {
    if (r['Line Type'] !== 'TRANSACTION' || r['Debit or Credit'] !== 'CREDIT') continue
    const dibayarAt = keIso(r['Payment Date'] ?? '', offsetDari(r['Time Zone']))
    if (!dibayarAt) continue
    const nominal = Number(r['Amount'])
    const xenditRef = (r['Reference'] ?? '').trim()
    hasil.push({
      xenditId: r['Transaction ID'].trim(),
      xenditRef,
      refQris: (r['Channel Reference'] ?? '').trim() || null,
      nominal,
      dibayarAt,
      channel: (r['Payment Channel'] ?? '').trim(),
      bukanPenjualan: /^PR-/i.test(xenditRef) || nominal < 1000,
    })
  }
  return hasil
}
