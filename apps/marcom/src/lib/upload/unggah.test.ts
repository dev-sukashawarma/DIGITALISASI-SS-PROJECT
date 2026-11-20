import { describe, expect, it, vi } from 'vitest'
import {
  buatLinkUnggah,
  buatPathUnggah,
  GalatUnggah,
  MB,
  unggahLangsung,
  validasiUnggahan,
} from './index'

describe('validasiUnggahan', () => {
  it('menerima foto dan PDF dalam batas ukuran', () => {
    expect(validasiUnggahan({ tipe: 'image/jpeg', ukuran: 200_000, nama: 'nota.jpg' })).toBeNull()
    expect(validasiUnggahan({ tipe: 'application/pdf', ukuran: 1_000_000, nama: 'nota.pdf' })).toBeNull()
  })

  it('menolak file kosong, tipe tidak didukung, PDF saat dilarang, dan file terlalu besar', () => {
    expect(validasiUnggahan({ tipe: 'image/jpeg', ukuran: 0, nama: 'kosong.jpg' })).toMatch(/kosong/i)
    expect(validasiUnggahan({ tipe: 'text/plain', ukuran: 100, nama: 'catatan.txt' })).toMatch(/tidak didukung/i)
    expect(
      validasiUnggahan(
        { tipe: 'application/pdf', ukuran: 100_000, nama: 'menu.pdf' },
        { ukuranMaks: 5 * MB, bolehPdf: false },
      ),
    ).toMatch(/PDF tidak diterima/i)
    expect(
      validasiUnggahan({ tipe: 'image/jpeg', ukuran: 11 * MB, nama: 'besar.jpg' }),
    ).toMatch(/melebihi batas/i)
  })
})

describe('buatPathUnggah', () => {
  it('membuat path aman per bulan dan membuang traversal', () => {
    const tgl = new Date(Date.UTC(2026, 10, 20, 6, 0, 0))
    const path = buatPathUnggah({
      folder: '../Invoices//Opex',
      ekstensi: 'jpg',
      sekarang: tgl,
      acak: 'abc12345',
    })
    expect(path).toBe(`invoices/opex/2026-11/${tgl.getTime()}_abc12345.jpg`)
  })

  it('membuat path datar di akar bucket saat tanpaSubfolder aktif (menu-images)', () => {
    const tgl = new Date(Date.UTC(2026, 10, 20, 6, 0, 0))
    const path = buatPathUnggah({
      folder: '',
      ekstensi: 'webp',
      sekarang: tgl,
      acak: 'xyz98765',
      tanpaSubfolder: true,
    })
    expect(path).toBe(`${tgl.getTime()}_xyz98765.webp`)
  })
})

describe('buatLinkUnggah', () => {
  it('mengembalikan signed upload link dengan publicUrl', async () => {
    const fromMock = vi.fn().mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: { path: 'invoices/2026-11/file.jpg', token: 'tok-123' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://supabase.test/storage/v1/object/public/opex-invoices/invoices/2026-11/file.jpg' },
      }),
    })

    const res = await buatLinkUnggah({
      supabase: { storage: { from: fromMock } } as any,
      bucket: 'opex-invoices',
      folder: 'invoices',
      permintaan: { namaFile: 'nota.jpg', tipe: 'image/jpeg', ukuran: 150_000 },
    })

    expect(res).toEqual({
      ok: true,
      bucket: 'opex-invoices',
      path: 'invoices/2026-11/file.jpg',
      token: 'tok-123',
      publicUrl: 'https://supabase.test/storage/v1/object/public/opex-invoices/invoices/2026-11/file.jpg',
    })
    expect(fromMock).toHaveBeenCalledWith('opex-invoices')
  })

  it('fallback ke bucket cadangan bila bucket utama gagal', async () => {
    const fromMock = vi.fn((bucket: string) => {
      if (bucket === 'payment_proofs') {
        return {
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Bucket not found' },
          }),
        }
      }
      return {
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { path: 'endorsement-proofs/2026-11/file.jpg', token: 'tok-fallback' },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://supabase.test/opex-invoices/endorsement-proofs/2026-11/file.jpg' },
        }),
      }
    })

    const res = await buatLinkUnggah({
      supabase: { storage: { from: fromMock } } as any,
      bucket: 'payment_proofs',
      fallbackBucket: 'opex-invoices',
      folder: 'endorsement-proofs',
      permintaan: { namaFile: 'bukti.jpg', tipe: 'image/jpeg', ukuran: 80_000 },
    })

    expect(res).toMatchObject({
      ok: true,
      bucket: 'opex-invoices',
      token: 'tok-fallback',
    })
  })
})

describe('unggahLangsung', () => {
  it('hanya mengirim metadata ke mintaLink, lalu mengunggah file langsung ke Storage', async () => {
    const file = new File([new Uint8Array(1024)], 'struk.jpg', { type: 'image/jpeg' })
    const mintaLink = vi.fn().mockResolvedValue({
      ok: true,
      bucket: 'opex-invoices',
      path: 'invoices/2026-11/struk.jpg',
      token: 'tok-xyz',
      publicUrl: 'https://supabase.test/opex-invoices/invoices/2026-11/struk.jpg',
    })
    const uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ uploadToSignedUrl })

    const hasil = await unggahLangsung({
      supabase: { storage: { from: fromMock } } as any,
      file,
      mintaLink,
      _normalisasi: async (f) => f,
    })

    expect(mintaLink).toHaveBeenCalledWith({
      namaFile: 'struk.jpg',
      tipe: 'image/jpeg',
      ukuran: 1024,
    })
    expect(fromMock).toHaveBeenCalledWith('opex-invoices')
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      'invoices/2026-11/struk.jpg',
      'tok-xyz',
      file,
      { contentType: 'image/jpeg', upsert: false },
    )
    expect(hasil.url).toBe('https://supabase.test/opex-invoices/invoices/2026-11/struk.jpg')
  })

  it('menganggap 409 sebagai sukses idempoten saat retry', async () => {
    const file = new File([new Uint8Array(512)], 'struk.pdf', { type: 'application/pdf' })
    const uploadToSignedUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({ error: { statusCode: '409', message: 'The resource already exists' } })

    const hasil = await unggahLangsung({
      supabase: { storage: { from: () => ({ uploadToSignedUrl }) } } as any,
      file,
      percobaan: 2,
      mintaLink: async () => ({
        ok: true,
        bucket: 'opex-invoices',
        path: 'invoices/2026-11/struk.pdf',
        token: 'tok-pdf',
        publicUrl: 'https://supabase.test/opex-invoices/invoices/2026-11/struk.pdf',
      }),
      _normalisasi: async (f) => f,
    })

    expect(uploadToSignedUrl).toHaveBeenCalledTimes(2)
    expect(hasil.url).toBe('https://supabase.test/opex-invoices/invoices/2026-11/struk.pdf')
  })

  it('melempar GalatUnggah dengan pesan jelas bila mintaLink gagal', async () => {
    const file = new File([new Uint8Array(512)], 'struk.jpg', { type: 'image/jpeg' })
    await expect(
      unggahLangsung({
        supabase: { storage: { from: vi.fn() } } as any,
        file,
        mintaLink: async () => ({ ok: false, pesan: 'Unauthorized: Harap login terlebih dahulu' }),
        _normalisasi: async (f) => f,
      }),
    ).rejects.toThrow(GalatUnggah)
  })
})
