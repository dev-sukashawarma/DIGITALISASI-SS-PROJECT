import type { ChannelPnlDetail, ComprehensiveMitraPnl, OpexCategoryDetail } from '@/app/actions/mitraPnl'

/* Menjumlahkan laba rugi mitra dari beberapa potongan periode yang berurutan.
 *
 * Dipakai saat satu rentang tanggal harus dihitung terpisah-pisah — bulan closing
 * penuh memakai angka closing, hari di luarnya memakai hitungan live (lihat
 * rencanaPeriodeClosing). Setiap potongan sudah lengkap sendiri; di sini hanya
 * dijumlahkan, tidak ada yang dihitung ulang dari data mentah.
 */

const jumlah = (xs: (number | undefined)[]) => xs.reduce<number>((s, x) => s + (Number(x) || 0), 0)

function gabungKanal(xs: ChannelPnlDetail[]): ChannelPnlDetail {
  return {
    revenue: jumlah(xs.map(x => x.revenue)),
    cogs: jumlah(xs.map(x => x.cogs)),
    deductions: jumlah(xs.map(x => x.deductions)),
    grossProfit: jumlah(xs.map(x => x.grossProfit)),
    orderCount: jumlah(xs.map(x => x.orderCount)),
  }
}

export function gabungkanPnlMitra(bagian: ComprehensiveMitraPnl[]): ComprehensiveMitraPnl {
  if (bagian.length === 0) throw new Error('gabungkanPnlMitra: tidak ada potongan periode')
  if (bagian.length === 1) return bagian[0]

  const awal = bagian[0]
  const akhir = bagian[bagian.length - 1]
  const s = bagian.map(b => b.summary)

  const grossRevenue = jumlah(s.map(x => x.grossRevenue))
  const netProfit = jumlah(s.map(x => x.netProfit))
  const mitraShare = jumlah(s.map(x => x.mitraShare))
  const managementFeeAmount = jumlah(s.map(x => x.managementFeeAmount))

  // Persen hanya bermakna tunggal bila semua potongan memakai persen yang sama;
  // kalau berbeda, yang ditampilkan adalah tarif efektif atas seluruh rentang.
  const feePcts = new Set(s.map(x => x.managementFeePct ?? 0))
  const managementFeePct = feePcts.size === 1
    ? (s[0].managementFeePct ?? 0)
    : (grossRevenue > 0 ? Math.round((managementFeeAmount / grossRevenue) * 1000) / 10 : 0)
  const sharePcts = new Set(bagian.map(b => b.profitSharingPct))
  const profitSharingPct = sharePcts.size === 1
    ? awal.profitSharingPct
    : (netProfit > 0 ? Math.round((mitraShare / netProfit) * 100) : akhir.profitSharingPct)

  const kategori = new Map<string, OpexCategoryDetail>()
  for (const b of bagian) {
    for (const c of b.opex.categories) {
      const cur = kategori.get(c.category) || { category: c.category, amount: 0, items: [] }
      cur.amount += c.amount
      cur.items = [...cur.items, ...c.items]
      kategori.set(c.category, cur)
    }
  }

  return {
    period: { from: awal.period.from, to: akhir.period.to },
    outletName: akhir.outletName,
    profitSharingPct,
    summary: {
      grossRevenue,
      totalDeductions: jumlah(s.map(x => x.totalDeductions)),
      netRevenue: jumlah(s.map(x => x.netRevenue)),
      totalCogs: jumlah(s.map(x => x.totalCogs)),
      grossProfit: jumlah(s.map(x => x.grossProfit)),
      totalOpex: jumlah(s.map(x => x.totalOpex)),
      totalWaste: jumlah(s.map(x => x.totalWaste)),
      managementFeePct,
      managementFeeAmount,
      netProfit,
      mitraShare,
      profitMarginPct: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0,
      // Status kebijakan & BEP mengikuti potongan paling akhir (kondisi terkini).
      policyStatus: akhir.summary.policyStatus,
      isBep: akhir.summary.isBep,
      profitSharingActive: s.every(x => x.profitSharingActive !== false),
    },
    channels: {
      pos: gabungKanal(bagian.map(b => b.channels.pos)),
      foodApps: {
        ...gabungKanal(bagian.map(b => b.channels.foodApps)),
        grab: jumlah(bagian.map(b => b.channels.foodApps.grab)),
        gofood: jumlah(bagian.map(b => b.channels.foodApps.gofood)),
        shopeefood: jumlah(bagian.map(b => b.channels.foodApps.shopeefood)),
      },
      tiktok: gabungKanal(bagian.map(b => b.channels.tiktok)),
    },
    opex: {
      categories: Array.from(kategori.values()).sort((a, b) => b.amount - a.amount),
      totalPettyCash: jumlah(bagian.map(b => b.opex.totalPettyCash)),
      totalMonthly: jumlah(bagian.map(b => b.opex.totalMonthly)),
      grandTotal: jumlah(bagian.map(b => b.opex.grandTotal)),
    },
    // Statistik investasi tidak bergantung pada rentang tanggal.
    investment: akhir.investment,
  }
}
