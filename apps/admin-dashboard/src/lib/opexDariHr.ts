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
import type { HRPayrollSummary, ManagerAllocationDetail, StaffBonusDetail, StaffPayrollDetail } from '@/lib/server/ringkasanPayrollHr'
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
 */
export function gajiRutinBulananKartu(hr: HRPayrollSummary, isPusat: boolean): number {
  const gapok = Math.round(isPusat ? hr.basicSalary : (hr.crewBasicSalary ?? hr.basicSalary))
  const tunjangan = Math.round(isPusat ? hr.allowances : (hr.crewAllowances ?? hr.allowances))
  const potongan = Math.round(isPusat ? hr.deductions : (hr.crewDeductions ?? hr.deductions))
  const rutinStaf = Math.max(0, gapok + tunjangan - potongan)
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

export interface BarisPayrollHrInput {
  /** Ringkasan HR untuk target 'ALL_OUTLETS' pada rentang yang sama. */
  hr: HRPayrollSummary | null | undefined
  from: string
  to: string
}

/**
 * Baris gaji rutin, bonus kru, dan bonus AM/RM per outlet. `null` bila HR
 * belum punya slip untuk rentang ini — pemanggil lalu memakai angka mesin
 * prorata, sama seperti kartu Buku Kas.
 */
export function barisPayrollDariHr({ hr, from, to }: BarisPayrollHrInput): ExpenseRow[] | null {
  if (!adaDataHr(hr)) return null
  const info = calculateDateRangeProrata(from, to)
  const periodMonth = from.slice(0, 7) + '-01'
  const ringkasanOutlet = hr.outlets ?? []

  const nama = new Map<string, string>()
  const idDariNama = new Map<string, string>()
  const catat = (id?: string | null, n?: string | null) => {
    if (!id || id === 'PUSAT' || !n) return
    if (!nama.has(id)) nama.set(id, n)
    if (!idDariNama.has(n.trim().toLowerCase())) idDariNama.set(n.trim().toLowerCase(), id)
  }
  ringkasanOutlet.forEach(o => catat(o.outletId, o.outletName))
  ;(hr.staffDetails ?? []).forEach(s => catat(s.outletId, s.outletName))

  // 1. Gaji rutin bulanan per outlet = rutin kru + alokasi rutin manajer.
  const rutinBulanan = new Map<string, number>()
  const tambah = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v)
  ;(hr.staffDetails ?? []).forEach(s => {
    if (s.isManagerAllocation || !s.outletId || s.outletId === 'PUSAT') return
    // Kru backup yang bertugas di beberapa outlet: gajinya dibagi rata per
    // komponen, dengan fungsi yang SAMA dengan tampilan satu outlet di Buku Kas
    // (hrPayroll.ts). Tanpa ini seluruh gajinya menumpuk di outlet asal, sehingga
    // angka per outlet — dan pembagian Internal/Mitra — tidak cocok dengan Buku Kas.
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
  const bulananKartu = gajiRutinBulananKartu(hr, false)
  const totalRutin = info.isProrated ? Math.round(bulananKartu * info.ratio) : bulananKartu
  const rutin = bagiPersis(totalRutin, rutinBulanan)

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
      rows.push({
        id: `hr-${awalan}-${id}`,
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

  // 1. Kru: gaji rutin per outlet (kru backup lintas outlet dibagi rata, sama seperti barisPayrollDariHr).
  const kru: StaffPayrollDetail[] = []
  let gapok = 0
  let tunjangan = 0
  let potongan = 0
  for (const s of hr.staffDetails ?? []) {
    if (s.isManagerAllocation || !bukanPusat(s.outletId)) continue
    const penuhPokok = Number(s.fullBasicSalary ?? s.basicSalary) || 0
    const penuhTunj = Number(s.fullAllowances ?? s.allowances) || 0
    const penuhPot = Number(s.fullDeductions ?? s.deductions) || 0
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
      kru.push({ ...s, basicSalary: sp, allowances: st, deductions: sd, routineSalary: sp + st - sd })
      continue
    }
    if (!dalamKelompok(s.outletId)) continue
    gapok += penuhPokok; tunjangan += penuhTunj; potongan += penuhPot
    kru.push({ ...s, routineSalary: penuhPokok + penuhTunj - penuhPot })
  }

  // Staf kantor pusat (hanya untuk "Internal + Kantor Pusat").
  if (adaDataHr(pusat)) {
    gapok += Number(pusat.basicSalary) || 0
    tunjangan += Number(pusat.allowances) || 0
    potongan += Number(pusat.deductions) || 0
    kru.push(...(pusat.staffDetails ?? []).filter(s => !s.isManagerAllocation))
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
  for (const [id, daftar] of Object.entries(hr.managerDetailsByOutlet ?? {})) {
    if (!dalamKelompok(id)) continue
    for (const d of daftar) {
      const set = outletManajer.get(d.staffId) ?? new Set<string>()
      set.add(id)
      outletManajer.set(d.staffId, set)
      mgrPokok += d.allocatedBasicSalary ?? 0
      mgrTunj += d.allocatedAllowances ?? 0
      mgrPot += d.allocatedDeductions ?? 0
      const ada = manajer.get(d.staffId)
      if (!ada) { manajer.set(d.staffId, { ...d, coachedOutletsCount: set.size }); continue }
      ada.allocatedAmount += d.allocatedAmount
      ada.routineAmount = (ada.routineAmount ?? 0) + (d.routineAmount ?? 0)
      ada.bonusAmount = (ada.bonusAmount ?? 0) + (d.bonusAmount ?? 0)
      ada.allocatedBasicSalary = (ada.allocatedBasicSalary ?? 0) + (d.allocatedBasicSalary ?? 0)
      ada.allocatedAllowances = (ada.allocatedAllowances ?? 0) + (d.allocatedAllowances ?? 0)
      ada.allocatedDeductions = (ada.allocatedDeductions ?? 0) + (d.allocatedDeductions ?? 0)
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
    outlets: (hr.outlets ?? []).filter(o => bukanPusat(o.outletId) && dalamKelompok(o.outletId)),
    crewCount: kru.length,
    crewRegularCount: reguler,
    crewBackupCount: backup,
    crewTraineeCount: trainee,
    crewOjtCount: ojt,
    crewBasicSalary: gapok,
    crewAllowances: tunjangan,
    crewDeductions: potongan,
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
  }
}
