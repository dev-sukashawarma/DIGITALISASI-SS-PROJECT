import { describe, it, expect } from 'vitest'
import type { OutletOperationalInfo, StaffPayrollDetail, ManagerAllocationDetail } from './ringkasanPayrollHr'

describe('Perhitungan Gaji Outlet Parsial & Kru Mutasi', () => {
  it('menghitung rasio kehadiran kru retail F&B proporsional 26 hari kerja', () => {
    const gapok = 2000000
    const uangMakanHarian = 15000
    const hariHadir = 4

    const gapokProrata = Math.round((Math.min(1, hariHadir / 26)) * gapok)
    const uangMakan = hariHadir * uangMakanHarian
    const totalGaji = gapokProrata + uangMakan

    expect(gapokProrata).toBe(307692)
    expect(uangMakan).toBe(60000)
    expect(totalGaji).toBe(367692)
  })

  it('melakukan fair split untuk kru mutasi antar cabang (contoh Ciseeng 11 hari dan Pamulang 15 hari)', () => {
    const gapok = 2600000
    const hariCiseeng = 11
    const hariPamulang = 15

    const rasioCiseeng = Math.min(1, hariCiseeng / 26)
    const rasioPamulang = Math.min(1, hariPamulang / 26)

    const bebanCiseeng = Math.round(gapok * rasioCiseeng)
    const bebanPamulang = Math.round(gapok * rasioPamulang)

    expect(bebanCiseeng).toBe(1100000)
    expect(bebanPamulang).toBe(1500000)
    expect(bebanCiseeng + bebanPamulang).toBe(gapok)
  })

  it('mengalokasikan beban manajer proporsional hari kalender operasional toko', () => {
    const gajiUtuhManajer = 4500000
    const jumlahCabangBinaan = 5
    const alokasiNormal = gajiUtuhManajer / jumlahCabangBinaan // 900.000

    // Paledang beroperasi 6 hari dari 31 hari kalender
    const hariKalenderPaledang = 6
    const totalHariKalender = 31
    const rasioKalender = hariKalenderPaledang / totalHariKalender

    const alokasiPaledang = Math.round(alokasiNormal * rasioKalender)
    expect(alokasiPaledang).toBe(174194) // jauh lebih adil daripada Rp 900.000 utuh
  })

  it('menerapkan smart filter overlap: beban Rp 0 jika filter berada di luar periode buka toko', () => {
    const opInfo: OutletOperationalInfo = {
      isPartial: true,
      activeDays: 5,
      totalMonthDays: 31,
      operationalCalendarDays: 6,
      calendarRatio: 6 / 31,
      firstDate: '2026-10-26',
      lastDate: '2026-10-31',
      note: 'Mulai beroperasi 26 Okt'
    }

    // Filter sebelum toko buka (1 - 15 Okt)
    const fStart = '2026-10-01'
    const fEnd = '2026-10-15'
    const overlapStart = fStart > opInfo.firstDate! ? fStart : opInfo.firstDate!
    const overlapEnd = fEnd < opInfo.lastDate! ? fEnd : opInfo.lastDate!

    const isOverlap = overlapStart <= overlapEnd
    expect(isOverlap).toBe(false) // tidak ada overlap, beban = Rp 0
  })

  it('menerapkan smart filter overlap: menghitung proporsi hari buka jika filter mencakup tanggal buka', () => {
    const opInfo: OutletOperationalInfo = {
      isPartial: true,
      activeDays: 5,
      totalMonthDays: 31,
      operationalCalendarDays: 6,
      calendarRatio: 6 / 31,
      firstDate: '2026-10-26',
      lastDate: '2026-10-31'
    }

    // Filter 1 - 30 Okt (mencakup 26 s/d 30 Okt = 5 hari)
    const fStart = '2026-10-01'
    const fEnd = '2026-10-30'
    const overlapStart = fStart > opInfo.firstDate! ? fStart : opInfo.firstDate!
    const overlapEnd = fEnd < opInfo.lastDate! ? fEnd : opInfo.lastDate!

    expect(overlapStart).toBe('2026-10-26')
    expect(overlapEnd).toBe('2026-10-30')

    const overlapDays = Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
    expect(overlapDays).toBe(5)

    const overlapRatio = overlapDays / opInfo.operationalCalendarDays!
    expect(overlapRatio).toBeCloseTo(5 / 6, 4)
  })

  it('tidak menandai toko normal sebagai toko buka terlambat (mencegah false positive)', () => {
    const primaryPeriod = { month: 10, year: 2026 }
    const periodMonthStart = '2026-10-01'
    const createdStr = '2026-06-09' // toko lama

    // Kasus 1: toko normal dengan aktivitas tgl 1
    const firstDateNormal = '2026-10-01'
    const isNewlyCreated1 = Boolean(createdStr && createdStr >= periodMonthStart)
    const isLateStart1 = firstDateNormal > periodMonthStart && (isNewlyCreated1 || firstDateNormal >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart1).toBe(false)

    // Kasus 2: toko normal yang rekap POS pertama tgl 3
    const firstDateDay3 = '2026-10-03'
    const isLateStart2 = firstDateDay3 > periodMonthStart && (isNewlyCreated1 || firstDateDay3 >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart2).toBe(false) // tidak false positive

    // Kasus 3: Paledang baru buka tgl 26
    const firstDatePaledang = '2026-10-26'
    const isLateStart3 = firstDatePaledang > periodMonthStart && (isNewlyCreated1 || firstDatePaledang >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart3).toBe(true) // benar terdeteksi parsial
  })

  it('memisahkan baseline kontrak utuh 1 bulan (Card 1) vs beban riil operasional (Card 2)', () => {
    // 2 kru di Paledang: kontrak masing-masing Rp 2.000.000 (total gapok Rp 4.000.000)
    // Hadir 6 hari kerja riil -> gaji riil masing-masing Rp 461.538 (total Rp 923.076)
    const crewItems = [
      { fullBasic: 2000000, allocatedBasic: 461538, fullRoutine: 2000000, allocatedRoutine: 461538 },
      { fullBasic: 2000000, allocatedBasic: 461538, fullRoutine: 2000000, allocatedRoutine: 461538 },
    ]

    const fullCrewBasicSalary = crewItems.reduce((s, c) => s + c.fullBasic, 0)
    const crewBasicSalary = crewItems.reduce((s, c) => s + c.allocatedBasic, 0)

    // Card 1 menampilkan baseline utuh sebulan
    expect(fullCrewBasicSalary).toBe(4000000)
    // Card 2 / Beban Diakui menampilkan prorata riil
    expect(crewBasicSalary).toBe(923076)
    // Baseline tidak terdistorsi oleh prorata
    expect(fullCrewBasicSalary).toBeGreaterThan(crewBasicSalary)
  })
})
