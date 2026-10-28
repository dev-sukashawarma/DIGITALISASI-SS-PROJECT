/**
 * Modul Query Dinamis untuk J.A.R.V.I.S.
 * Menangani permintaan data dengan rentang tanggal fleksibel (contoh: 7 hari, 10 hari kebelakang,
 * tanggal spesifik, atau rentang tanggal kustom) secara real-time dari Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import { formatRupiah } from './telemetriNyata'

export type TopikQueryDinamis = 'waste' | 'penjualan' | 'opex' | 'semua'

export interface PermintaanTanggalDinamis {
  jenis: 'rentang_hari' | 'tanggal_spesifik' | 'rentang_tanggal'
  topik: TopikQueryDinamis
  startDateIso: string
  endDateIso: string
  tglAwalStr: string
  tglAkhirStr: string
  labelPeriode: string
  jumlahHari?: number
}

const NAMA_BULAN_INDO: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, agt: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,
}

const NAMA_BULAN_LABEL = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

let cachedPriceMap: { map: Record<string, number>; timestamp: number } | null = null
const PRICE_MAP_TTL_MS = 10 * 60 * 1000

async function muatPriceMap(): Promise<Record<string, number>> {
  const now = Date.now()
  if (cachedPriceMap && now - cachedPriceMap.timestamp < PRICE_MAP_TTL_MS) {
    return cachedPriceMap.map
  }
  const sb = getSupabaseAdmin()
  if (!sb) return {}
  const { data } = await sb
    .from('bahan_baku_harga')
    .select('bahan_baku_id, harga_beli, harga_updated_at')
    .order('harga_updated_at', { ascending: false })
    .limit(300)

  const map: Record<string, number> = {}
  for (const p of data || []) {
    if (!map[p.bahan_baku_id]) {
      map[p.bahan_baku_id] = Number(p.harga_beli) || 0
    }
  }
  cachedPriceMap = { map, timestamp: now }
  return map
}

export function deteksiTopik(
  pesan: string,
  riwayat?: Array<{ role: string; content: string }>
): TopikQueryDinamis {
  const p = pesan.toLowerCase()
  const isWaste = /waste|reject|rusak|basi|robek|kerugian\s*bahan|sampah\s*bahan|dibuang|buang/i.test(p)
  const isPenjualan = /penjualan|omzet|omset|sales|revenue|laba|margin|hpp|transaksi|struk|order|terlaris|tersepi|menu/i.test(p)
  const isOpex = /opex|pengeluaran|biaya|kas\s*kecil|petty\s*cash|kasir|setoran/i.test(p)

  if (isWaste && !isPenjualan && !isOpex) return 'waste'
  if (isPenjualan && !isWaste && !isOpex) return 'penjualan'
  if (isOpex && !isWaste && !isPenjualan) return 'opex'
  if (Number(isWaste) + Number(isPenjualan) + Number(isOpex) > 1) return 'semua'

  // Jika tidak eksplisit di pesan saat ini, cek konteks percakapan sebelumnya
  if (riwayat && riwayat.length > 0) {
    const riwayatTeks = riwayat.slice(-4).map((r) => r.content).join(' ').toLowerCase()
    const rWaste = /waste|reject|rusak|basi/i.test(riwayatTeks)
    const rPenjualan = /omzet|omset|penjualan|sales|revenue/i.test(riwayatTeks)
    const rOpex = /opex|pengeluaran|biaya/i.test(riwayatTeks)
    if (rWaste && !rPenjualan && !rOpex) return 'waste'
    if (rPenjualan && !rWaste && !rOpex) return 'penjualan'
    if (rOpex && !rWaste && !rPenjualan) return 'opex'
  }

  return 'semua'
}

/**
 * Mendeteksi apakah pesan menanyakan tanggal tertentu atau rentang hari ke belakang.
 * Mengembalikan null jika pengguna hanya menanyakan hari ini atau kemarin (H-1) standar.
 */
export function deteksiPermintaanTanggal(
  pesan: string,
  riwayat?: Array<{ role: string; content: string }>,
  refDate?: Date
): PermintaanTanggalDinamis | null {
  const text = pesan.trim()
  if (!text) return null

  // Waktu acuan WIB (UTC+7)
  const now = refDate ? new Date(refDate.getTime() + 7 * 3600000) : new Date(Date.now() + 7 * 3600000)
  const tglSekarangStr = now.toISOString().slice(0, 10)
  const [currYear, currMonth, _currDay] = tglSekarangStr.split('-').map(Number)

  // Abaikan jika HANYA bertanya 'hari ini' atau 'kemarin' biasa tanpa angka rentang/tanggal lain
  const hanyaHariIniAtauKemarin =
    /^(?:gimana\s+|bagaimana\s+|cek\s+|ada\s+)?(?:hari\s*ini|kemarin|kemaren)(?:\s+gimana|\s+bagaimana)?\??$/i.test(text)
  if (hanyaHariIniAtauKemarin) {
    return null
  }

  const topik = deteksiTopik(text, riwayat)

  // 1. Deteksi rentang hari kebelakang: "X hari kebelakang", "X hari terakhir", "X hari lalu", "seminggu", "2 minggu", "sebulan"
  let jumlahHari: number | null = null

  const mRelHari =
    text.match(/\b(\d+)\s*(?:hari|hr)\s*(?:ke\s*belakang|kebelakang|terakhir|kemarin|lalu)/i) ||
    text.match(/(?:ke\s*belakang|kebelakang|terakhir|kemarin|lalu)\s*(\d+)\s*(?:hari|hr)/i) ||
    text.match(/\b(\d+)\s*(?:hari|hr)\s*(?:gimana|bagaimana|apa|semua)\b/i) ||
    text.match(/(?:data|laporan|rekap|cek|total|angka|tren|rekapitulasi|semua)\s*(\d+)\s*(?:hari|hr)\b/i) ||
    text.match(/(?:waste|omzet|penjualan|opex)\s*(\d+)\s*(?:hari|hr)\b/i)

  if (mRelHari) {
    jumlahHari = parseInt(mRelHari[1], 10)
  } else if (/\bseminggu\b/i.test(text) || /\b1\s*minggu\b/i.test(text) || /\bsatu\s*minggu\b/i.test(text)) {
    jumlahHari = 7
  } else if (/\b(\d+)\s*minggu\b/i.test(text)) {
    const mMinggu = text.match(/\b(\d+)\s*minggu\b/i)
    if (mMinggu) jumlahHari = parseInt(mMinggu[1], 10) * 7
  } else if (/\bsebulan\b/i.test(text) || /\b1\s*bulan\b/i.test(text) || /\bsatu\s*bulan\b/i.test(text)) {
    jumlahHari = 30
  } else if (/\b(\d+)\s*bulan\b/i.test(text)) {
    const mBulan = text.match(/\b(\d+)\s*bulan\b/i)
    if (mBulan) jumlahHari = parseInt(mBulan[1], 10) * 30
  } else if (/kemarin\s+lusa/i.test(text)) {
    // Kemarin lusa = H-2
    const h2Date = new Date(now.getTime() - 2 * 86400000)
    const tglH2 = h2Date.toISOString().slice(0, 10)
    return {
      jenis: 'tanggal_spesifik',
      topik,
      startDateIso: `${tglH2}T00:00:00+07:00`,
      endDateIso: `${tglH2}T23:59:59+07:00`,
      tglAwalStr: tglH2,
      tglAkhirStr: tglH2,
      labelPeriode: `Kemarin Lusa (H-2: ${tglH2})`,
      jumlahHari: 1,
    }
  }

  if (jumlahHari !== null && jumlahHari > 0) {
    // Batasi maksimum 90 hari agar tidak membebani memori/database
    const hariClamped = Math.min(jumlahHari, 90)
    // Rentang: dari (now - hariClamped + 1) sampai hari ini
    const startObj = new Date(now.getTime() - (hariClamped - 1) * 86400000)
    const tglAwal = startObj.toISOString().slice(0, 10)
    const tglAkhir = tglSekarangStr

    return {
      jenis: 'rentang_hari',
      topik,
      startDateIso: `${tglAwal}T00:00:00+07:00`,
      endDateIso: `${tglAkhir}T23:59:59+07:00`,
      tglAwalStr: tglAwal,
      tglAkhirStr: tglAkhir,
      labelPeriode: `${hariClamped} Hari Terakhir (${tglAwal} s.d. ${tglAkhir})`,
      jumlahHari: hariClamped,
    }
  }

  // 2. Deteksi rentang dua tanggal: "dari tanggal 10 sampai 15 Oktober", "tanggal 10 - 15 Oktober", "tgl 1 s/d 10"
  const rangePattern =
    /(?:dari\s+)?(?:tgl|tanggal)\s+(\d{1,2})(?:\s+([a-z]+))?(?:\s+(\d{4}))?\s*(?:sampai|hingga|s\/d|-)\s*(?:(?:tgl|tanggal)\s+)?(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i
  const mRange = text.match(rangePattern)
  if (mRange) {
    const d1 = parseInt(mRange[1], 10)
    const d2 = parseInt(mRange[4], 10)
    const m2Name = mRange[5]?.toLowerCase()
    const m1Name = mRange[2] ? mRange[2].toLowerCase() : m2Name
    const y2 = mRange[6] ? parseInt(mRange[6], 10) : currYear
    const y1 = mRange[3] ? parseInt(mRange[3], 10) : y2
    const mon1 = (m1Name && NAMA_BULAN_INDO[m1Name]) || currMonth
    const mon2 = (m2Name && NAMA_BULAN_INDO[m2Name]) || currMonth

    const tglAwal = `${y1}-${pad2(mon1)}-${pad2(d1)}`
    const tglAkhir = `${y2}-${pad2(mon2)}-${pad2(d2)}`

    return {
      jenis: 'rentang_tanggal',
      topik,
      startDateIso: `${tglAwal}T00:00:00+07:00`,
      endDateIso: `${tglAkhir}T23:59:59+07:00`,
      tglAwalStr: tglAwal,
      tglAkhirStr: tglAkhir,
      labelPeriode: `Rentang Tanggal ${d1} ${NAMA_BULAN_LABEL[mon1]} ${y1} s.d. ${d2} ${NAMA_BULAN_LABEL[mon2]} ${y2}`,
    }
  }

  // 3. Deteksi tanggal spesifik dengan nama bulan: "tanggal 15 Oktober", "tgl 20 okt 2026"
  const singleIndo = /(?:tgl|tanggal)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i
  const mSingle = text.match(singleIndo)
  if (mSingle && NAMA_BULAN_INDO[mSingle[2].toLowerCase()]) {
    const d = parseInt(mSingle[1], 10)
    const mon = NAMA_BULAN_INDO[mSingle[2].toLowerCase()]
    const y = mSingle[3] ? parseInt(mSingle[3], 10) : currYear
    const tgl = `${y}-${pad2(mon)}-${pad2(d)}`

    return {
      jenis: 'tanggal_spesifik',
      topik,
      startDateIso: `${tgl}T00:00:00+07:00`,
      endDateIso: `${tgl}T23:59:59+07:00`,
      tglAwalStr: tgl,
      tglAkhirStr: tgl,
      labelPeriode: `Tanggal ${d} ${NAMA_BULAN_LABEL[mon]} ${y}`,
      jumlahHari: 1,
    }
  }

  // 4. Deteksi tanggal format slash/dash: "20/10/2026", "2026-10-20"
  const slashDate = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
  const mSlash = text.match(slashDate)
  if (mSlash) {
    const d = parseInt(mSlash[1], 10)
    const mon = parseInt(mSlash[2], 10)
    const y = parseInt(mSlash[3], 10)
    if (mon >= 1 && mon <= 12 && d >= 1 && d <= 31) {
      const tgl = `${y}-${pad2(mon)}-${pad2(d)}`
      return {
        jenis: 'tanggal_spesifik',
        topik,
        startDateIso: `${tgl}T00:00:00+07:00`,
        endDateIso: `${tgl}T23:59:59+07:00`,
        tglAwalStr: tgl,
        tglAkhirStr: tgl,
        labelPeriode: `Tanggal ${d} ${NAMA_BULAN_LABEL[mon]} ${y}`,
        jumlahHari: 1,
      }
    }
  }

  const isoDate = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
  const mIso = text.match(isoDate)
  if (mIso) {
    const y = parseInt(mIso[1], 10)
    const mon = parseInt(mIso[2], 10)
    const d = parseInt(mIso[3], 10)
    if (mon >= 1 && mon <= 12 && d >= 1 && d <= 31) {
      const tgl = `${y}-${pad2(mon)}-${pad2(d)}`
      return {
        jenis: 'tanggal_spesifik',
        topik,
        startDateIso: `${tgl}T00:00:00+07:00`,
        endDateIso: `${tgl}T23:59:59+07:00`,
        tglAwalStr: tgl,
        tglAkhirStr: tgl,
        labelPeriode: `Tanggal ${d} ${NAMA_BULAN_LABEL[mon]} ${y}`,
        jumlahHari: 1,
      }
    }
  }

  // 5. Deteksi tanggal tunggal hanya angka: "tanggal 15", "tgl 22" (asumsikan bulan dan tahun sekarang)
  const singleOnlyDay = /(?:tgl|tanggal)\s+(\d{1,2})\b/i
  const mDay = text.match(singleOnlyDay)
  if (mDay) {
    const d = parseInt(mDay[1], 10)
    if (d >= 1 && d <= 31) {
      const tgl = `${currYear}-${pad2(currMonth)}-${pad2(d)}`
      return {
        jenis: 'tanggal_spesifik',
        topik,
        startDateIso: `${tgl}T00:00:00+07:00`,
        endDateIso: `${tgl}T23:59:59+07:00`,
        tglAwalStr: tgl,
        tglAkhirStr: tgl,
        labelPeriode: `Tanggal ${d} ${NAMA_BULAN_LABEL[currMonth]} ${currYear}`,
        jumlahHari: 1,
      }
    }
  }

  return null
}

/**
 * Menjalankan query ke Supabase secara dinamis sesuai filter tanggal dan topik yang diminta.
 * Mengembalikan teks Markdown terstruktur yang siap disuntikkan ke prompt LLM.
 */
export async function ambilDataDinamisRentang(
  req: PermintaanTanggalDinamis,
  customSb?: any,
  customPriceMap?: Record<string, number>
): Promise<string> {
  const sb = customSb || getSupabaseAdmin()
  if (!sb) return ''
  const priceMap = customPriceMap || (await muatPriceMap())

  const sections: string[] = []

  // 1. DATA WASTE
  if (req.topik === 'waste' || req.topik === 'semua') {
    try {
      const { data: wasteRowsRaw, error: errWaste } = await sb
        .from('stok_waste_reports')
        .select('id, qty, reason, status, created_at, outlet_id, bahan_baku_id, outlets(name, type), bahan_baku(nama, satuan)')
        .neq('status', 'REJECTED')
        .gte('created_at', req.startDateIso)
        .lte('created_at', req.endDateIso)
        .order('created_at', { ascending: false })
        .limit(2000)

      if (errWaste) {
        console.error('[queryDinamis] Gagal query waste:', errWaste)
      } else {
        const rows = wasteRowsRaw || []
        let totalLoss = 0
        const outletMap: Record<string, { name: string; reports: number; qty: number; loss: number; items: string[] }> = {}
        const bahanMap: Record<string, { name: string; satuan: string; reports: number; qty: number; loss: number; reasons: Record<string, number> }> = {}
        const dateMap: Record<string, { count: number; loss: number }> = {}

        for (const r of rows) {
          const qty = Number(r.qty) || 0
          const hBeli = priceMap[r.bahan_baku_id] || 0
          const loss = qty * hBeli
          totalLoss += loss

          const outName = (r.outlets as any)?.name || 'Cabang'
          if (!outletMap[outName]) {
            outletMap[outName] = { name: outName, reports: 0, qty: 0, loss: 0, items: [] }
          }
          outletMap[outName].reports++
          outletMap[outName].qty += qty
          outletMap[outName].loss += loss

          const bName = (r.bahan_baku as any)?.nama || 'Bahan'
          const sat = (r.bahan_baku as any)?.satuan || 'unit'
          if (!bahanMap[bName]) {
            bahanMap[bName] = { name: bName, satuan: sat, reports: 0, qty: 0, loss: 0, reasons: {} }
          }
          bahanMap[bName].reports++
          bahanMap[bName].qty += qty
          bahanMap[bName].loss += loss
          const reas = (r.reason || 'Lainnya').trim()
          bahanMap[bName].reasons[reas] = (bahanMap[bName].reasons[reas] || 0) + 1

          if (outletMap[outName].items.length < 4) {
            outletMap[outName].items.push(`${bName} (${Math.round(qty * 10) / 10} ${sat})`)
          }

          if (r.created_at) {
            const wibDate = new Date(Date.parse(r.created_at) + 7 * 3600000).toISOString().slice(0, 10)
            if (!dateMap[wibDate]) dateMap[wibDate] = { count: 0, loss: 0 }
            dateMap[wibDate].count++
            dateMap[wibDate].loss += loss
          }
        }

        const topOutlets = Object.values(outletMap).sort((a, b) => b.loss - a.loss)
        const topBahan = Object.values(bahanMap).sort((a, b) => b.loss - a.loss)

        const listTopBahan = topBahan
          .slice(0, 8)
          .map((b, i) => {
            const topReason = Object.entries(b.reasons).sort((x, y) => y[1] - x[1])[0]?.[0] || '-'
            return `  ${i + 1}. ${b.name}: ${b.reports} laporan (${Math.round(b.qty * 100) / 100} ${b.satuan}) — Est. Rugi: ${formatRupiah(b.loss)} | Alasan: ${topReason}`
          })
          .join('\n')

        const listTopOutlet = topOutlets
          .slice(0, 15)
          .map((o, i) => `  ${i + 1}. ${o.name}: ${o.reports} laporan (${Math.round(o.qty * 10) / 10} unit) — Est. Rugi: ${formatRupiah(o.loss)} [Item: ${o.items.join(', ')}]`)
          .join('\n')

        const listTrenHarian = Object.entries(dateMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([tgl, d]) => `  * ${tgl}: ${d.count} laporan waste, estimasi rugi ${formatRupiah(d.loss)}`)
          .join('\n')

        sections.push(`
📊 DATA KERUGIAN & WASTE BAHAN BAKU (${req.labelPeriode}):
- Total Laporan Waste: ${rows.length} laporan
- Total Akumulasi Estimasi Kerugian: ${formatRupiah(totalLoss)}
- Cabang Terbanyak Mengalami Kerugian Waste (Peringkat Kerugian):
${listTopOutlet || '  (Tidak ada data waste cabang pada periode ini)'}
- Komoditas Bahan Baku Paling Banyak Waste:
${listTopBahan || '  (Tidak ada bahan baku terbuang pada periode ini)'}
${Object.keys(dateMap).length > 1 ? `- Rincian Waste Per Tanggal:\n${listTrenHarian}` : ''}
`.trim())
      }
    } catch (err) {
      console.error('[queryDinamis] Gagal memproses waste:', err)
    }
  }

  // 2. DATA PENJUALAN / OMZET
  if (req.topik === 'penjualan' || req.topik === 'semua') {
    try {
      const { data: ordersRaw, error: errOrders } = await sb
        .from('orders')
        .select('id, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, outlets(name, type)')
        .gte('created_at', req.startDateIso)
        .lte('created_at', req.endDateIso)
        .in('status', ['completed', 'settled'])
        .order('created_at', { ascending: false })
        .limit(5000)

      if (errOrders) {
        console.error('[queryDinamis] Gagal query orders:', errOrders)
      } else {
        const orders = ordersRaw || []
        let totalKotor = 0
        let totalDiskon = 0
        const outletSales: Record<string, { name: string; omzet: number; orders: number }> = {}
        const dateSales: Record<string, { omzet: number; orders: number }> = {}

        for (const o of orders) {
          const amt = Number(o.total_amount) || 0
          const disc = (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0)
          totalKotor += amt
          totalDiskon += disc

          const outName = (o.outlets as any)?.name || 'Cabang'
          if (!outletSales[outName]) outletSales[outName] = { name: outName, omzet: 0, orders: 0 }
          outletSales[outName].omzet += amt
          outletSales[outName].orders++

          if (o.created_at) {
            const wibDate = new Date(Date.parse(o.created_at) + 7 * 3600000).toISOString().slice(0, 10)
            if (!dateSales[wibDate]) dateSales[wibDate] = { omzet: 0, orders: 0 }
            dateSales[wibDate].omzet += amt
            dateSales[wibDate].orders++
          }
        }

        const totalNet = totalKotor - totalDiskon
        const aov = orders.length > 0 ? Math.round(totalKotor / orders.length) : 0
        const topOutlets = Object.values(outletSales).sort((a, b) => b.omzet - a.omzet)

        const listOutletSales = topOutlets
          .slice(0, 15)
          .map((o, i) => `  ${i + 1}. ${o.name}: ${formatRupiah(o.omzet)} (${o.orders} struk)`)
          .join('\n')

        const listTrenSales = Object.entries(dateSales)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([tgl, d]) => `  * ${tgl}: Omzet ${formatRupiah(d.omzet)} (${d.orders} struk)`)
          .join('\n')

        sections.push(`
💰 DATA PENJUALAN & TRANSAKSI POS (${req.labelPeriode}):
- Total Omzet Kotor Jaringan: ${formatRupiah(totalKotor)}
- Total Omzet Bersih (Net): ${formatRupiah(totalNet)} (Potongan Diskon/Promo: ${formatRupiah(totalDiskon)})
- Total Volume Transaksi: ${orders.length} struk (Rata-rata Struk/AOV: ${formatRupiah(aov)})
- Peringkat Cabang Beromzet Tertinggi:
${listOutletSales || '  (Tidak ada transaksi pada periode ini)'}
${Object.keys(dateSales).length > 1 ? `- Rincian Penjualan Per Tanggal:\n${listTrenSales}` : ''}
`.trim())
      }
    } catch (err) {
      console.error('[queryDinamis] Gagal memproses orders:', err)
    }
  }

  // 3. DATA BIAYA / OPEX
  if (req.topik === 'opex' || req.topik === 'semua') {
    try {
      const [resPetty, resExp] = await Promise.all([
        sb
          .from('petty_cash_expenses')
          .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
          .gte('expense_date', req.tglAwalStr)
          .lte('expense_date', req.tglAkhirStr)
          .is('deleted_at', null)
          .order('amount', { ascending: false })
          .limit(500),
        sb
          .from('expenses')
          .select('id, category, amount, description, expense_date, type, outlet_id, outlets(name)')
          .gte('expense_date', req.tglAwalStr)
          .lte('expense_date', req.tglAkhirStr)
          .eq('type', 'expense')
          .order('amount', { ascending: false })
          .limit(500),
      ])

      const listAllExp: Array<{ deskripsi: string; nominal: number; outlet: string; kategori: string }> = []
      let totalOpex = 0

      for (const p of resPetty.data || []) {
        const nom = Number(p.amount) || 0
        totalOpex += nom
        listAllExp.push({
          deskripsi: p.description || 'Petty cash',
          nominal: nom,
          outlet: (p.outlets as any)?.name || 'Pusat',
          kategori: p.category || 'Operasional',
        })
      }

      for (const e of resExp.data || []) {
        const nom = Number(e.amount) || 0
        totalOpex += nom
        listAllExp.push({
          deskripsi: e.description || 'Pengeluaran',
          nominal: nom,
          outlet: (e.outlets as any)?.name || 'Pusat',
          kategori: e.category || 'Operasional',
        })
      }

      if (listAllExp.length > 0) {
        listAllExp.sort((a, b) => b.nominal - a.nominal)
        const topExp = listAllExp
          .slice(0, 10)
          .map((x, i) => `  ${i + 1}. ${formatRupiah(x.nominal)} - ${x.deskripsi} (${x.outlet}) [kategori: ${x.kategori}]`)
          .join('\n')

        sections.push(`
💸 DATA PENGELUARAN & OPEX (${req.labelPeriode}):
- Total Beban Pengeluaran Operasional: ${formatRupiah(totalOpex)} (${listAllExp.length} transaksi)
- 10 Pengeluaran Terbesar pada Periode Ini:
${topExp}
`.trim())
      }
    } catch (err) {
      console.error('[queryDinamis] Gagal memproses expenses:', err)
    }
  }

  if (sections.length === 0) {
    return ''
  }

  return `
======================================================================
DATA HASIL QUERY DINAMIS SESUAI PERMINTAAN TANGGAL PENGGUNA
🗓️ Periode yang Diminta: ${req.labelPeriode}
🎯 Topik: ${req.topik.toUpperCase()}
======================================================================
${sections.join('\n\n')}
======================================================================
`.trim()
}
