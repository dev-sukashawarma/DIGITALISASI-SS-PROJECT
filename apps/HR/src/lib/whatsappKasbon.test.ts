import { describe, expect, it } from 'vitest'
import {
  isPdfProof,
  mimeTypeFromProofPath,
  pesanBuktiTransferKasbon,
  tautanWaKasbon,
} from './whatsappKasbon'

describe('whatsappKasbon', () => {
  it('mendeteksi ekstensi PDF termasuk pada signed URL dengan query token', () => {
    expect(isPdfProof('kasbon/123-bukti.pdf')).toBe(true)
    expect(isPdfProof('https://x.supabase.co/storage/v1/object/sign/finance-proofs/kasbon/123.PDF?token=abc')).toBe(true)
    expect(isPdfProof('kasbon/123-bukti.jpg')).toBe(false)
    expect(isPdfProof(null)).toBe(false)
  })

  it('menentukan mimetype dari path bukti', () => {
    expect(mimeTypeFromProofPath('kasbon/a.pdf')).toBe('application/pdf')
    expect(mimeTypeFromProofPath('kasbon/a.png')).toBe('image/png')
    expect(mimeTypeFromProofPath('kasbon/a.webp')).toBe('image/webp')
    expect(mimeTypeFromProofPath('kasbon/a.jpg')).toBe('image/jpeg')
  })

  it('menyusun pesan bukti transfer beserta tautan bukti untuk wa.me', () => {
    const pesan = pesanBuktiTransferKasbon({
      staffName: 'Ismansyah',
      amount: 300000,
      metodeCair: 'transfer',
      dicairkanAt: '2026-11-20T05:00:00Z',
      proofUrl: 'https://example.com/signed-proof',
    })
    expect(pesan).toContain('Halo Ismansyah,')
    expect(pesan).toContain('*Rp 300.000*')
    expect(pesan).toContain('Transfer')
    expect(pesan).toContain('https://example.com/signed-proof')
  })

  it('menyusun pesan lampiran untuk WAHA tanpa URL mentah', () => {
    const pesan = pesanBuktiTransferKasbon({
      staffName: 'Budi',
      amount: 500000,
      metodeCair: 'tunai',
      proofUrl: 'https://example.com/ignored',
      includeProofLink: false,
    })
    expect(pesan).toContain('Tunai')
    expect(pesan).toContain('lampirkan bukti pencairan')
    expect(pesan).not.toContain('https://example.com/ignored')
  })

  it('mengembalikan tautan wa.me valid atau null bila nomor invalid', () => {
    const url = tautanWaKasbon({
      phone: '0812-3456-7890',
      staffName: 'Raka',
      amount: 200000,
      metodeCair: 'transfer',
      proofUrl: 'https://example.com/bukti.jpg',
    })
    expect(url).not.toBeNull()
    expect(url!.startsWith('https://wa.me/6281234567890?text=')).toBe(true)

    expect(
      tautanWaKasbon({
        phone: null,
        staffName: 'Raka',
        amount: 200000,
      }),
    ).toBeNull()
  })
})
