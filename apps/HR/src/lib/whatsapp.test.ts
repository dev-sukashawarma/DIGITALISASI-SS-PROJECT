import { describe, expect, it } from 'vitest'
import { nomorWa, pesanKonfirmasiAset, tautanWa } from './whatsapp'

describe('nomorWa', () => {
  it('menormalkan berbagai penulisan nomor Indonesia', () => {
    expect(nomorWa('089675750974')).toBe('6289675750974')
    expect(nomorWa('+62 812-8994-7304')).toBe('6281289947304')
    expect(nomorWa('6285778613520')).toBe('6285778613520')
    expect(nomorWa('85930307245')).toBe('6285930307245')
  })
  it('menolak nomor kosong / tidak masuk akal', () => {
    expect(nomorWa(null)).toBeNull()
    expect(nomorWa('')).toBeNull()
    expect(nomorWa('-')).toBeNull()
    expect(nomorWa('12345')).toBeNull()
    expect(nomorWa('+1 415 555 0100')).toBeNull()
  })
})

describe('pesan WhatsApp', () => {
  it('menyusun pesan konfirmasi & tautan wa.me ter-encode', () => {
    const pesan = pesanKonfirmasiAset({
      namaAm: 'Tri Rizky', namaHr: 'Indra', outlet: 'MITRA CIBUBUR',
      barang: 'EXHAUST FAN', merek: 'Maspion', kondisi: 'rusak', catatanAm: 'baling-baling patah',
    })
    expect(pesan).toContain('Halo Tri Rizky, saya Indra dari HR')
    expect(pesan).toContain('EXHAUST FAN (Maspion) dilaporkan *RUSAK*')
    expect(pesan).toContain('Catatan: baling-baling patah')
    const url = tautanWa('6285778613520', pesan)
    expect(url.startsWith('https://wa.me/6285778613520?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe(pesan)
  })

  it('menyusun pesan slip gaji WhatsApp (WAHA format)', async () => {
    const { buildSalarySlipWhatsAppMessage } = await import('./whatsappSalarySlip')
    const msg = buildSalarySlipWhatsAppMessage({
      id: 'e5a090-abcdef',
      staff_id: 'staff-1',
      period_month: 9,
      period_year: 2026,
      basic_salary: 1307692,
      allowance_position: 0,
      allowance_presence: 0,
      bonus: 0,
      bonus_note: null,
      deductions: 12000,
      deduction_note: 'Denda Telat: Rp 12.000',
      total_salary: 1295692,
      status: 'draft',
      outlet_staff: {
        name: 'Alfin Rifaldi',
        role: 'CREW',
        outlet_id: 'outlet-1',
        phone: '08123456789',
        outlets: { name: 'MITRA PAMULANG' },
        financials: {
          bank_name: 'BCA',
          bank_account_number: '6080837249',
          bank_account_name: 'Alfin Rifaldi',
        },
      },
    })

    expect(msg).toContain('SLIP GAJI RESMI — SUKA SHAWARMA')
    expect(msg).toContain('👤 Nama: *Alfin Rifaldi*')
    expect(msg).toContain('• Gaji Pokok: Rp 1.307.692')
    expect(msg).toContain('• Denda Keterlambatan: -Rp 12.000')
    expect(msg).toContain('💰 *TAKE HOME PAY: Rp 1.295.692*')
  })

  it('menghasilkan base64 PDF dan nama file slip gaji yang valid untuk WAHA', async () => {
    const { generateSalarySlipPdfBase64 } = await import('./pdfSalarySlip')
    const res = await generateSalarySlipPdfBase64({
      id: 'e5a090-test',
      staff_id: 'staff-1',
      period_month: 9,
      period_year: 2026,
      basic_salary: 1307692,
      allowance_position: 0,
      allowance_presence: 0,
      bonus: 0,
      bonus_note: null,
      deductions: 12000,
      deduction_note: 'Denda Telat: Rp 12.000',
      total_salary: 1295692,
      status: 'finalized',
      outlet_staff: {
        name: 'Alfin Rifaldi',
        role: 'CREW',
        outlet_id: 'outlet-1',
        phone: '08123456789',
        outlets: { name: 'MITRA PAMULANG' },
        financials: {
          bank_name: 'BCA',
          bank_account_number: '6080837249',
          bank_account_name: 'Alfin Rifaldi',
        },
      },
    })

    expect(res.filename).toBe('Slip_Gaji_Alfin_Rifaldi_September_2026.pdf')
    expect(typeof res.base64).toBe('string')
    expect(res.base64.length).toBeGreaterThan(1000)
  })

  it('menghasilkan cover note ringkas yang elegan saat lampiran PDF aktif', async () => {
    const { buildSalarySlipCoverNote } = await import('./whatsappSalarySlip')
    const note = buildSalarySlipCoverNote({
      id: 'e5a090-test',
      staff_id: 'staff-1',
      period_month: 9,
      period_year: 2026,
      basic_salary: 1307692,
      allowance_position: 0,
      allowance_presence: 0,
      bonus: 0,
      bonus_note: null,
      deductions: 12000,
      deduction_note: 'Denda Telat: Rp 12.000',
      total_salary: 1295692,
      status: 'finalized',
      outlet_staff: {
        name: 'Alfin Rifaldi',
        role: 'CREW',
        outlet_id: 'outlet-1',
        phone: '08123456789',
        outlets: { name: 'MITRA PAMULANG' },
        financials: {
          bank_name: 'BCA',
          bank_account_number: '6080837249',
          bank_account_name: 'Alfin Rifaldi',
        },
      },
    })

    expect(note).toContain('Halo *Alfin Rifaldi*,')
    expect(note).toContain('Slip Gaji resmi periode *September 2026* telah diterbitkan')
    expect(note).toContain('📍 Penempatan: *MITRA PAMULANG* (CREW)')
    expect(note).toContain('💰 *Take Home Pay (Gaji Bersih): Rp 1.295.692*')
    expect(note).toContain('🏦 Transfer ke: *BCA - 6080837249*')
    expect(note).toContain('📄 Rincian lengkap penerimaan, tunjangan, dan potongan tercantum pada dokumen PDF terlampir di bawah ini.')
  })
})
