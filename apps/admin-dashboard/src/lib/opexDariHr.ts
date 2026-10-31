/* ── Gaji & bonus outlet dari ringkasan payroll HR (sumber Buku Kas) ─────────
 *
 * Keputusan owner 13 Okt 2026: untuk OPEX, sumber kebenaran adalah Buku Kas
 * (OPEX). Kartu gaji & bonus Buku Kas dihitung dari ringkasan payroll HR
 * (`getHRPayrollSummaryAction`), sedangkan Laba Rugi dulu menghitung sendiri
 * lewat mesin prorata — dua jalur, dua angka (gaji master untuk outlet tanpa
 * slip, bonus AM dibebankan ke outlet tanpa AM binaan).
 *
 * Modul ini memecah ringkasan HR tampilan "Semua Outlet" menjadi baris per
 * outlet, dengan jumlah yang DIJAMIN sama dengan angka kartu Buku Kas. Laba
 * Rugi dan Buku Kas (pilihan Outlet Internal / Mitra) sama-sama memakainya.
 */

import type { ExpenseRow } from '@/lib/expenseRow'
import type {
  HRPayrollOutletSummary,
  HRPayrollPeriodEntry,
  HRPayrollSummary,
  ManagerAllocationDetail,
  StaffBonusDetail,
  StaffPayrollDetail,
} from '@/lib/server/ringkasanPayrollHr'
import { calculateDateRangeProrata } from '@/lib/opexDateRangeProrata'
import { distributeEqualSplit } from '@/lib/opexProrata'

/**
 * Dashboard mitra memakai sumber gaji & bonus ini mulai Oktober 2026. Agustus
 * dan September 2026 sudah closing dengan angka sendiri (mitraPnlClosingData),
 * jadi rentang yang dimulai sebelum tanggal ini tetap memakai hitungan lama.
 */
export const PAYROLL_HR_DASHBOARD_MITRA_SEJAK = '2026-10-01'

/** Kategori baris yang dibuat mesin prorata dan digantikan oleh baris HR. */
export const KATEGORI_PAYROLL_OUTLET = ['gaji_crew_outlet', 'bonus_crew', 'bonus_area_manager', 'bonus_regional_manager'] as const

export function adaDataHr(hr: HRPayrollSummary | null | undefined): hr is HRPayrollSummary {
  return Boolean(hr && hr.totalStaff > 0 && hr.totalSalary > 0)
}

/**
 * Gaji rutin sebulan seperti di kartu "Gaji (Rutin)" Buku Kas:
 * gaji pokok + tunjangan − potongan (+ alokasi rutin manajer untuk outlet).
 * Untuk Kantor Pusat (`isPusat`), insentif/bonus slip bulanan staf kantor ikut di sini
 * karena kartu "Bonus Kru" khusus penjualan POS ritel (sama dengan `susunBarisGajiKantor`
 * di Laba Rugi dan `targetKartuClosing`).
 */
export function gajiRutinBulananKartu(hr: HRPayrollSummary, isPusat: boolean): number {
  const gapok = Math.round(isPusat ? hr.basicSalary : (hr.crewBasicSalary ?? hr.basicSalary))
  const tunjangan = Math.round(isPusat ? hr.allowances : (hr.crewAllowances ?? hr.allowances))
  const bonusPusat = isPusat ? Math.round(hr.bonus || 0) : 0
  const potongan = Math.round(isPusat ? hr.deductions : (hr.crewDeductions ?? hr.deductions))
  const rutinStaf = Math.max(0, gapok + tunjangan + bonusPusat - potongan)
  const alokasiManajer = isPusat ? 0 : Math.round(hr.managerAllocation || 0)
  return Math.max(0, rutinStaf + alokasiManajer)
}

/** Bagi `total` (bilangan bulat) menurut `bobot`, jumlah hasilnya persis `total`. */
export function bagiPersis(total: number, bobot: Map<string, number>): Map<string, number> {
  const hasil = new Map<string, number>()
  const jumlahBobot = [...bobot.values()].reduce((s, v) => s + v, 0)
  if (jumlahBobot <= 0 || bobot.size === 0) return hasil
  let terpakai = 0
  let terbesar: string | null = null
  for (const [id, b] of bobot) {
    const bagian = Math.round((total * b) / jumlahBobot)
    hasil.set(id, bagian)
    terpakai += bagian
    if (terbesar === null || b > (bobot.get(terbesar) ?? 0)) terbesar = id
  }
  if (terbesar !== null) hasil.set(terbesar, (hasil.get(terbesar) ?? 0) + (total - terpakai))
  return hasil
}

export interface InfoOperasionalParsial {
  isPartial?: boolean
  operationalFirstDate?: string
  operationalLastDate?: string
  operationalCalendarDays?: number
}

/**
 * Rasio overlap rentang `[from, to]` terhadap hari operasional outlet dalam satu bulan kalender.
 * Outlet normal (`!isPartial`) memakai `defaultRatio`; outlet parsial memakai `overlapDays / operationalCalendarDays`.
 */
export function hitungRasioOverlapOutlet(
  op: InfoOperasionalParsial | null | undefined,
  from: string,
  to: string,
  defaultRatio: number,
): number {
  if (!op?.isPartial) return defaultRatio
  if ((op.operationalCalendarDays ?? 1) <= 0) return 0
  const opStart = op.operationalFirstDate || `${from.slice(0, 7)}-01`
  const opEnd = op.operationalLastDate || to
  const overlapStart = from > opStart ? from : opStart
  const overlapEnd = to < opEnd ? to : opEnd
  if (overlapStart > overlapEnd) return 0
  const overlapDays = Math.max(
    0,
    Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1,
  )
  const totalOpDays = op.operationalCalendarDays || 1
  return Math.min(1, Math.max(0, overlapDays / totalOpDays))
}

export interface RincianRutinOutletPeriode {
  rutin1Bln: number
  rutinPeriode: number
  mgr1Bln: number
  mgrPeriode: number
  itemRatio: number
}

function hitungPetaRutinCabangSatuPeriode(hr: HRPayrollSummary, from: string, to: string) {
  const info = calculateDateRangeProrata(from, to)
  const defaultRatio = info.isProrated ? info.ratio : 1
  const ringkasanOutlet = hr.outlets ?? []

  const nama = new Map<string, string>()
  const idDariNama = new Map<string, string>()
  const catat = (id?: string | null, n?: string | null) => {
    if (!id || id === 'PUSAT' || !n) return
    if (!nama.has(id)) nama.set(id, n)
    if (!idDariNama.has(n.trim().toLowerCase())) idDariNama.set(n.trim().toLowerCase(), id)
  }
  ringkasanOutlet.forEach(o => catat(o.outletId, o.outletName))
  ;(hr.staffDetails ?? []).forEach(s => {
    catat(s.outletId, s.outletName)
    ;(s.outletBreakdowns ?? []).forEach(b => catat(b.outletId, b.outletName))
  })

  // 1. Gaji rutin bulanan per outlet = rutin kru + alokasi rutin manajer.
  const rutinBulanan = new Map<string, number>()
  const tambah = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v)
  ;(hr.staffDetails ?? []).forEach(s => {
    if (s.isManagerAllocation) return
    // Rincian kanonis per cabang (mencakup kru mutasi lintas cabang, kru outlet parsial, & backup 1/N).
    if (s.outletBreakdowns && s.outletBreakdowns.length > 0) {
      for (const b of s.outletBreakdowns) {
        if (b.outletId && b.outletId !== 'PUSAT') {
          tambah(rutinBulanan, b.outletId, Number(b.routineSalary) || 0)
        }
      }
      return
    }
    if (!s.outletId || s.outletId === 'PUSAT') return
    // Cadangan untuk data tanpa outletBreakdowns: kru backup lintas outlet dibagi rata per komponen.
    const tujuan = (s.allocatedOutletIds ?? []).filter(id => id && id !== 'PUSAT')
    if (s.isBackupAllocation && tujuan.length > 1) {
      const pokok = distributeEqualSplit(Number(s.fullBasicSalary ?? s.basicSalary) || 0, tujuan)
      const tunjangan = distributeEqualSplit(Number(s.fullAllowances ?? s.allowances) || 0, tujuan)
      const potongan = distributeEqualSplit(Number(s.fullDeductions ?? s.deductions) || 0, tujuan)
      for (const id of tujuan) {
        tambah(rutinBulanan, id, (pokok.get(id) || 0) + (tunjangan.get(id) || 0) - (potongan.get(id) || 0))
      }
      return
    }
    tambah(rutinBulanan, s.outletId, Number(s.routineSalary) || 0)
  })
  ringkasanOutlet.forEach(o => {
    if (!o.outletId || o.outletId === 'PUSAT') return
    tambah(rutinBulanan, o.outletId, Number(o.managerRoutineAllocation ?? o.managerAllocation) || 0)
  })

  const partialRatios = new Map<string, number>()
  ringkasanOutlet.forEach(o => {
    if (!o.outletId || o.outletId === 'PUSAT') return
    if (o.isPartial) {
      partialRatios.set(o.outletId, hitungRasioOverlapOutlet(o, from, to, defaultRatio))
    }
  })

  // Jika `hr` memuat staf Kantor Pusat (target 'all' / 'INTERNAL_PUSAT'), keluarkan rutin staf pusat agar baris murni cabang.
  const pusatRutinDalamHr = (hr.staffDetails ?? [])
    .filter(s => !s.isManagerAllocation && s.outletId === 'PUSAT')
    .reduce((sum, s) => sum + (Number(s.routineSalary) || 0), 0)
  const bulananKartuCabang = Math.max(0, gajiRutinBulananKartu(hr, false) - pusatRutinDalamHr)
  const bulananPerOutlet = bagiPersis(bulananKartuCabang, rutinBulanan)

  let rutin: Map<string, number>
  if (partialRatios.size > 0) {
    // Tetapkan baseline bulanan tiap outlet lebih dulu agar saat outlet parsial bernilai Rp 0
    // pada sub-rentang tanggal, gajinya TIDAK melimpah ke outlet reguler lain, dan angka per outlet
    // sama persis dengan kartu Buku Kas tampilan 1 outlet (selisih Rp 0).
    rutin = new Map<string, number>()
    for (const [id, monthlyAmt] of bulananPerOutlet) {
      if (monthlyAmt <= 0) continue
      const amt = partialRatios.has(id)
        ? Math.round(monthlyAmt * partialRatios.get(id)!)
        : (info.isProrated ? Math.round(monthlyAmt * info.ratio) : monthlyAmt)
      if (amt > 0) rutin.set(id, amt)
    }
  } else {
    const totalRutin = info.isProrated ? Math.round(bulananKartuCabang * info.ratio) : bulananKartuCabang
    rutin = bagiPersis(totalRutin, rutinBulanan)
  }

  return {
    info,
    defaultRatio,
    ringkasanOutlet,
    nama,
    idDariNama,
    tambah,
    partialRatios,
    pusatRutinDalamHr,
    bulananPerOutlet,
    rutin,
  }
}

export interface BarisPayrollHrInput {
  /** Ringkasan HR untuk target 'ALL_OUTLETS' pada rentang yang sama. */
  hr: HRPayrollSummary | null | undefined
  from: string
  to: string
}

function barisPayrollSatuPeriode(
  hr: HRPayrollSummary,
  from: string,
  to: string,
  idMid?: string,
): ExpenseRow[] {
  const { info, ringkasanOutlet, nama, idDariNama, tambah, rutin } = hitungPetaRutinCabangSatuPeriode(hr, from, to)
  const periodMonth = from.slice(0, 7) + '-01'

  // 2. Bonus kru per outlet (rincian HR hanya membawa nama outlet).
  const bonusKruMentah = new Map<string, number>()
  const perOutlet = Object.entries(hr.crewBonusByOutlet ?? {})
  if (perOutlet.length > 0) {
    // Bonus per outlet tempat bonus itu diperoleh — sama dengan tampilan satu outlet.
    perOutlet.forEach(([id, b]) => { if (Number(b) > 0) tambah(bonusKruMentah, id, Number(b)) })
  } else {
    // Cadangan (bonus dari slip, tanpa data harian): rincian per staf, dipetakan lewat nama outlet.
    ;(hr.crewBonusDetails ?? []).forEach(c => {
      const id = idDariNama.get((c.outletName || '').trim().toLowerCase()) ?? '__tak_dikenal__'
      tambah(bonusKruMentah, id, Number(c.bonus) || 0)
    })
  }
  const bonusKru = bagiPersis(Math.round(hr.crewBonus ?? 0), bonusKruMentah)

  // 3. Bonus AM & RM per outlet (hanya outlet yang punya manajer binaan).
  const bonusMgrMentah = new Map<string, number>()
  ringkasanOutlet.forEach(o => {
    if (!o.outletId || o.outletId === 'PUSAT') return
    const b = Number(o.managerBonusAllocation) || 0
    if (b > 0) tambah(bonusMgrMentah, o.outletId, b)
  })
  const bonusMgr = bagiPersis(Math.round(hr.managerBonusAllocation ?? 0), bonusMgrMentah)

  const rows: ExpenseRow[] = []
  const dorong = (peta: Map<string, number>, kategori: ExpenseRow['category'], awalan: string, keterangan: string) => {
    for (const [id, amount] of peta) {
      if (!amount) continue
      const takDikenal = id === '__tak_dikenal__'
      const rowId = idMid ? `hr-${awalan}-${idMid}-${id}` : `hr-${awalan}-${id}`
      rows.push({
        id: rowId,
        outlet_id: takDikenal ? null : id,
        outlet_name: takDikenal ? 'Outlet Tidak Dikenal' : (nama.get(id) ?? 'Outlet'),
        category: kategori,
        scope: 'outlet',
        amount,
        description: keterangan,
        expense_date: to,
        period_month: periodMonth,
        source: 'monthly',
      })
    }
  }
  dorong(rutin, 'gaji_crew_outlet', 'gaji', info.isProrated ? `Gaji Rutin (HR Payroll · ${info.label})` : 'Gaji Rutin (HR Payroll)')
  dorong(bonusKru, 'bonus_crew', 'bonus-kru', 'Bonus Kru (HR · realtime penjualan)')
  dorong(bonusMgr, 'bonus_area_manager', 'bonus-am-rm', 'Bonus AM & RM (HR · realtime penjualan)')
  return rows
}

/**
 * Baris gaji rutin, bonus kru, dan bonus AM/RM per outlet. `null` bila HR
 * belum punya slip untuk rentang ini — pemanggil lalu memakai angka mesin
 * prorata, sama seperti kartu Buku Kas.
 *
 * Untuk rentang lintas bulan (`hr.periodBreakdown.length > 1`), dihitung per bulan
 * kalender agar `expense_date` dan `period_month` tiap bulan akurat di grafik tren
 * Laba Rugi serta konsisten dengan penjumlahan bulan tunggal.
 */
export function barisPayrollDariHr({ hr, from, to }: BarisPayrollHrInput): ExpenseRow[] | null {
  if (!adaDataHr(hr)) return null
  if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
    const semua: ExpenseRow[] = []
    for (const entry of hr.periodBreakdown) {
      if (!adaDataHr(entry.summary)) continue
      const ym = `${entry.year}-${String(entry.month).padStart(2, '0')}`
      semua.push(...barisPayrollSatuPeriode(entry.summary, entry.from, entry.to, ym))
    }
    return semua
  }
  return barisPayrollSatuPeriode(hr, from, to)
}

/**
 * Rincian gaji rutin per outlet (termasuk `'PUSAT'` bila ada) untuk satu atau multi-periode.
 * Dipakai oleh modal Gaji (Section 2 & tabel per cabang) agar rasio outlet parsial,
 * cabang tutup, lintas bulan, dan Kantor Pusat identik dengan kartu Buku Kas & Laba Rugi.
 */
export function hitungRutinPerOutletPeriode(
  hr: HRPayrollSummary | null | undefined,
  from: string,
  to: string,
): Map<string, RincianRutinOutletPeriode> {
  const hasil = new Map<string, RincianRutinOutletPeriode>()
  if (!adaDataHr(hr)) return hasil

  const hitungSatu = (sHr: HRPayrollSummary, sFrom: string, sTo: string) => {
    const p = hitungPetaRutinCabangSatuPeriode(sHr, sFrom, sTo)
    const map = new Map<string, RincianRutinOutletPeriode>()
    const semuaId = new Set<string>([
      ...p.bulananPerOutlet.keys(),
      ...(sHr.outlets ?? []).filter(o => o.outletId && o.outletId !== 'PUSAT').map(o => o.outletId),
    ])
    const outletLookup = new Map((sHr.outlets ?? []).map(o => [o.outletId, o]))
    for (const id of semuaId) {
      const o = outletLookup.get(id)
      const rutin1Bln = p.bulananPerOutlet.get(id) ?? Math.max(0, (o?.totalSalary ?? 0) - (o?.bonus ?? 0))
      const rutinPeriode = p.rutin.get(id) ?? 0
      const itemRatio = p.partialRatios.has(id)
        ? p.partialRatios.get(id)!
        : (rutin1Bln > 0 ? rutinPeriode / rutin1Bln : p.defaultRatio)
      const mgr1Bln = Number(o?.managerRoutineAllocation ?? o?.managerAllocation) || 0
      const mgrPeriode = Math.round(mgr1Bln * itemRatio)
      map.set(id, { rutin1Bln, rutinPeriode, mgr1Bln, mgrPeriode, itemRatio })
    }
    const adaPusat = p.pusatRutinDalamHr > 0 || (sHr.outlets ?? []).some(o => o.outletId === 'PUSAT')
    if (adaPusat) {
      const pusatOut = outletLookup.get('PUSAT')
      const pusatTotalStaf = (sHr.staffDetails ?? [])
        .filter(s => !s.isManagerAllocation && s.outletId === 'PUSAT')
        .reduce((sum, s) => sum + (Number(s.routineSalary) || 0) + (Number(s.bonus) || 0), 0)
      const rutin1Bln = pusatTotalStaf > 0
        ? pusatTotalStaf
        : Math.max(0, pusatOut?.totalSalary ?? 0)
      const rutinPeriode = p.info.isProrated ? Math.round(rutin1Bln * p.info.ratio) : rutin1Bln
      map.set('PUSAT', {
        rutin1Bln,
        rutinPeriode,
        mgr1Bln: 0,
        mgrPeriode: 0,
        itemRatio: p.defaultRatio,
      })
    }
    return map
  }

  if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
    // Baseline 1 bln dari ringkasan referensi top-level; beban periode dijumlahkan per bulan kalender.
    const refFrom = `${to.slice(0, 7)}-01`
    const baseMap = hitungSatu(hr, refFrom, to)
    const akumPeriode = new Map<string, { rutinPeriode: number; mgrPeriode: number }>()
    for (const entry of hr.periodBreakdown) {
      if (!adaDataHr(entry.summary)) continue
      const subMap = hitungSatu(entry.summary, entry.from, entry.to)
      for (const [id, v] of subMap) {
        const prev = akumPeriode.get(id) ?? { rutinPeriode: 0, mgrPeriode: 0 }
        prev.rutinPeriode += v.rutinPeriode
        prev.mgrPeriode += v.mgrPeriode
        akumPeriode.set(id, prev)
        if (!baseMap.has(id)) {
          baseMap.set(id, { rutin1Bln: v.rutin1Bln, rutinPeriode: 0, mgr1Bln: v.mgr1Bln, mgrPeriode: 0, itemRatio: 0 })
        }
      }
    }
    for (const [id, base] of baseMap) {
      const ak = akumPeriode.get(id) ?? { rutinPeriode: 0, mgrPeriode: 0 }
      const itemRatio = base.rutin1Bln > 0 ? ak.rutinPeriode / base.rutin1Bln : 0
      hasil.set(id, {
        rutin1Bln: base.rutin1Bln,
        rutinPeriode: ak.rutinPeriode,
        mgr1Bln: base.mgr1Bln,
        mgrPeriode: ak.mgrPeriode,
        itemRatio,
      })
    }
    return hasil
  }

  return hitungSatu(hr, from, to)
}

/**
 * Hitung total gaji rutin yang diakui pada rentang `[from, to]` untuk kartu Buku Kas
 * (`target`: `'ALL_OUTLETS'`, `'PUSAT'`, `'all'`, atau UUID 1 outlet), mendukung rentang
 * satu bulan maupun lintas bulan (`periodBreakdown`) dengan selisih Rp 0 terhadap Laba Rugi.
 */
export function hitungGajiRutinPeriodeDariHr(params: {
  hr: HRPayrollSummary | null | undefined
  from: string
  to: string
  target: string
}): number {
  const { hr, from, to, target } = params
  if (!adaDataHr(hr)) return 0

  if (target === 'ALL_OUTLETS') {
    const baris = barisPayrollDariHr({ hr, from, to }) ?? []
    return baris.filter(r => r.category === 'gaji_crew_outlet').reduce((s, r) => s + r.amount, 0)
  }

  if (target === 'PUSAT') {
    if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
      let total = 0
      for (const entry of hr.periodBreakdown) {
        if (!adaDataHr(entry.summary)) continue
        const info = calculateDateRangeProrata(entry.from, entry.to)
        const bulanan = gajiRutinBulananKartu(entry.summary, true)
        total += info.isProrated ? Math.round(bulanan * info.ratio) : bulanan
      }
      return total
    }
    const info = calculateDateRangeProrata(from, to)
    const bulanan = gajiRutinBulananKartu(hr, true)
    return info.isProrated ? Math.round(bulanan * info.ratio) : bulanan
  }

  if (target === 'all') {
    const barisCabang = barisPayrollDariHr({ hr, from, to }) ?? []
    const cabangPeriode = barisCabang.filter(r => r.category === 'gaji_crew_outlet').reduce((s, r) => s + r.amount, 0)
    let pusatPeriode = 0
    if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
      for (const entry of hr.periodBreakdown) {
        if (!adaDataHr(entry.summary)) continue
        const info = calculateDateRangeProrata(entry.from, entry.to)
        const pusatBulanan = (entry.summary.staffDetails ?? [])
          .filter(s => !s.isManagerAllocation && s.outletId === 'PUSAT')
          .reduce((s, r) => s + (Number(r.routineSalary) || 0) + (Number(r.bonus) || 0), 0)
        pusatPeriode += info.isProrated ? Math.round(pusatBulanan * info.ratio) : pusatBulanan
      }
    } else {
      const info = calculateDateRangeProrata(from, to)
      const pusatBulanan = (hr.staffDetails ?? [])
        .filter(s => !s.isManagerAllocation && s.outletId === 'PUSAT')
        .reduce((s, r) => s + (Number(r.routineSalary) || 0) + (Number(r.bonus) || 0), 0)
      pusatPeriode = info.isProrated ? Math.round(pusatBulanan * info.ratio) : pusatBulanan
    }
    return cabangPeriode + pusatPeriode
  }

  // Tampilan 1 outlet tunggal
  const hitungSatuOutlet = (sHr: HRPayrollSummary, sFrom: string, sTo: string) => {
    if (!adaDataHr(sHr)) return 0
    const info = calculateDateRangeProrata(sFrom, sTo)
    const bulanan = gajiRutinBulananKartu(sHr, false)
    const defaultRatio = info.isProrated ? info.ratio : 1
    const op = sHr.outletOperationalInfo
    if (op?.isPartial) {
      const r = hitungRasioOverlapOutlet(
        {
          isPartial: op.isPartial,
          operationalFirstDate: op.firstDate,
          operationalLastDate: op.lastDate,
          operationalCalendarDays: op.operationalCalendarDays,
        },
        sFrom,
        sTo,
        defaultRatio,
      )
      return r < 1 ? Math.round(bulanan * r) : bulanan
    }
    return info.isProrated ? Math.round(bulanan * info.ratio) : bulanan
  }

  if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
    let total = 0
    for (const entry of hr.periodBreakdown) {
      total += hitungSatuOutlet(entry.summary, entry.from, entry.to)
    }
    return total
  }
  return hitungSatuOutlet(hr, from, to)
}

/** Ganti baris gaji/bonus outlet buatan mesin prorata dengan baris HR. */
export function gantiPayrollDenganHr(rows: ExpenseRow[], barisHr: ExpenseRow[] | null): ExpenseRow[] {
  if (!barisHr) return rows
  const kategori = KATEGORI_PAYROLL_OUTLET as readonly string[]
  const sisa = rows.filter(r => !(r.scope === 'outlet' && kategori.includes(r.category) && String(r.id).startsWith('prorata-')))
  return [...sisa, ...barisHr]
}


/**
 * Potong ringkasan HR tampilan "Semua Outlet" menjadi satu kelompok outlet
 * (Internal atau Mitra), lengkap dengan rincian kru dan manajer untuk modal Gaji.
 * Angkanya memakai pembagian per outlet yang sama dengan `barisPayrollDariHr`,
 * sehingga jumlahnya cocok dengan kartu Gaji & bonus pada pilihan yang sama.
 *
 * `pusat` (opsional) = ringkasan HR target 'PUSAT'; dipakai pada pilihan
 * "Internal + Kantor Pusat" untuk menambahkan staf kantor pusat sebagai kru.
 */
export function ringkasanHrKelompok(
  hr: HRPayrollSummary | null | undefined,
  dalamKelompok: (outletId: string) => boolean,
  pusat?: HRPayrollSummary | null,
): HRPayrollSummary | null {
  if (!adaDataHr(hr)) return null
  const bukanPusat = (id?: string | null): id is string => Boolean(id) && id !== 'PUSAT'

  // 1. Kru: gaji rutin per outlet (mendukung kru mutasi lintas cabang via outletBreakdowns,
  //    kru outlet parsial, serta kru backup 1/N, persis sama dengan barisPayrollDariHr).
  const kru: StaffPayrollDetail[] = []
  let gapok = 0
  let tunjangan = 0
  let potongan = 0
  let fullGapok = 0
  let fullTunj = 0
  let fullPot = 0
  for (const s of hr.staffDetails ?? []) {
    if (s.isManagerAllocation) continue
    const penuhPokok = Number(s.fullBasicSalary ?? s.basicSalary) || 0
    const penuhTunj = Number(s.fullAllowances ?? s.allowances) || 0
    const penuhPot = Number(s.fullDeductions ?? s.deductions) || 0

    if (s.outletBreakdowns && s.outletBreakdowns.length > 0) {
      const matching = s.outletBreakdowns.filter(b => bukanPusat(b.outletId) && dalamKelompok(b.outletId))
      if (matching.length === 0) continue
      const sp = matching.reduce((t, b) => t + (Number(b.basicSalary) || 0), 0)
      const st = matching.reduce((t, b) => t + (Number(b.allowances) || 0), 0)
      const sd = matching.reduce((t, b) => t + (Number(b.deductions) || 0), 0)
      const sr = matching.reduce((t, b) => t + (Number(b.routineSalary) || 0), 0)
      const attDays = matching.reduce((t, b) => t + (Number(b.attendanceDays) || 0), 0)
      gapok += sp; tunjangan += st; potongan += sd
      fullGapok += penuhPokok; fullTunj += penuhTunj; fullPot += penuhPot
      kru.push({
        ...s,
        outletId: matching.length === 1 ? matching[0].outletId : s.outletId,
        outletName: matching.map(m => m.outletName).join(' + '),
        basicSalary: sp,
        allowances: st,
        deductions: sd,
        routineSalary: sr,
        attendanceDays: attDays,
        outletBreakdowns: matching,
      })
      continue
    }

    if (!bukanPusat(s.outletId)) continue
    const tujuan = (s.allocatedOutletIds ?? []).filter(bukanPusat)
    if (s.isBackupAllocation && tujuan.length > 1) {
      const dalam = tujuan.filter(dalamKelompok)
      if (dalam.length === 0) continue
      const pokok = distributeEqualSplit(penuhPokok, tujuan)
      const tunj = distributeEqualSplit(penuhTunj, tujuan)
      const pot = distributeEqualSplit(penuhPot, tujuan)
      const sp = dalam.reduce((t, id) => t + (pokok.get(id) || 0), 0)
      const st = dalam.reduce((t, id) => t + (tunj.get(id) || 0), 0)
      const sd = dalam.reduce((t, id) => t + (pot.get(id) || 0), 0)
      gapok += sp; tunjangan += st; potongan += sd
      fullGapok += sp; fullTunj += st; fullPot += sd
      kru.push({ ...s, basicSalary: sp, allowances: st, deductions: sd, routineSalary: sp + st - sd })
      continue
    }
    if (!dalamKelompok(s.outletId)) continue
    const akuiPokok = Number(s.basicSalary) || 0
    const akuiTunj = Number(s.allowances) || 0
    const akuiPot = Number(s.deductions) || 0
    const akuiRutin = s.routineSalary !== undefined ? (Number(s.routineSalary) || 0) : (akuiPokok + akuiTunj - akuiPot)
    gapok += akuiPokok; tunjangan += akuiTunj; potongan += akuiPot
    fullGapok += penuhPokok; fullTunj += penuhTunj; fullPot += penuhPot
    kru.push({ ...s, basicSalary: akuiPokok, allowances: akuiTunj, deductions: akuiPot, routineSalary: akuiRutin })
  }

  // Staf kantor pusat (hanya untuk "Internal + Kantor Pusat").
  // Insentif/bonus slip bulanan staf kantor ikut sebagai tunjangan/rutin pusat
  // agar selaras dengan `susunBarisGajiKantor` di Laba Rugi (kartu Bonus Kru khusus POS ritel).
  if (adaDataHr(pusat)) {
    const pGapok = Number(pusat.basicSalary) || 0
    const pTunj = (Number(pusat.allowances) || 0) + (Number(pusat.bonus) || 0)
    const pPot = Number(pusat.deductions) || 0
    gapok += pGapok
    tunjangan += pTunj
    potongan += pPot
    fullGapok += pGapok
    fullTunj += pTunj
    fullPot += pPot
    kru.push(
      ...(pusat.staffDetails ?? [])
        .filter(s => !s.isManagerAllocation)
        .map(s => {
          const sBonus = Number(s.bonus) || 0
          if (sBonus <= 0) return s
          const sAllow = (Number(s.allowances) || 0) + sBonus
          const sRoutine = (Number(s.routineSalary) || 0) + sBonus
          return {
            ...s,
            allowances: sAllow,
            bonus: 0,
            routineSalary: sRoutine,
            fullAllowances: (Number(s.fullAllowances ?? s.allowances) || 0) + sBonus,
            fullRoutineSalary: (Number(s.fullRoutineSalary ?? s.routineSalary) || 0) + sBonus,
          }
        }),
    )
  }

  // 2. Bonus kru per outlet dalam kelompok.
  const bonusPerOutlet = hr.crewBonusByOutlet ?? {}
  let crewBonus = 0
  let crewBonusDetails: StaffBonusDetail[] = []
  if (Object.keys(bonusPerOutlet).length > 0) {
    crewBonus = Object.entries(bonusPerOutlet)
      .filter(([id]) => dalamKelompok(id))
      .reduce((t, [, b]) => t + (Number(b) || 0), 0)
    const peta = new Map<string, StaffBonusDetail>()
    for (const [id, daftar] of Object.entries(hr.crewBonusDetailsByOutlet ?? {})) {
      if (!dalamKelompok(id)) continue
      for (const d of daftar) {
        const ada = peta.get(d.staffId)
        if (!ada) { peta.set(d.staffId, { ...d, backupDates: [...(d.backupDates ?? [])] }); continue }
        ada.bonus += d.bonus
        ada.totalPcs = (ada.totalPcs ?? 0) + (d.totalPcs ?? 0)
        ada.backupDates = Array.from(new Set([...(ada.backupDates ?? []), ...(d.backupDates ?? [])])).sort()
      }
    }
    crewBonusDetails = [...peta.values()].sort((a, b) => b.bonus - a.bonus)
  } else {
    // Cadangan (bonus dari slip, tanpa data harian): ikut outlet asal kru.
    const idKru = new Set(kru.map(s => s.staffId))
    crewBonusDetails = (hr.crewBonusDetails ?? []).filter(c => idKru.has(c.staffId))
    crewBonus = crewBonusDetails.reduce((t, c) => t + (Number(c.bonus) || 0), 0)
  }

  // 3. Manajer (AM/RM/SC): jumlahkan alokasi di outlet dalam kelompok.
  const manajer = new Map<string, ManagerAllocationDetail>()
  const outletManajer = new Map<string, Set<string>>()
  let mgrPokok = 0
  let mgrTunj = 0
  let mgrPot = 0
  let fullMgrRutin = 0
  for (const [id, daftar] of Object.entries(hr.managerDetailsByOutlet ?? {})) {
    if (!dalamKelompok(id)) continue
    for (const d of daftar) {
      const set = outletManajer.get(d.staffId) ?? new Set<string>()
      set.add(id)
      outletManajer.set(d.staffId, set)
      const dPokok = d.allocatedBasicSalary ?? 0
      const dTunj = d.allocatedAllowances ?? 0
      const dPot = d.allocatedDeductions ?? 0
      const dFullBasic = d.fullAllocatedBasicSalary ?? dPokok
      const dFullAllow = d.fullAllocatedAllowances ?? dTunj
      const dFullDed = d.fullAllocatedDeductions ?? dPot
      const dFullRoutine = d.fullAllocatedRoutine ?? (dFullBasic + dFullAllow - dFullDed)
      mgrPokok += dPokok
      mgrTunj += dTunj
      mgrPot += dPot
      fullMgrRutin += dFullRoutine
      const ada = manajer.get(d.staffId)
      if (!ada) {
        manajer.set(d.staffId, {
          ...d,
          fullAllocatedBasicSalary: dFullBasic,
          fullAllocatedAllowances: dFullAllow,
          fullAllocatedDeductions: dFullDed,
          fullAllocatedRoutine: dFullRoutine,
          coachedOutletsCount: set.size,
        })
        continue
      }
      ada.allocatedAmount += d.allocatedAmount
      ada.routineAmount = (ada.routineAmount ?? 0) + (d.routineAmount ?? 0)
      ada.bonusAmount = (ada.bonusAmount ?? 0) + (d.bonusAmount ?? 0)
      ada.allocatedBasicSalary = (ada.allocatedBasicSalary ?? 0) + dPokok
      ada.allocatedAllowances = (ada.allocatedAllowances ?? 0) + dTunj
      ada.allocatedDeductions = (ada.allocatedDeductions ?? 0) + dPot
      ada.fullAllocatedBasicSalary = (ada.fullAllocatedBasicSalary ?? 0) + dFullBasic
      ada.fullAllocatedAllowances = (ada.fullAllocatedAllowances ?? 0) + dFullAllow
      ada.fullAllocatedDeductions = (ada.fullAllocatedDeductions ?? 0) + dFullDed
      ada.fullAllocatedRoutine = (ada.fullAllocatedRoutine ?? 0) + dFullRoutine
      ada.totalPcs = (ada.totalPcs ?? 0) + (d.totalPcs ?? 0)
      ada.coachedOutletsCount = set.size
    }
  }
  const managerDetails = [...manajer.values()]
  const mgrRutin = mgrPokok + mgrTunj - mgrPot
  const mgrBonus = managerDetails.reduce((t, m) => t + (m.bonusAmount ?? 0), 0)
  const managerBonusDetails: StaffBonusDetail[] = managerDetails
    .filter(m => (m.bonusAmount ?? 0) > 0 || m.role === 'area_manager' || m.role === 'regional_manager')
    .map(m => ({
      staffId: m.staffId,
      staffName: m.staffName,
      role: m.role,
      outletName: m.role === 'regional_manager' ? 'Rp 50 / pcs (Wilayah Regional)' : 'Rp 50 / pcs (Cabang Binaan)',
      bonus: m.bonusAmount ?? 0,
      totalPcs: m.totalPcs ?? Math.round((m.bonusAmount ?? 0) / 50),
      status: m.status,
    }))

  // 4. Komposisi kru & status.
  let reguler = 0, backup = 0, trainee = 0, ojt = 0
  for (const s of kru) {
    if (s.contractType === 'daily' || s.subRole === 'crew_backup') backup++
    else if (s.contractType === 'probation' || s.subRole === 'crew_trainee') trainee++
    else if (s.contractType === 'intern' || s.onboardingStage === 'ojt') ojt++
    else reguler++
  }
  const finalKru = kru.filter(s => s.status === 'finalized').length
  const finalMgr = managerDetails.filter(m => m.status === 'finalized').length
  const jumlahFinal = finalKru + finalMgr
  const jumlahDraft = kru.length + managerDetails.length - jumlahFinal
  const status: HRPayrollSummary['status'] =
    kru.length + managerDetails.length === 0 ? 'empty'
      : jumlahFinal > 0 && jumlahDraft === 0 ? 'finalized'
      : jumlahDraft > 0 && jumlahFinal === 0 ? 'draft'
      : 'partial'

  const basicSalary = gapok + mgrPokok
  const allowances = tunjangan + mgrTunj
  const deductions = potongan + mgrPot
  const bonus = crewBonus + mgrBonus

  const outletsKelompok: HRPayrollOutletSummary[] = (hr.outlets ?? []).filter(
    o => bukanPusat(o.outletId) && dalamKelompok(o.outletId),
  )
  if (adaDataHr(pusat)) {
    const pGapok = Number(pusat.basicSalary) || 0
    const pTunj = (Number(pusat.allowances) || 0) + (Number(pusat.bonus) || 0)
    const pPot = Number(pusat.deductions) || 0
    const pRutin = Math.max(0, pGapok + pTunj - pPot)
    const pusatKruCount = (pusat.staffDetails ?? []).filter(s => !s.isManagerAllocation).length || pusat.totalStaff
    outletsKelompok.push({
      outletId: 'PUSAT',
      outletName: 'Kantor Pusat',
      totalSalary: pRutin,
      crewSalary: pRutin,
      basicSalary: pGapok,
      bonus: 0,
      managerAllocation: 0,
      managerRoutineAllocation: 0,
      managerBonusAllocation: 0,
      staffCount: pusatKruCount,
      draftCount: pusat.draftCount,
      finalizedCount: pusat.finalizedCount,
      status: pusat.status,
    })
    outletsKelompok.sort((a, b) => b.totalSalary - a.totalSalary)
  }

  let periodBreakdown: HRPayrollPeriodEntry[] | undefined
  if (hr.periodBreakdown && hr.periodBreakdown.length > 1) {
    periodBreakdown = []
    for (const entry of hr.periodBreakdown) {
      const pEntry = pusat?.periodBreakdown?.find(pe => pe.year === entry.year && pe.month === entry.month)
      const subSummary = ringkasanHrKelompok(entry.summary, dalamKelompok, pEntry?.summary ?? null)
      if (subSummary) {
        periodBreakdown.push({
          year: entry.year,
          month: entry.month,
          from: entry.from,
          to: entry.to,
          summary: subSummary,
        })
      }
    }
  }

  return {
    totalSalary: basicSalary + allowances + bonus - deductions,
    totalStaff: kru.length + managerDetails.length,
    basicSalary,
    allowances,
    bonus,
    deductions,
    draftCount: jumlahDraft,
    draftAmount: 0,
    finalizedCount: jumlahFinal,
    finalizedAmount: 0,
    status,
    outlets: outletsKelompok,
    crewCount: kru.length,
    crewRegularCount: reguler,
    crewBackupCount: backup,
    crewTraineeCount: trainee,
    crewOjtCount: ojt,
    crewBasicSalary: gapok,
    crewAllowances: tunjangan,
    crewDeductions: potongan,
    fullCrewBasicSalary: fullGapok,
    fullCrewAllowances: fullTunj,
    fullCrewDeductions: fullPot,
    fullCrewRoutineSalary: Math.max(0, fullGapok + fullTunj - fullPot),
    fullManagerAllocation: fullMgrRutin > 0 ? fullMgrRutin : mgrRutin,
    fullTotalRoutineSalary: Math.max(0, fullGapok + fullTunj - fullPot) + (fullMgrRutin > 0 ? fullMgrRutin : mgrRutin),
    crewBonus,
    managerAllocation: mgrRutin,
    managerRoutineAllocation: mgrRutin,
    managerBonusAllocation: mgrBonus,
    managerBasicSalaryAllocation: mgrPokok,
    managerAllowancesAllocation: mgrTunj,
    managerDeductionsAllocation: mgrPot,
    managerDetails,
    managerDetailsByOutlet: Object.fromEntries(Object.entries(hr.managerDetailsByOutlet ?? {}).filter(([id]) => dalamKelompok(id))),
    crewBonusDetails,
    managerBonusDetails,
    bonusDetails: [...crewBonusDetails, ...managerBonusDetails].sort((a, b) => b.bonus - a.bonus),
    staffDetails: kru,
    periodBreakdown,
  }
}
