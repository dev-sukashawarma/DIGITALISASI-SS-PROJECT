import { describe, it, expect } from 'vitest'
import {
  buildBonusWorkbook,
  getExportBonusFilename,
  cleanOutletName,
} from './exportBonusExcel'
import type { CrewBonusRow, AMBonusRow, RMBonusRow, BonusSummaryData } from '@/hooks/useCrewBonus'

describe('exportBonusExcel', () => {
  const dummySummary: BonusSummaryData = {
    grand_total_bonus: 426251,
    total_pcs_global: 2149,
    total_crew_bonus: 214901,
    total_am_bonus: 103850,
    total_rm_bonus: 107500,
    active_crew_count: 57,
    active_am_count: 5,
    active_rm_count: 1,
  }

  const dummyCrew: CrewBonusRow[] = [
    {
      crew_id: 'crew-1',
      crew_name: 'Glang Gumala Putra',
      role: 'crew',
      outlet_id: 'out-1',
      outlet_name: 'GUDANG SS ONLINE',
      total_pcs_outlet: 0,
      bonus_rate: 100,
      attendance_days: 2,
      total_attendance_days: 4,
      active_crew_count: 3,
      total_bonus: 0,
    },
    {
      crew_id: 'crew-2',
      crew_name: 'Yunus',
      role: 'leader',
      outlet_id: 'out-2',
      outlet_name: 'SUKA SHAWARMA MITRA CIBINONG',
      total_pcs_outlet: 118,
      bonus_rate: 100,
      attendance_days: 1,
      total_attendance_days: 3,
      active_crew_count: 3,
      total_bonus: 3933,
    },
    {
      crew_id: 'crew-3',
      crew_name: 'Ricki Septisawanto',
      role: 'crew',
      sub_role: 'crew_backup',
      outlet_id: 'out-2',
      outlet_name: 'SUKA SHAWARMA MITRA CIBINONG',
      total_pcs_outlet: 118,
      bonus_rate: 100,
      attendance_days: 1,
      total_attendance_days: 3,
      active_crew_count: 3,
      total_bonus: 3933,
    },
  ]

  const dummyAM: AMBonusRow[] = [
    {
      staff_id: 'am-1',
      staff_name: 'Budi Santoso',
      role: 'area_manager',
      managed_outlet_count: 3,
      managed_outlet_names: ['MITRA CIBINONG', 'MITRA CIBUBUR', 'MITRA CICURUG'],
      total_pcs: 337,
      bonus_rate: 50,
      total_bonus: 16850,
    },
  ]

  const dummyRM: RMBonusRow[] = [
    {
      staff_id: 'rm-1',
      staff_name: 'Hendra Wijaya',
      role: 'regional_manager',
      scope_description: 'Seluruh Jaringan Outlet Suka Shawarma',
      total_pcs_global: 2149,
      bonus_rate: 50,
      total_bonus: 107450,
    },
  ]

  it('cleanOutletName strips prefixes correctly', () => {
    expect(cleanOutletName('SUKA SHAWARMA MITRA CIBINONG')).toBe('MITRA CIBINONG')
    expect(cleanOutletName('MITRA SUKA BOJONGSOANG')).toBe('MITRA BOJONGSOANG')
  })

  it('generates proper filename based on mode', () => {
    expect(
      getExportBonusFilename({
        mode: 'all',
        month: 11,
        year: 2026,
        monthLabel: 'November',
      })
    ).toBe('Laporan_Bonus_Insentif_SukaHR_November_2026.xlsx')

    expect(
      getExportBonusFilename({
        mode: 'crew',
        month: 11,
        year: 2026,
        monthLabel: 'November',
      })
    ).toBe('Laporan_Bonus_Crew_Leader_November_2026.xlsx')
  })

  it('builds full multi-sheet workbook for mode "all"', async () => {
    const wb = await buildBonusWorkbook({
      mode: 'all',
      month: 11,
      year: 2026,
      monthLabel: 'November',
      summary: dummySummary,
      crewData: dummyCrew,
      amData: dummyAM,
      rmData: dummyRM,
      filters: {
        outletLabel: 'Semua Outlet',
        roleLabel: 'Semua Posisi',
        attendanceLabel: 'Semua Kehadiran',
      },
    })

    expect(wb.worksheets.length).toBe(4)
    const sheetNames = wb.worksheets.map((ws) => ws.name)
    expect(sheetNames).toEqual([
      'Ringkasan Eksekutif',
      'Crew & Leader',
      'Area Manager',
      'Regional Manager',
    ])

    // Verify Crew sheet content
    const crewSheet = wb.getWorksheet('Crew & Leader')
    expect(crewSheet).toBeDefined()
    // Row 1: Banner
    expect(crewSheet?.getCell('A1').value).toContain('REKAP BONUS INSENTIF CREW & LEADER')
    // Row 4: Header
    expect(crewSheet?.getRow(4).getCell(2).value).toBe('Nama Staf')
    // Row 5: Glang
    expect(crewSheet?.getRow(5).getCell(2).value).toBe('Glang Gumala Putra')
    // Row 6: Yunus
    expect(crewSheet?.getRow(6).getCell(2).value).toBe('Yunus')
    expect(crewSheet?.getRow(6).getCell(3).value).toBe('Leader')
    // Row 7: Ricki
    expect(crewSheet?.getRow(7).getCell(4).value).toBe('Mobile Backup')

    // Verify buffer generation
    const buffer = await wb.xlsx.writeBuffer()
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it('builds single sheet workbook for mode "crew"', async () => {
    const wb = await buildBonusWorkbook({
      mode: 'crew',
      month: 11,
      year: 2026,
      monthLabel: 'November',
      crewData: dummyCrew,
    })

    expect(wb.worksheets.length).toBe(1)
    expect(wb.worksheets[0].name).toBe('Crew & Leader')
  })

  it('builds single sheet workbook for mode "am"', async () => {
    const wb = await buildBonusWorkbook({
      mode: 'am',
      month: 11,
      year: 2026,
      monthLabel: 'November',
      amData: dummyAM,
    })

    expect(wb.worksheets.length).toBe(1)
    expect(wb.worksheets[0].name).toBe('Area Manager')
  })

  it('builds single sheet workbook for mode "rm"', async () => {
    const wb = await buildBonusWorkbook({
      mode: 'rm',
      month: 11,
      year: 2026,
      monthLabel: 'November',
      rmData: dummyRM,
    })

    expect(wb.worksheets.length).toBe(1)
    expect(wb.worksheets[0].name).toBe('Regional Manager')
  })
})
