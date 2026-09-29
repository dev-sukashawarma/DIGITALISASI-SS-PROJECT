import { describe, expect, it } from 'vitest'
import { parseHariLiburIcs } from './hariLibur'

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260817',
  'SUMMARY:Hari Proklamasi Kemerdekaan R.I.',
  'DESCRIPTION:Hari libur nasional',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261224',
  'SUMMARY:Cuti Bersama Natal (Malam Natal)',
  'DESCRIPTION:Hari libur nasional',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260219',
  'SUMMARY:1 Ramadan',
  'DESCRIPTION:Perayaan\\nUntuk menyembunyikan kalender perayaan\\, buka Setelan',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270310',
  'SUMMARY:Hari Idul Fitri (belum pasti)',
  'DESCRIPTION:Hari libur nasional\\nTanggal bersifat tentatif dan dapat beru',
  ' bah',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260817',
  'SUMMARY:Hari Kemerdekaan',
  'DESCRIPTION:Hari libur nasional',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseHariLiburIcs', () => {
  const hasil = parseHariLiburIcs(ics)

  it('membuang entri "Perayaan" (bukan tanggal merah)', () => {
    expect(hasil.find((h) => h.tanggal === '2026-02-19')).toBeUndefined()
  })

  it('mengenali cuti bersama', () => {
    expect(hasil.find((h) => h.tanggal === '2026-12-24')?.jenis).toBe('cuti_bersama')
  })

  it('menandai tanggal tentatif dan merapikan nama', () => {
    const idul = hasil.find((h) => h.tanggal === '2027-03-10')
    expect(idul?.tentatif).toBe(true)
    expect(idul?.nama).toBe('Hari Idul Fitri')
  })

  it('menggabungkan dua entri di tanggal yang sama', () => {
    const agustus = hasil.filter((h) => h.tanggal === '2026-08-17')
    expect(agustus).toHaveLength(1)
    expect(agustus[0].nama).toBe('Hari Proklamasi Kemerdekaan R.I. / Hari Kemerdekaan')
    expect(agustus[0].jenis).toBe('libur_nasional')
  })

  it('urut menurut tanggal', () => {
    expect(hasil.map((h) => h.tanggal)).toEqual(['2026-08-17', '2026-12-24', '2027-03-10'])
  })
})
