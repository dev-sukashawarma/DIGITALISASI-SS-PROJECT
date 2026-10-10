import JSZip from 'jszip'
import { LOGO_BASE64 } from '@/utils/logoBase64'
import { resolveMitraPolicy, calculateMitraBepStatus } from '@/lib/mitraPolicy'
import type { ProfitScope } from '@/lib/outletOwnership'

// Brand Suka Shawarma Palette
export const BRAND_COLORS = {
  sukaAmberLight: [254, 243, 199] as [number, number, number], // Warm Cream (#FEF3C7)
  sukaAmberDark: [146, 64, 14] as [number, number, number],   // Dark Amber (#92400E)
  sukaGold: [253, 230, 138] as [number, number, number],       // Warm Gold (#FDE68A)
  sukaRoseLight: [255, 228, 230] as [number, number, number],  // Soft Rose (#FFE4E6)
  sukaRoseDark: [159, 18, 57] as [number, number, number],    // Dark Rose (#9F1239)
  sukaGreenLight: [209, 250, 229] as [number, number, number], // Mint Emerald (#D1FAE5)
  sukaGreenDark: [6, 95, 70] as [number, number, number],     // Dark Green (#065F46)
  sukaCyanLight: [224, 242, 254] as [number, number, number],  // Sky Cyan (#E0F2FE)
  sukaCyanDark: [3, 105, 161] as [number, number, number],    // Deep Cyan (#0369A1)
  sukaBlueLight: [239, 246, 255] as [number, number, number],  // Soft Blue (#EFF6FF)
  sukaBlueDark: [30, 58, 138] as [number, number, number],    // Dark Slate/Navy (#1E3A8A)
  sukaOrange: [234, 88, 12] as [number, number, number],      // Primary Brand (#EA580C)
  sukaOrangeTerracotta: [194, 65, 12] as [number, number, number] // (#C2410C)
}

export function formatPeriodeIndo(fromStr: string, toStr: string): string {
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const [y1, m1, d1] = fromStr.split('-').map(Number)
    const [y2, m2, d2] = toStr.split('-').map(Number)
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return `${fromStr} s/d ${toStr}`
    return `${d1} ${months[m1 - 1]} ${y1} s/d ${d2} ${months[m2 - 1]} ${y2}`
  } catch {
    return `${fromStr} s/d ${toStr}`
  }
}

export function rupiah(val: number): string {
  const isNeg = val < 0
  const abs = Math.abs(Math.round(val))
  return `${isNeg ? '-' : ''}Rp ${abs.toLocaleString('id-ID')}`
}

export function getChannelGroup(salesSource: string): 'outlet' | 'food_apps' | 'tiktok_go' | 'website' {
  const s = (salesSource || '').toLowerCase().trim()
  if (['gofood', 'go_food', 'grabfood', 'grab_food', 'shopeefood', 'shopee_food', 'food_delivery', 'food_apps', 'foodapps'].includes(s)) {
    return 'food_apps'
  }
  if (['tiktok', 'tiktok_go', 'tiktokgo'].includes(s)) {
    return 'tiktok_go'
  }
  if (['website', 'online', 'web', 'website ss', 'ss-online', 'ss_online', 'shopee', 'shopee_shop', 'shopee_seller', 'shopeeseller', 'shopee seller'].includes(s)) {
    return 'website'
  }
  return 'outlet' // Default POS / Offline
}

export interface OutletExportItem {
  id: string
  name: string
  omzet: number
  deductions: number
  netRev: number
  expense: number
  hpp: number
  cogsChannels?: { outlet: number; food_apps: number; tiktok_go: number; website: number }
  waste: number
  mgmtFee: number
  mgmtFeePct: number
  isBep: boolean
  isMitra: boolean
  labaKotor: number
  net: number
  margin: number
  totalCost: number
}

export interface ConsolidatedSummaryData {
  actualGrossSales: number
  totalDeductions: number
  netRevenue: number
  totalHpp: number
  labaKotor: number
  marginKotor: number
  pengeluaranOutlet: number
  totalWaste: number
  pengeluaranPusat: number
  managementFeeReceived: number
  mitraHppMarginReceived: number
  managementFeeExpense: number
  displayLaba: number
  displayMargin: number
  adaAntarKantong: boolean
  includeCentral: boolean
  totalJointExpense?: number
}

export interface ExportContext {
  salesRows: any[]
  expenseRows: any[]
  mitraInvestments: Record<string, any>
  tiktokSettlements: Record<string, any>
  platformSettlements?: Record<string, any>
  filter: { from: string; to: string }
  effectiveFilter: { from: string; to: string }
  printTimestamp?: string
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createZipBundle(
  files: { filename: string; content: Blob | string }[],
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.filename, file.content)
  }
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    metadata => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent), `Mengompresi berkas ZIP (${Math.round(metadata.percent)}%)...`)
      }
    }
  )
}

/**
 * Membangun baris perhitungan finansial untuk 1 outlet (digunakan bersama oleh PDF dan CSV).
 */
export function buildOutletFinancialCalculations(
  item: OutletExportItem,
  ctx: ExportContext
) {
  const outletDisplayName = item.name.replace(/^SUKA SHAWARMA\s*/i, '').toUpperCase()
  const outletSales = ctx.salesRows.filter(r => r.outlet_id === item.id)

  const isMitra = item.isMitra
  const inv = ctx.mitraInvestments[item.id]
  const bepStatusInfo = calculateMitraBepStatus(inv, item.id, ctx.effectiveFilter.from, item.isBep)
  const modalInvestasi = bepStatusInfo.modalInvestasi || (isMitra ? 125000000 : 0)
  const profitMitraSebelumnya = bepStatusInfo.profitMitraSebelumnya
  const isBepAlready = bepStatusInfo.isBep

  const policy = resolveMitraPolicy({
    periodFrom: ctx.effectiveFilter.from,
    isBep: isBepAlready,
    legacyProfitSharingPct: inv?.persentase_bagi_hasil,
    legacyManagementFee: inv?.management_fee,
  })
  const bagiHasilPct = isMitra ? policy.profitSharingPct : 0
  const mgmtFeePct = isMitra ? policy.managementFeePct : 0

  // 1. Group sales by channel
  const channels = {
    outlet: { revenue: 0, adminFee: 0, promo: 0, commission: 0 },
    food_apps: { revenue: 0, adminFee: 0, promo: 0, commission: 0 },
    tiktok_go: { revenue: 0, adminFee: 0, promo: 0, commission: 0 },
    website: { revenue: 0, adminFee: 0, promo: 0, commission: 0 }
  }

  outletSales.forEach(r => {
    const grp = getChannelGroup(r.sales_source || '')
    const gross = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
    const promo = Number(r.total_deductions) || 0
    const comm = Number(r.platform_fee) || 0
    const fee = promo + comm
    channels[grp].revenue += gross
    channels[grp].adminFee += fee
    channels[grp].promo += promo
    channels[grp].commission += comm
  })

  // TikTok settlement
  const ttSettlement = ctx.tiktokSettlements[item.id]
  const adminSettlementTikTok = ttSettlement ? ttSettlement.commission : channels.tiktok_go.adminFee
  const settlementTikTok = ttSettlement ? ttSettlement.totalSettlement : (channels.tiktok_go.revenue - channels.tiktok_go.adminFee)

  // Bila ada data rekonsiliasi platform settlement, pastikan adminFee Food Apps
  // (promo merchant + komisi platform) sinkron 100% dengan rekonsiliasi settlement & POS Report
  if (ctx.platformSettlements) {
    const gfSt = ctx.platformSettlements[`${item.id}|gofood`]
    const sfSt = ctx.platformSettlements[`${item.id}|shopeefood`]
    const grbSt = ctx.platformSettlements[`${item.id}|grabfood`]
    if (gfSt || sfSt || grbSt) {
      // Single Source of Truth dari file rekonsiliasi platform settlement:
      // - GoFood, ShopeeFood, dan GrabFood menggunakan promo_merchant dan commission dari settlement jika tersedia
      // - Jika data settlement belum diunggah, fallback ke input kasir (outletSales)
      const gfPromo = gfSt?.promoMerchant !== undefined && gfSt?.promoMerchant !== null
        ? Number(gfSt.promoMerchant) || 0
        : outletSales.filter(r => (r.sales_source || '').toLowerCase().includes('go')).reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0)

      const sfPromo = sfSt?.promoMerchant !== undefined && sfSt?.promoMerchant !== null
        ? Number(sfSt.promoMerchant) || 0
        : outletSales.filter(r => (r.sales_source || '').toLowerCase().includes('shopee')).reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0)

      const grbPromo = grbSt?.promoMerchant !== undefined && grbSt?.promoMerchant !== null
        ? Number(grbSt.promoMerchant) || 0
        : outletSales
            .filter(r => (r.sales_source || '').toLowerCase().includes('grab'))
            .reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0)

      const stFoodAppsPromo = gfPromo + sfPromo + grbPromo
      const stFoodAppsComm = (gfSt?.commission || 0) + (sfSt?.commission || 0) + (grbSt?.commission || 0)
      if (stFoodAppsPromo > 0) {
        channels.food_apps.promo = stFoodAppsPromo
      }
      if (stFoodAppsComm > 0) {
        channels.food_apps.commission = stFoodAppsComm
      }
      channels.food_apps.adminFee = channels.food_apps.promo + channels.food_apps.commission
    }
  }

  const totalRev = channels.outlet.revenue + channels.food_apps.revenue + channels.tiktok_go.revenue + channels.website.revenue
  const calcAdminFee = channels.outlet.adminFee + channels.food_apps.adminFee + adminSettlementTikTok + channels.website.adminFee
  const totalAdminFee = calcAdminFee
  const totalCogs = item.hpp

  let cogsOutlet = 0
  let cogsFoodApps = 0
  let cogsTikTok = 0
  let cogsWebsite = 0

  if (item.cogsChannels) {
    cogsOutlet = item.cogsChannels.outlet || 0
    cogsFoodApps = item.cogsChannels.food_apps || 0
    cogsTikTok = item.cogsChannels.tiktok_go || 0
    cogsWebsite = item.cogsChannels.website || 0

    const sumRealCogs = cogsOutlet + cogsFoodApps + cogsTikTok + cogsWebsite
    const diffRealCogs = item.hpp - sumRealCogs
    if (diffRealCogs !== 0) {
      if (cogsFoodApps > 0) {
        cogsFoodApps += diffRealCogs
      } else if (cogsOutlet > 0) {
        cogsOutlet += diffRealCogs
      } else {
        cogsOutlet += diffRealCogs
      }
    }
  } else {
    const getCogs = (rev: number) => totalRev > 0 ? Math.round((item.hpp * rev) / totalRev) : 0
    cogsOutlet = getCogs(channels.outlet.revenue)
    cogsFoodApps = getCogs(channels.food_apps.revenue)
    cogsTikTok = getCogs(channels.tiktok_go.revenue)
    cogsWebsite = getCogs(channels.website.revenue)

    const sumCogs = cogsOutlet + cogsFoodApps + cogsTikTok + cogsWebsite
    const diffCogs = item.hpp - sumCogs
    if (diffCogs !== 0) {
      if (channels.outlet.revenue >= channels.food_apps.revenue && channels.outlet.revenue > 0) {
        cogsOutlet += diffCogs
      } else if (channels.food_apps.revenue > 0) {
        cogsFoodApps += diffCogs
      } else if (channels.tiktok_go.revenue > 0) {
        cogsTikTok += diffCogs
      } else if (channels.website.revenue > 0) {
        cogsWebsite += diffCogs
      } else {
        cogsOutlet += diffCogs
      }
    }
  }

  const gpOutlet = channels.outlet.revenue - channels.outlet.adminFee - cogsOutlet
  const gpFoodApps = channels.food_apps.revenue - channels.food_apps.adminFee - cogsFoodApps
  const gpTikTok = settlementTikTok - cogsTikTok
  const gpWebsite = channels.website.revenue - channels.website.adminFee - cogsWebsite

  const managementFee = isMitra && mgmtFeePct > 0 
    ? (item.mgmtFee > 0 ? item.mgmtFee : Math.round((totalRev * mgmtFeePct) / 100)) 
    : 0
  const totalGrossProfit = totalRev - totalAdminFee - totalCogs - item.waste - managementFee

  // OPEX
  const outletOpex = ctx.expenseRows.filter(e => e.outlet_id === item.id && (e.scope === 'outlet' || !e.scope))
  const opexSums: Record<string, { label: string; amount: number }> = {
    pengeluaran_outlet: { label: 'PENGELUARAN OUTLET', amount: 0 },
    gaji_crew_outlet: { label: 'GAJI CREW OUTLET', amount: 0 },
    bonus_crew: { label: 'BONUS CREW', amount: 0 },
    bonus_area_manager: { label: 'BONUS AREA MANAGER', amount: 0 },
    bonus_regional_manager: { label: 'BONUS REGIONAL MANAGER', amount: 0 },
    lembur: { label: 'LEMBUR', amount: 0 },
    ads: { label: 'ADS', amount: 0 },
    endorsement: { label: 'ENDORSEMENT', amount: 0 },
    promo: { label: 'PROMO', amount: 0 },
    pdam: { label: 'PDAM', amount: 0 },
    pln: { label: 'PLN', amount: 0 },
    internet: { label: 'INTERNET', amount: 0 },
    sewa_outlet: { label: 'BIAYA SEWA OUTLET', amount: 0 },
    joint_expense: { label: 'JOINT EXPENSE', amount: 0 },
    gaji_staff_kantor: { label: 'GAJI STAFF KANTOR', amount: 0 }
  }

  outletOpex.forEach(e => {
    const c = (e as any).category?.toLowerCase() || ''
    if (c === 'gaji_crew_outlet' || c === 'salary' || c === 'gaji') opexSums.gaji_crew_outlet.amount += e.amount
    else if (c === 'bonus_crew' || c === 'bonus_leader') opexSums.bonus_crew.amount += e.amount
    else if (c === 'bonus_area_manager' || c === 'bonus_korlap') opexSums.bonus_area_manager.amount += e.amount
    else if (c === 'bonus_regional_manager') opexSums.bonus_regional_manager.amount += e.amount
    else if (c === 'lembur' || c === 'overtime') opexSums.lembur.amount += e.amount
    else if (c === 'ads' || c === 'iklan' || c === 'marketing_ads') opexSums.ads.amount += e.amount
    else if (c === 'endorsement' || c === 'marcom') opexSums.endorsement.amount += e.amount
    else if (c === 'promo' || c === 'diskon') opexSums.promo.amount += e.amount
    else if (c === 'pdam' || c === 'air') opexSums.pdam.amount += e.amount
    else if (c === 'pln' || c === 'listrik') opexSums.pln.amount += e.amount
    else if (c === 'internet' || c === 'wifi') opexSums.internet.amount += e.amount
    else if (c === 'sewa_outlet' || c === 'sewa') opexSums.sewa_outlet.amount += e.amount
    else if (c === 'joint_expense' || c === 'joint_expanse' || c === 'pengeluaran_global') opexSums.joint_expense.amount += e.amount
    else if (c === 'gaji_staff_kantor') opexSums.gaji_staff_kantor.amount += e.amount
    else opexSums.pengeluaran_outlet.amount += e.amount
  })

  const rawTotalOpex = Object.values(opexSums).reduce((a, b) => a + b.amount, 0)
  const diffOpex = (item.expense > 0 && rawTotalOpex > 0) ? item.expense - rawTotalOpex : 0
  if (diffOpex !== 0) {
    opexSums.pengeluaran_outlet.amount += diffOpex
  }
  const totalOpex = item.expense > 0 ? item.expense : rawTotalOpex
  const totalNetProfit = totalGrossProfit - totalOpex

  let profitMitra = 0
  let profitSukaShawarma = 0

  if (isMitra) {
    profitMitra = totalNetProfit > 0 ? Math.round((totalNetProfit * bagiHasilPct) / 100) : 0
    profitSukaShawarma = managementFee + (totalNetProfit > 0 ? (totalNetProfit - profitMitra) : totalNetProfit)
  } else {
    profitMitra = 0
    profitSukaShawarma = totalNetProfit
  }

  const totalProfitMitraSementara = profitMitraSebelumnya + (isMitra ? profitMitra : 0)
  const roiVal = modalInvestasi > 0 ? ((totalProfitMitraSementara / modalInvestasi) * 100).toFixed(2) + '%' : '0.00%'
  const bepStatus = isMitra 
    ? (isBepAlready || item.isBep || (modalInvestasi > 0 && totalProfitMitraSementara >= modalInvestasi)
        ? 'SUDAH BEP (BALIK MODAL)' 
        : `${(modalInvestasi > 0 ? (totalProfitMitraSementara / modalInvestasi) * 100 : 0).toFixed(2).replace('.', ',')}% Menuju BEP`)
    : '-'

  return {
    outletDisplayName,
    isMitra,
    modalInvestasi,
    profitMitraSebelumnya,
    bagiHasilPct,
    mgmtFeePct,
    managementFee,
    channels,
    adminSettlementTikTok,
    settlementTikTok,
    totalRev,
    totalAdminFee,
    totalCogs,
    cogsOutlet,
    cogsFoodApps,
    cogsTikTok,
    cogsWebsite,
    gpOutlet,
    gpFoodApps,
    gpTikTok,
    gpWebsite,
    totalGrossProfit,
    opexSums,
    totalOpex,
    totalNetProfit,
    profitMitra,
    profitSukaShawarma,
    totalProfitMitraSementara,
    roiVal,
    bepStatus
  }
}

/**
 * Render halaman tunggal outlet ke dalam instance jsPDF.
 */
function renderOutletPdfPage(
  doc: any,
  autoTable: any,
  item: OutletExportItem,
  ctx: ExportContext,
  _pageWidth: number
) {
  const calc = buildOutletFinancialCalculations(item, ctx)
  const {
    sukaAmberLight, sukaAmberDark, sukaGold, sukaRoseLight, sukaRoseDark,
    sukaGreenLight, sukaGreenDark, sukaCyanLight, sukaCyanDark, sukaBlueLight, sukaBlueDark,
  } = BRAND_COLORS

  // BRAND HEADER WITH LOGO IN PDF
  doc.setDrawColor(234, 88, 12)
  doc.setFillColor(234, 88, 12)
  doc.rect(14, 8, 182, 1.2, 'F')

  // Embed Logo
  try {
    if (LOGO_BASE64) {
      const imgProps = doc.getImageProperties(LOGO_BASE64)
      const logoH = 13
      const logoW = (imgProps.width / imgProps.height) * logoH
      doc.addImage(LOGO_BASE64, 'PNG', 14, 10.5, logoW, logoH)
    }
  } catch {
    // Fallback if logo fails
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(194, 65, 12) // Suka Orange Terracotta
  doc.text('SUKA SHAWARMA', 31, 14.5)

  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59) // Slate 800
  doc.text('LAPORAN LABA RUGI OPERASIONAL & PERFORMA KEMITRAAN', 31, 18.5)

  const outletCategoryStr = calc.isMitra 
    ? `[Kemitraan (Bagi Hasil: ${calc.bagiHasilPct}% | Mgmt Fee: ${calc.mgmtFeePct}%)]` 
    : '[Outlet Pusat (Milik Sendiri)]'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59) // Slate 800
  const outletTitleText = `OUTLET: ${calc.outletDisplayName}  `
  doc.text(outletTitleText, 31, 22.5)

  const outletTitleWidth = doc.getTextWidth(outletTitleText)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text(outletCategoryStr, 31 + outletTitleWidth, 22.5)
  const printTs = ctx.printTimestamp || new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())
  doc.text(`Periode: ${formatPeriodeIndo(ctx.filter.from, ctx.filter.to)}   |   Dicetak: ${printTs} WIB`, 31, 26)

  const bodyRows: any[] = []

  // 1. TRANSAKSI OUTLET (KASIR POS / OFFLINE)
  const showOutlet = calc.channels.outlet.revenue > 0 || calc.channels.outlet.adminFee > 0 || calc.totalRev === 0
  if (showOutlet) {
    bodyRows.push([
      { content: 'TRANSAKSI OUTLET (KASIR POS / OFFLINE)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
    ])
    bodyRows.push(['REVENUE (OMZET KASIR)', { content: rupiah(calc.channels.outlet.revenue), styles: { halign: 'right' } }])
    if (calc.channels.outlet.adminFee > 0) {
      bodyRows.push(['ADMIN FEE', { content: `-${rupiah(calc.channels.outlet.adminFee)}`, styles: { halign: 'right' } }])
    }
    bodyRows.push(['TOTAL COGS (HPP)', { content: calc.cogsOutlet > 0 ? `-${rupiah(calc.cogsOutlet)}` : 'Rp 0', styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'TOTAL GROSS PROFIT OUTLET', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
      { content: rupiah(calc.gpOutlet), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
    ])
    bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])
  }

  // 2. TRANSAKSI FOOD APPS
  if (calc.channels.food_apps.revenue > 0 || calc.channels.food_apps.adminFee > 0) {
    bodyRows.push([
      { content: 'TRANSAKSI FOOD APPS (GRAB / GOJEK / SHOPEE)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
    ])
    bodyRows.push(['REVENUE FOOD APPS', { content: rupiah(calc.channels.food_apps.revenue), styles: { halign: 'right' } }])
    bodyRows.push(['ADMIN FEE (PROMO & KOMISI PLATFORM)', { content: calc.channels.food_apps.adminFee > 0 ? `-${rupiah(calc.channels.food_apps.adminFee)}` : 'Rp 0', styles: { halign: 'right' } }])
    if (calc.channels.food_apps.promo > 0 && calc.channels.food_apps.commission > 0) {
      bodyRows.push([
        { content: '  • Potongan Merchant (Promo Resto)', styles: { textColor: [100, 116, 139] } },
        { content: `-${rupiah(calc.channels.food_apps.promo)}`, styles: { halign: 'right', textColor: [100, 116, 139] } }
      ])
      bodyRows.push([
        { content: '  • Biaya Layanan & Komisi Platform', styles: { textColor: [100, 116, 139] } },
        { content: `-${rupiah(calc.channels.food_apps.commission)}`, styles: { halign: 'right', textColor: [100, 116, 139] } }
      ])
    }
    bodyRows.push(['TOTAL COGS (HPP)', { content: calc.cogsFoodApps > 0 ? `-${rupiah(calc.cogsFoodApps)}` : 'Rp 0', styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'TOTAL GROSS PROFIT FOOD APPS', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
      { content: rupiah(calc.gpFoodApps), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
    ])
    bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])
  }

  // 3. TRANSAKSI TIKTOK GO (Hanya tampil bila ada transaksi atau settlement)
  if (calc.channels.tiktok_go.revenue > 0 || calc.adminSettlementTikTok > 0 || calc.settlementTikTok > 0) {
    bodyRows.push([
      { content: 'TRANSAKSI TIKTOK GO', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
    ])
    bodyRows.push(['REVENUE TIKTOK', { content: rupiah(calc.channels.tiktok_go.revenue), styles: { halign: 'right' } }])
    bodyRows.push(['KOMISI / ADMIN SETTLEMENT TIKTOK', { content: calc.adminSettlementTikTok > 0 ? `-${rupiah(calc.adminSettlementTikTok)}` : 'Rp 0', styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'SETTLEMENT (PENCAIRAN DANA)', styles: { fontStyle: 'bold' } }, 
      { content: rupiah(calc.settlementTikTok), styles: { halign: 'right', fontStyle: 'bold' } }
    ])
    bodyRows.push(['TOTAL COGS (HPP)', { content: calc.cogsTikTok > 0 ? `-${rupiah(calc.cogsTikTok)}` : 'Rp 0', styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'TOTAL GROSS PROFIT TIKTOK GO', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
      { content: rupiah(calc.gpTikTok), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
    ])
    bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])
  }

  // 4. TRANSAKSI WEBSITE & MARKETPLACE (Hanya tampil bila ada transaksi)
  if (calc.channels.website.revenue > 0 || calc.channels.website.adminFee > 0) {
    bodyRows.push([
      { content: 'TRANSAKSI WEBSITE SS', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
    ])
    bodyRows.push(['REVENUE WEBSITE SS', { content: rupiah(calc.channels.website.revenue), styles: { halign: 'right' } }])
    if (calc.channels.website.adminFee > 0) {
      bodyRows.push(['ADMIN FEE', { content: `-${rupiah(calc.channels.website.adminFee)}`, styles: { halign: 'right' } }])
    }
    bodyRows.push(['TOTAL COGS (HPP)', { content: calc.cogsWebsite > 0 ? `-${rupiah(calc.cogsWebsite)}` : 'Rp 0', styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'TOTAL GROSS PROFIT WEBSITE SS', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } }, 
      { content: rupiah(calc.gpWebsite), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
    ])
    bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])
  }

  // 5. TOTAL REKAP PENDAPATAN KOTOR (GROSS)
  bodyRows.push([
    { content: 'TOTAL REKAP PENDAPATAN KOTOR (GROSS)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
  ])
  bodyRows.push([
    { content: 'TOTAL REVENUE (OMZET KOTOR)' }, 
    { content: rupiah(calc.totalRev), styles: { halign: 'right', fontStyle: 'bold' } }
  ])
  bodyRows.push([
    { content: 'TOTAL ADMIN FEE & POTONGAN PLATFORM' }, 
    { content: calc.totalAdminFee > 0 ? `-${rupiah(calc.totalAdminFee)}` : 'Rp 0', styles: { halign: 'right' } }
  ])
  if (calc.channels.food_apps.adminFee > 0 || calc.adminSettlementTikTok > 0) {
    if (calc.channels.food_apps.promo > 0) {
      bodyRows.push([
        { content: '  • Potongan Merchant Food Apps (Promo)', styles: { textColor: [100, 116, 139] } },
        { content: `-${rupiah(calc.channels.food_apps.promo)}`, styles: { halign: 'right', textColor: [100, 116, 139] } }
      ])
    }
    if (calc.channels.food_apps.commission > 0) {
      bodyRows.push([
        { content: '  • Komisi Platform Food Apps', styles: { textColor: [100, 116, 139] } },
        { content: `-${rupiah(calc.channels.food_apps.commission)}`, styles: { halign: 'right', textColor: [100, 116, 139] } }
      ])
    }
    if (calc.adminSettlementTikTok > 0) {
      bodyRows.push([
        { content: '  • Komisi / Admin Settlement TikTok Go', styles: { textColor: [100, 116, 139] } },
        { content: `-${rupiah(calc.adminSettlementTikTok)}`, styles: { halign: 'right', textColor: [100, 116, 139] } }
      ])
    }
  }
  bodyRows.push([
    { content: 'TOTAL COGS (HPP)' }, 
    { content: calc.totalCogs > 0 ? `-${rupiah(calc.totalCogs)}` : 'Rp 0', styles: { halign: 'right' } }
  ])
  bodyRows.push([
    { content: 'TOTAL WASTE' }, 
    { content: item.waste > 0 ? `-${rupiah(item.waste)}` : 'Rp 0', styles: { halign: 'right' } }
  ])
  const mgmtFeeLabel = calc.isMitra ? `MANAGEMENT FEE (${calc.mgmtFeePct}%)` : 'MANAGEMENT FEE'
  const mgmtFeeValue = calc.managementFee > 0 
    ? `-${rupiah(calc.managementFee)}` 
    : (item.isBep ? 'Rp 0 (Bebas Fee · BEP)' : 'Rp 0')
  bodyRows.push([
    { content: mgmtFeeLabel }, 
    { content: mgmtFeeValue, styles: { halign: 'right' } }
  ])
  bodyRows.push([
    { content: 'TOTAL GROSS PROFIT', styles: { fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }, 
    { content: rupiah(calc.totalGrossProfit), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
  ])
  bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

  // 6. URAIAN OPEX (Wajib menampilkan seluruh 13 item standar, jika 0 tampilkan Rp 0)
  bodyRows.push([
    { content: 'URAIAN OPEX', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }
  ])
  
  const standardOpexKeys = [
    'pengeluaran_outlet',
    'gaji_crew_outlet',
    'bonus_crew',
    'bonus_area_manager',
    'bonus_regional_manager',
    'lembur',
    'ads',
    'endorsement',
    'promo',
    'pdam',
    'pln',
    'internet',
    'sewa_outlet'
  ] as const

  standardOpexKeys.forEach(key => {
    const opexItem = calc.opexSums[key]
    if (opexItem) {
      bodyRows.push([opexItem.label, { content: rupiah(opexItem.amount), styles: { halign: 'right' } }])
    }
  })

  // Pengeluaran tambahan di luar 13 standar di atas (jika ada nilai > 0): JOINT EXPENSE & GAJI STAFF KANTOR
  if (calc.opexSums.joint_expense.amount > 0) {
    bodyRows.push([calc.opexSums.joint_expense.label, { content: rupiah(calc.opexSums.joint_expense.amount), styles: { halign: 'right' } }])
  }
  if (calc.opexSums.gaji_staff_kantor.amount > 0) {
    bodyRows.push([calc.opexSums.gaji_staff_kantor.label, { content: rupiah(calc.opexSums.gaji_staff_kantor.amount), styles: { halign: 'right' } }])
  }

  bodyRows.push([
    { content: 'SUB TOTAL PENGELUARAN', styles: { fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }, 
    { content: rupiah(calc.totalOpex), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }
  ])
  bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])

  // 7. HASIL LABA BERSIH & BAGI HASIL
  bodyRows.push([
    { content: 'HASIL LABA BERSIH & BAGI HASIL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }
  ])
  bodyRows.push([
    { content: 'TOTAL LABA BERSIH OUTLET (NET PROFIT)', styles: { fontStyle: 'bold' } }, 
    { content: rupiah(calc.totalNetProfit), styles: { halign: 'right', fontStyle: 'bold', textColor: calc.totalNetProfit >= 0 ? [22, 101, 52] : [225, 29, 72] } }
  ])
  if (calc.isMitra) {
    bodyRows.push([
      { content: `BAGIAN PROFIT MITRA (${calc.bagiHasilPct}%)`, styles: { fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }, 
      { content: rupiah(calc.profitMitra), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }
    ])
    if (item.isBep && (100 - calc.bagiHasilPct) > 0) {
      bodyRows.push([
        { content: `BAGIAN PROFIT SUKA SHAWARMA PUSAT (${100 - calc.bagiHasilPct}%)`, styles: { fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }, 
        { content: rupiah(calc.profitSukaShawarma), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaBlueLight, textColor: sukaBlueDark } }
      ])
    }
  } else {
    bodyRows.push([
      { content: 'BAGIAN PROFIT SUKA SHAWARMA PUSAT (100%)', styles: { fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }, 
      { content: rupiah(calc.profitSukaShawarma), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaGreenLight, textColor: sukaGreenDark } }
    ])
  }

  // 8. REKAP MODAL MITRA & ROI (Hanya untuk Mitra)
  if (calc.isMitra) {
    bodyRows.push([{ content: '', colSpan: 2, styles: { cellPadding: 0.4, lineWidth: 0 } }])
    bodyRows.push([
      { content: 'REKAP MODAL INVESTASI & ROI MITRA (DASHBOARD KEMITRAAN)', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }
    ])
    bodyRows.push(['TOTAL MODAL INVESTASI MITRA', { content: calc.modalInvestasi > 0 ? rupiah(calc.modalInvestasi) : '-', styles: { halign: 'right' } }])
    bodyRows.push(['PROFIT MITRA SEBELUMNYA (HISTORIS)', { content: rupiah(calc.profitMitraSebelumnya), styles: { halign: 'right' } }])
    bodyRows.push(['PROFIT MITRA PERIODE INI', { content: rupiah(calc.profitMitra), styles: { halign: 'right' } }])
    bodyRows.push([
      { content: 'TOTAL PROFIT MITRA SEMENTARA (KUMULATIF)', styles: { fontStyle: 'bold' } }, 
      { content: rupiah(calc.totalProfitMitraSementara), styles: { halign: 'right', fontStyle: 'bold' } }
    ])
    bodyRows.push([
      { content: 'RETURN ON INVESTMENT (ROI)', styles: { fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }, 
      { content: calc.roiVal, styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaCyanLight, textColor: sukaCyanDark } }
    ])
    bodyRows.push([
      { content: 'STATUS BEP', styles: { fontStyle: 'bold' } }, 
      { content: calc.bepStatus, styles: { halign: 'right', fontStyle: 'bold' } }
    ])
  }

  autoTable(doc, {
    startY: 33,
    head: [],
    body: bodyRows,
    theme: 'plain',
    styles: { 
      fontSize: 7.2, 
      cellPadding: { top: 1.1, bottom: 1.1, left: 3, right: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [15, 23, 42]
    },
    columnStyles: { 
      0: { cellWidth: 122 }, 
      1: { cellWidth: 60, halign: 'right' } 
    },
    didParseCell: function (data: any) {
      if (data.row.raw[0]?.content === '') {
        data.cell.styles.lineWidth = 0
        data.cell.styles.fillColor = [255, 255, 255]
      }
    }
  })
}

/**
 * Membuat file PDF mandiri (1 file PDF) khusus untuk 1 outlet.
 */
export async function generateSingleOutletPdfBlob(
  item: OutletExportItem,
  ctx: ExportContext
): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  renderOutletPdfPage(doc, autoTable, item, ctx, pageWidth)

  // Nomor Halaman Resmi di Bawah
  const printTs = ctx.printTimestamp || new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Halaman ${i} dari ${totalPages}  |  Laporan Resmi Laba Rugi Suka Shawarma  |  Waktu Cetak: ${printTs} WIB`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

/**
 * Membuat file PDF multi-halaman konsolidasi untuk seluruh outlet.
 */
export async function generateConsolidatedPdfBlob(
  outletBreakdown: OutletExportItem[],
  summary: ConsolidatedSummaryData,
  scope: ProfitScope,
  ctx: ExportContext
): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const {
    sukaAmberLight, sukaAmberDark, sukaGold, sukaRoseLight, sukaRoseDark,
    sukaOrange, sukaOrangeTerracotta
  } = BRAND_COLORS

  const printTimestamp = ctx.printTimestamp || new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())

  // ══════════════════════════════════════════════════════════════════════════════════
  // BAGIAN 1: RINGKASAN EKSEKUTIF KONSOLIDASI (Halaman 1)
  // ══════════════════════════════════════════════════════════════════════════════════
  doc.setDrawColor(...sukaOrange)
  doc.setFillColor(...sukaOrange)
  doc.rect(14, 9, 182, 1.2, 'F')

  try {
    if (LOGO_BASE64) {
      const imgProps = doc.getImageProperties(LOGO_BASE64)
      const logoH = 16
      const logoW = (imgProps.width / imgProps.height) * logoH
      doc.addImage(LOGO_BASE64, 'PNG', 14, 12, logoW, logoH)
    }
  } catch {}

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...sukaOrangeTerracotta)
  doc.text('SUKA SHAWARMA INDONESIA', 33, 16.5)

  doc.setFontSize(8.5)
  doc.setTextColor(30, 41, 59)
  const scopeTitle = scope === 'all'
    ? 'LAPORAN LABA RUGI KONSOLIDASI EKSEKUTIF (SELURUH UNIT)'
    : scope === 'internal'
      ? 'LAPORAN LABA RUGI EKSEKUTIF - UNIT INTERNAL (MILIK PUSAT)'
      : 'LAPORAN LABA RUGI EKSEKUTIF - UNIT KEMITRAAN (MITRA)'
  doc.text(scopeTitle, 33, 21.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Periode: ${formatPeriodeIndo(ctx.filter.from, ctx.filter.to)}  |  Total: ${outletBreakdown.length} Outlet Aktif`, 33, 26)
  doc.text(`Waktu Cetak: ${printTimestamp} WIB  |  Status: Data Tersinkronisasi`, 33, 29.8)

  const execRows: any[] = []

  // 1. Pendapatan
  execRows.push([
    { content: '1. PENDAPATAN USAHA (SALES REVENUE)', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
  ])
  execRows.push(['Omzet Penjualan Kotor (Gross Revenue)', { content: rupiah(summary.actualGrossSales), styles: { halign: 'right', fontStyle: 'bold' } }])
  execRows.push(['Admin Fee (Diskon Promo & Komisi Platform)', { content: `-${rupiah(summary.totalDeductions)}`, styles: { halign: 'right', textColor: [225, 29, 72] } }])
  execRows.push(['Penjualan Bersih (Net Sales)', { content: rupiah(summary.actualGrossSales - summary.totalDeductions), styles: { halign: 'right', fontStyle: 'bold' } }])

  if (summary.adaAntarKantong) {
    if (summary.managementFeeReceived > 0) {
      execRows.push(['Fee Manajemen Kemitraan (Diterima Pusat)', { content: `+${rupiah(summary.managementFeeReceived)}`, styles: { halign: 'right', textColor: [5, 150, 105] } }])
    }
    if (summary.mitraHppMarginReceived > 0) {
      execRows.push(['Margin Pasokan Bahan Baku Mitra (10%)', { content: `+${rupiah(summary.mitraHppMarginReceived)}`, styles: { halign: 'right', textColor: [5, 150, 105] } }])
    }
    if (summary.managementFeeExpense > 0) {
      const feeExpLabel = scope === 'all'
        ? 'Beban Fee Manajemen Unit Kemitraan (3% Gross Belum BEP)'
        : 'Beban Fee Manajemen ke Pusat (3% Gross Belum BEP)'
      execRows.push([feeExpLabel, { content: `-${rupiah(summary.managementFeeExpense)}`, styles: { halign: 'right', textColor: [225, 29, 72] } }])
    }
    execRows.push([
      { content: 'TOTAL PENDAPATAN BERSIH (NET REVENUE)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: rupiah(summary.netRevenue), styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } }
    ])
  }

  // 2. COGS
  execRows.push([
    { content: '2. BEBAN POKOK PENJUALAN (COGS)', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: sukaGold, textColor: [15, 23, 42] } }
  ])
  execRows.push(['Harga Pokok Penjualan (HPP Bahan Baku)', { content: `-${rupiah(summary.totalHpp)}`, styles: { halign: 'right' } }])
  execRows.push([
    { content: `TOTAL LABA KOTOR (GROSS PROFIT)  [Margin: ${summary.marginKotor.toFixed(1)}%]`, styles: { fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } },
    { content: rupiah(summary.labaKotor), styles: { halign: 'right', fontStyle: 'bold', fillColor: sukaAmberLight, textColor: sukaAmberDark } }
  ])

  // 3. OPEX
  execRows.push([
    { content: '3. BEBAN OPERASIONAL (OPEX) & KERUGIAN', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: sukaRoseLight, textColor: sukaRoseDark } }
  ])
  if (summary.totalJointExpense && summary.totalJointExpense > 0) {
    const bebanMurni = Math.max(0, summary.pengeluaranOutlet - summary.totalJointExpense)
    execRows.push(['Beban Operasional Seluruh Outlet (Gaji, Sewa, Listrik, Operasional)', { content: `-${rupiah(bebanMurni)}`, styles: { halign: 'right' } }])
    execRows.push(['Joint Expense', { content: `-${rupiah(summary.totalJointExpense)}`, styles: { halign: 'right', textColor: [225, 29, 72] } }])
  } else {
    execRows.push(['Beban Operasional Seluruh Outlet (Gaji, Sewa, Listrik, Operasional)', { content: `-${rupiah(summary.pengeluaranOutlet)}`, styles: { halign: 'right' } }])
  }
  if (summary.totalWaste > 0) {
    execRows.push(['Kerugian Bahan Rusak / Basi (Waste)', { content: `-${rupiah(summary.totalWaste)}`, styles: { halign: 'right', textColor: [225, 29, 72] } }])
  }
  if (summary.includeCentral) {
    execRows.push(['Beban Kantor Pusat (Pengeluaran Global & Operasional HQ)', { content: `-${rupiah(summary.pengeluaranPusat)}`, styles: { halign: 'right' } }])
  }
  const totalBebanKonsolidasi = summary.pengeluaranOutlet + summary.totalWaste + (summary.includeCentral ? summary.pengeluaranPusat : 0)
  execRows.push([
    { content: 'TOTAL BEBAN OPERASIONAL & KERUGIAN', styles: { fontStyle: 'bold' } },
    { content: `-${rupiah(totalBebanKonsolidasi)}`, styles: { halign: 'right', fontStyle: 'bold' } }
  ])

  // 4. Net Profit
  execRows.push([
    { content: '4. HASIL AKHIR BERSIH (NET PROFIT)', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: [220, 252, 231], textColor: [22, 101, 52] } }
  ])
  execRows.push([
    { content: summary.includeCentral ? 'LABA BERSIH PERUSAHAAN (KONSOLIDASI)' : 'TOTAL LABA BERSIH OUTLET', styles: { fontStyle: 'bold', fontSize: 8, textColor: summary.displayLaba >= 0 ? [22, 101, 52] : [225, 29, 72] } },
    { content: rupiah(summary.displayLaba), styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, textColor: summary.displayLaba >= 0 ? [22, 101, 52] : [225, 29, 72] } }
  ])
  execRows.push([
    { content: 'PROFIT MARGIN BERSIH (TERHADAP OMZET KOTOR)', styles: { fontStyle: 'bold' } },
    { content: `${summary.displayMargin.toFixed(1)}%`, styles: { halign: 'right', fontStyle: 'bold' } }
  ])

  autoTable(doc, {
    startY: 33,
    head: [],
    body: execRows,
    theme: 'plain',
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 1.1, bottom: 1.1, left: 3, right: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { cellWidth: 122 },
      1: { cellWidth: 60, halign: 'right' }
    }
  })

  // Tabel Leaderboard Ringkasan Outlet
  const finalExecY = (doc as any).lastAutoTable?.finalY || 105
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59)
  doc.text('RINGKASAN PERFORMA PER OUTLET (LEADERBOARD)', 14, finalExecY + 4.5)

  const totalOmzetAll = outletBreakdown.reduce((s, o) => s + o.omzet, 0)
  const totalDedAll = outletBreakdown.reduce((s, o) => s + o.deductions, 0)
  const totalHppAll = outletBreakdown.reduce((s, o) => s + o.hpp, 0)
  const totalWasteAll = outletBreakdown.reduce((s, o) => s + o.waste, 0)
  const totalExpenseAll = outletBreakdown.reduce((s, o) => s + o.expense, 0)
  const totalFeeAll = outletBreakdown.reduce((s, o) => s + o.mgmtFee, 0)
  const totalNetAll = outletBreakdown.reduce((s, o) => s + o.net, 0)
  const avgMargin = totalOmzetAll > 0 ? (totalNetAll / totalOmzetAll) * 100 : 0

  const leaderboardBody = outletBreakdown.map((item, idx) => {
    const feeStr = item.isMitra 
      ? (item.mgmtFee > 0 ? rupiah(item.mgmtFee) : (item.isBep ? '0% (BEP)' : '0%'))
      : '-'
    return [
      String(idx + 1),
      item.name.replace(/^SUKA SHAWARMA\s*/i, '').trim(),
      item.isMitra ? 'Mitra' : 'Pusat',
      rupiah(item.omzet),
      rupiah(item.deductions),
      rupiah(item.hpp),
      rupiah(item.waste),
      rupiah(item.expense),
      feeStr,
      rupiah(item.net),
      `${item.margin.toFixed(1)}%`
    ]
  })

  leaderboardBody.push([
    '',
    'TOTAL KONSOLIDASI',
    `${outletBreakdown.length} Unit`,
    rupiah(totalOmzetAll),
    rupiah(totalDedAll),
    rupiah(totalHppAll),
    rupiah(totalWasteAll),
    rupiah(totalExpenseAll),
    rupiah(totalFeeAll),
    rupiah(totalNetAll),
    `${avgMargin.toFixed(1)}%`
  ])

  autoTable(doc, {
    startY: finalExecY + 6.5,
    head: [['No', 'Outlet', 'Tipe', 'Omzet', 'Admin Fee', 'HPP', 'Waste', 'Beban Ops', 'Mgmt Fee', 'Laba Bersih', 'Margin']],
    body: leaderboardBody,
    theme: 'grid',
    styles: {
      fontSize: 6.2,
      cellPadding: { top: 0.8, bottom: 0.8, left: 1.2, right: 1.2 },
      lineColor: [226, 232, 240],
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: sukaOrangeTerracotta,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    didParseCell: function (data: any) {
      if (data.row.index === leaderboardBody.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        if (data.column.index === 9) {
          data.cell.styles.textColor = totalNetAll >= 0 ? [22, 101, 52] : [225, 29, 72]
        }
      }
      if (data.column.index === 9 && data.row.index < leaderboardBody.length - 1) {
        const rowNet = outletBreakdown[data.row.index]?.net ?? 0
        data.cell.styles.textColor = rowNet >= 0 ? [22, 101, 52] : [225, 29, 72]
      }
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 31, halign: 'left' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 13, halign: 'right' },
      7: { cellWidth: 17, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 19, halign: 'right' },
      10: { cellWidth: 18, halign: 'center' }
    }
  })

  // ══════════════════════════════════════════════════════════════════════════════════
  // BAGIAN 2: RINCIAN PER OUTLET (1 Outlet = 1 Halaman Rapi)
  // ══════════════════════════════════════════════════════════════════════════════════
  outletBreakdown.forEach((item) => {
    doc.addPage()
    renderOutletPdfPage(doc, autoTable, item, ctx, pageWidth)
  })

  // ══════════════════════════════════════════════════════════════════════════════════
  // BAGIAN 3: NOMOR HALAMAN RESMI DI SELURUH DOKUMEN
  // ══════════════════════════════════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Halaman ${i} dari ${totalPages}  |  Laporan Resmi Laba Rugi Suka Shawarma  |  Waktu Cetak: ${printTimestamp} WIB`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

/**
 * Membuat baris CSV untuk 1 outlet.
 */
export function buildSingleOutletCsvRows(
  item: OutletExportItem,
  ctx: ExportContext
): any[][] {
  const calc = buildOutletFinancialCalculations(item, ctx)
  const rows: any[][] = []
  const outletName = calc.outletDisplayName
  const categoryLabel = calc.isMitra ? 'Unit Kemitraan (Mitra)' : 'Unit Internal (Pusat)'

  // Channel 1
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'REVENUE', calc.channels.outlet.revenue])
  if (calc.channels.outlet.adminFee > 0) {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'ADMIN FEE', calc.channels.outlet.adminFee])
  }
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'TOTAL COGS (HPP)', calc.cogsOutlet])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI OUTLET', 'TOTAL GROSS PROFIT OUTLET', calc.gpOutlet])

  // Channel 2
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'REVENUE', calc.channels.food_apps.revenue])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'ADMIN FEE', calc.channels.food_apps.adminFee])
  if (calc.channels.food_apps.promo > 0 && calc.channels.food_apps.commission > 0) {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', '  • POTONGAN MERCHANT (PROMO)', calc.channels.food_apps.promo])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', '  • KOMISI PLATFORM FOOD APPS', calc.channels.food_apps.commission])
  }
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'TOTAL COGS (HPP)', calc.cogsFoodApps])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI FOOD APPS', 'TOTAL GROSS PROFIT FOOD APPS', calc.gpFoodApps])

  // Channel 3
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'REVENUE', calc.channels.tiktok_go.revenue])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'ADMIN FEE', calc.adminSettlementTikTok])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'SETTLEMENT (PENCAIRAN)', calc.settlementTikTok])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'TOTAL COGS (HPP)', calc.cogsTikTok])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI TIKTOK GO', 'TOTAL GROSS PROFIT TIKTOK GO', calc.gpTikTok])

  // Channel 4
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'REVENUE', calc.channels.website.revenue])
  if (calc.channels.website.adminFee > 0) {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'ADMIN FEE', calc.channels.website.adminFee])
  }
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'TOTAL COGS (HPP)', calc.cogsWebsite])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TRANSAKSI WEBSITE SS', 'TOTAL GROSS PROFIT WEBSITE SS', calc.gpWebsite])

  // Total Rekap Gross
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL REVENUE', calc.totalRev])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL ADMIN FEE', calc.totalAdminFee])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL COGS (HPP)', calc.totalCogs])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL WASTE', item.waste])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', calc.isMitra ? `MANAGEMENT FEE (${calc.mgmtFeePct}%)` : 'MANAGEMENT FEE', calc.managementFee])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'TOTAL REKAP GROSS', 'TOTAL GROSS PROFIT', calc.totalGrossProfit])

  // Uraian OPEX
  Object.values(calc.opexSums).forEach(o => {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', o.label, o.amount])
  })
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'URAIAN OPEX', 'SUB TOTAL PENGELUARAN', calc.totalOpex])

  // Net Profit & Bagi Hasil
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', 'TOTAL NET PROFIT', calc.totalNetProfit])
  rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', `PROFIT MITRA (${calc.isMitra ? calc.bagiHasilPct : 0}%)`, calc.profitMitra])
  if (!calc.isMitra || (item.isBep && (100 - calc.bagiHasilPct) > 0)) {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'NET PROFIT', calc.isMitra ? `PROFIT SUKA SHAWARMA (${100 - calc.bagiHasilPct}%)` : 'PROFIT SUKA SHAWARMA (100%)', calc.profitSukaShawarma])
  }

  // Rekap Modal Mitra & ROI
  if (calc.isMitra) {
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'TOTAL MODAL MITRA', calc.modalInvestasi])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'PROFIT MITRA SEBELUMNYA (HISTORIS)', calc.profitMitraSebelumnya])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'PROFIT MITRA PERIODE INI', calc.profitMitra])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'TOTAL PROFIT MITRA SEMENTARA (KUMULATIF)', calc.totalProfitMitraSementara])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'ROI (%)', `"${calc.roiVal}"`])
    rows.push([`"${outletName}"`, `"${categoryLabel}"`, 'REKAP MODAL MITRA', 'STATUS BEP', `"${calc.bepStatus}"`])
  }

  return rows
}

/**
 * Membuat string CSV untuk 1 outlet.
 */
export function generateSingleOutletCsvString(
  item: OutletExportItem,
  ctx: ExportContext
): string {
  const headers = ['OUTLET', 'KATEGORI', 'SEKSI', 'URAIAN', 'NILAI (RP)']
  const rows = buildSingleOutletCsvRows(item, ctx)
  return [headers, ...rows].map(e => e.join(',')).join('\n')
}

/**
 * Membuat string CSV konsolidasi untuk seluruh outlet.
 */
export function generateConsolidatedCsvString(
  outletBreakdown: OutletExportItem[],
  summary: ConsolidatedSummaryData,
  scope: ProfitScope,
  ctx: ExportContext
): string {
  const headers = ['OUTLET', 'KATEGORI', 'SEKSI', 'URAIAN', 'NILAI (RP)']
  const rows: any[][] = []

  outletBreakdown.forEach(item => {
    rows.push(...buildSingleOutletCsvRows(item, ctx))
  })

  // Ringkasan Konsolidasi Perusahaan
  if (scope !== 'mitra') {
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'TOTAL OMZET KOTOR PENJUALAN', summary.actualGrossSales])
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'TOTAL ADMIN FEE (POTONGAN & KOMISI)', summary.totalDeductions])
    if (summary.managementFeeReceived > 0) {
      rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'PENDAPATAN MANAGEMENT FEE MITRA (PUSAT)', summary.managementFeeReceived])
    }
    if (summary.mitraHppMarginReceived > 0) {
      rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'PENDAPATAN MARGIN PASOKAN BAHAN MITRA (10% HPP DASAR)', summary.mitraHppMarginReceived])
    }
    if (summary.managementFeeExpense > 0) {
      rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'BEBAN MANAGEMENT FEE MITRA KE PUSAT (SALING HAPUS)', -summary.managementFeeExpense])
    }
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OMZET', 'PENDAPATAN BERSIH (NET REVENUE)', summary.netRevenue])
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI HPP & WASTE', 'TOTAL MODAL BAHAN (HPP)', summary.totalHpp])
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI HPP & WASTE', 'KERUGIAN BAHAN RUSAK (WASTE)', summary.totalWaste])
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OPEX', 'TOTAL BEBAN OPERASIONAL OUTLET', summary.pengeluaranOutlet])
    if (summary.pengeluaranPusat > 0) {
      rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI OPEX', 'BEBAN OPERASIONAL KANTOR PUSAT (MANAJEMEN)', summary.pengeluaranPusat])
    }
    rows.push(['"RINGKASAN KONSOLIDASI SELURUH OUTLET"', '"Konsolidasi Perusahaan"', 'KONSOLIDASI LABA BERSIH', 'LABA BERSIH AKHIR PERUSAHAAN (NET PROFIT)', summary.displayLaba])
  }

  return [headers, ...rows].map(e => e.join(',')).join('\n')
}
