import { describe, expect, it, vi } from 'vitest'
import {
  adalahGambar,
  adalahHeic,
  buatPathUnggah,
  ekstensiDariTipe,
  hitungDimensi,
  layakDicobaUlang,
  MB,
  NORMALISASI_BAWAAN,
  rapikanFolder,
  rencanaKompres,
  validasiUnggahan,
} from './aturan'
import { buatLinkUnggah, GalatUnggah, unggahDenganSesi, unggahLangsung, type LinkUnggah } from './unggah'

describe('aturan unggah', () => {
  it('mengenali gambar dari tipe atau ekstensi (tipe kosong di sebagian HP)', () => {
    expect(adalahGambar('image/jpeg')).toBe(true)
    expect(adalahGambar('', 'WhatsApp Image 2026-11-12 at 14.30.00.jpeg')).toBe(true)
    expect(adalahGambar('', 'IMG_0001.HEIC')).toBe(true)
    expect(adalahGambar('application/zip', 'a.zip')).toBe(false)
    expect(adalahHeic('image/heif')).toBe(true)
    expect(adalahHeic('', 'IMG_1.heic')).toBe(true)
  })

  it('memperkecil proporsional, tidak pernah memperbesar', () => {
    expect(hitungDimensi(4000, 3000, 1600)).toEqual({ lebar: 1600, tinggi: 1200 })
    expect(hitungDimensi(3000, 4000, 1600)).toEqual({ lebar: 1200, tinggi: 1600 })
    expect(hitungDimensi(800, 600, 1600)).toEqual({ lebar: 800, tinggi: 600 })
    expect(hitungDimensi(0, 600, 1600)).toEqual({ lebar: 1, tinggi: 1 })
  })

  it('rencana kompres terbatas, kualitas menurun, ukuran tidak di bawah 320 px', () => {
    const r = rencanaKompres(NORMALISASI_BAWAAN)
    expect(r.length).toBeGreaterThan(4)
    expect(r.length).toBeLessThanOrEqual(16)
    expect(r[0]).toEqual({ sisiMaks: 1600, kualitas: 0.82 })
    expect(Math.min(...r.map((x) => x.sisiMaks))).toBeGreaterThanOrEqual(320)
  })

  it('ekstensi aman', () => {
    expect(ekstensiDariTipe('image/jpeg')).toBe('jpg')
    expect(ekstensiDariTipe('application/pdf')).toBe('pdf')
    expect(ekstensiDariTipe('', 'nota.PNG')).toBe('png')
    expect(ekstensiDariTipe('', 'tanpa-ekstensi')).toBe('bin')
    expect(ekstensiDariTipe('', 'a.<script>')).toBe('bin')
    expect(ekstensiDariTipe('', 'a.jfif')).toBe('jfif')
  })

  it('folder tidak bisa keluar jalur (../)', () => {
    expect(rapikanFolder('../../rahasia//Invoices ')).toBe('rahasia/invoices')
    expect(rapikanFolder('a/./b/../c d')).toBe('a/b/c-d')
    expect(rapikanFolder('invoices')).toBe('invoices')
  })

  it('path unik per bulan', () => {
    const p = buatPathUnggah({ folder: 'invoices', ekstensi: 'jpg', sekarang: new Date('2026-11-12T09:00:00Z'), acak: 'abc' })
    expect(p).toBe(`invoices/2026-11/${new Date('2026-11-12T09:00:00Z').getTime()}_abc.jpg`)
    expect(buatPathUnggah({ folder: 'x', ekstensi: 'jpg' })).not.toBe(buatPathUnggah({ folder: 'x', ekstensi: 'jpg' }))
  })

  it('validasi ukuran, tipe, PDF', () => {
    expect(validasiUnggahan({ tipe: 'image/jpeg', ukuran: 50_000 })).toBeNull()
    expect(validasiUnggahan({ tipe: 'application/pdf', ukuran: 50_000 })).toBeNull()
    expect(validasiUnggahan({ tipe: 'application/pdf', ukuran: 50_000 }, { ukuranMaks: MB, bolehPdf: false })).toMatch(/PDF/)
    expect(validasiUnggahan({ tipe: 'image/jpeg', ukuran: 11 * MB })).toMatch(/melebihi/)
    expect(validasiUnggahan({ tipe: 'image/jpeg', ukuran: 0 })).toMatch(/kosong/)
    expect(validasiUnggahan({ tipe: 'text/html', ukuran: 10 })).toMatch(/tidak didukung/)
  })

  it('hanya galat sementara yang dicoba ulang', () => {
    expect(layakDicobaUlang({ status: 503 })).toBe(true)
    expect(layakDicobaUlang({ statusCode: '429' })).toBe(true)
    expect(layakDicobaUlang(new TypeError('Failed to fetch'))).toBe(true)
    expect(layakDicobaUlang({ status: 400, message: 'mime type not supported' })).toBe(false)
    expect(layakDicobaUlang({ status: 403 })).toBe(false)
    expect(layakDicobaUlang(null)).toBe(false)
  })
})

function fakeSupabase(hasil: Array<{ error: unknown } | Error>) {
  const uploadToSignedUrl = vi.fn(async () => {
    const h = hasil.shift() ?? { error: null }
    if (h instanceof Error) throw h
    return { data: null, ...h }
  })
  const createSignedUploadUrl = vi.fn(async (path: string) => ({ data: { path, token: 'tok' }, error: null }))
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn/x/${path}` } }))
  const supabase = { storage: { from: vi.fn(() => ({ uploadToSignedUrl, createSignedUploadUrl, getPublicUrl })) } }
  return { supabase: supabase as never, uploadToSignedUrl, createSignedUploadUrl }
}

const linkOk: LinkUnggah = { ok: true, path: 'invoices/2026-11/1_a.jpg', token: 'tok', publicUrl: 'https://cdn/a.jpg' }
const lewat = async (f: File) => f

describe('unggahLangsung', () => {
  const foto = () => new File([new Uint8Array(2048)], 'nota.jpg', { type: 'image/jpeg' })

  it('sukses: minta link lalu unggah langsung ke storage, bukan lewat server aplikasi', async () => {
    const { supabase, uploadToSignedUrl } = fakeSupabase([{ error: null }])
    const mintaLink = vi.fn(async () => linkOk)
    const r = await unggahLangsung({ supabase, bucket: 'opex-invoices', file: foto(), mintaLink, _normalisasi: lewat })
    expect(r.url).toBe('https://cdn/a.jpg')
    expect(mintaLink).toHaveBeenCalledWith({ namaFile: 'nota.jpg', tipe: 'image/jpeg', ukuran: 2048 })
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('jaringan putus lalu pulih → dicoba ulang dan berhasil', async () => {
    vi.useFakeTimers()
    const { supabase, uploadToSignedUrl } = fakeSupabase([new TypeError('Failed to fetch'), { error: { status: 503, message: 'down' } }, { error: null }])
    const janji = unggahLangsung({ supabase, bucket: 'b', file: foto(), mintaLink: async () => linkOk, _normalisasi: lewat })
    await vi.runAllTimersAsync()
    await expect(janji).resolves.toMatchObject({ url: linkOk.ok ? linkOk.publicUrl : '' })
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('409 (sudah masuk, balasan hilang) dianggap sukses', async () => {
    const { supabase } = fakeSupabase([{ error: { statusCode: '409', message: 'The resource already exists' } }])
    await expect(unggahLangsung({ supabase, bucket: 'b', file: foto(), mintaLink: async () => linkOk, _normalisasi: lewat })).resolves.toBeTruthy()
  })

  it('galat permanen tidak dicoba ulang dan pesannya jelas', async () => {
    const { supabase, uploadToSignedUrl } = fakeSupabase([{ error: { status: 400, message: 'mime type not supported' } }])
    await expect(
      unggahLangsung({ supabase, bucket: 'b', file: foto(), mintaLink: async () => linkOk, _normalisasi: lewat }),
    ).rejects.toThrow(/mime type not supported/)
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('server menolak (peran/ukuran) → pesan server diteruskan, tidak mengunggah', async () => {
    const { supabase, uploadToSignedUrl } = fakeSupabase([])
    await expect(
      unggahLangsung({ supabase, bucket: 'b', file: foto(), mintaLink: async () => ({ ok: false, pesan: 'Tidak berhak' }), _normalisasi: lewat }),
    ).rejects.toThrow('Tidak berhak')
    expect(uploadToSignedUrl).not.toHaveBeenCalled()
  })

  it('Server Action gagal dipanggil (tab basi/jaringan) → pesan ramah, bukan "unexpected response"', async () => {
    const { supabase } = fakeSupabase([])
    const e = await unggahLangsung({
      supabase, bucket: 'b', file: foto(), _normalisasi: lewat,
      mintaLink: async () => { throw new Error('An unexpected response was received from the server.') },
    }).catch((x) => x)
    expect(e).toBeInstanceOf(GalatUnggah)
    expect(e.message).toMatch(/muat ulang halaman/)
  })

  it('file hasil normalisasi melebihi batas bucket → ditolak sebelum minta link', async () => {
    const { supabase } = fakeSupabase([])
    const mintaLink = vi.fn(async () => linkOk)
    const besar = async () => new File([new Uint8Array(300_000)], 'x.jpg', { type: 'image/jpeg' })
    await expect(
      unggahLangsung({ supabase, bucket: 'b', file: foto(), mintaLink, _normalisasi: besar, batas: { ukuranMaks: 200 * 1024, bolehPdf: false } }),
    ).rejects.toThrow(/melebihi/)
    expect(mintaLink).not.toHaveBeenCalled()
  })
})

describe('unggahDenganSesi', () => {
  it('unggah dengan sesi user ke folder rapi, retry saat jaringan putus, kembalikan path', async () => {
    vi.useFakeTimers()
    const upload = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ error: null })
    const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }))
    const supabase = { storage: { from: () => ({ upload, getPublicUrl }) } } as never
    const janji = unggahDenganSesi({
      supabase, bucket: 'finance-proofs', folder: 'deposit',
      file: new File([new Uint8Array(10)], 'bukti.png', { type: 'image/png' }),
      _normalisasi: async () => new File([new Uint8Array(10)], 'bukti.jpg', { type: 'image/jpeg' }),
    })
    await vi.runAllTimersAsync()
    const r = await janji
    expect(r.path).toMatch(/^deposit\/\d{4}-\d{2}\/\d+_[a-z0-9]{8}\.jpg$/)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls[0][0]).toBe(upload.mock.calls[1][0])
    vi.useRealTimers()
  })
})

describe('buatLinkUnggah (server)', () => {
  it('validasi dulu, lalu signed URL di folder yang diminta', async () => {
    const { supabase, createSignedUploadUrl } = fakeSupabase([])
    const r = await buatLinkUnggah({ supabase, bucket: 'opex-invoices', folder: 'invoices', permintaan: { namaFile: 'a.jpg', tipe: 'image/jpeg', ukuran: 1000 } })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.path).toMatch(/^invoices\/\d{4}-\d{2}\/\d+_[a-z0-9]{8}\.jpg$/)
      expect(r.publicUrl).toContain(r.path)
    }
    expect(createSignedUploadUrl).toHaveBeenCalledTimes(1)
  })

  it('permintaan tidak valid tidak pernah membuat link', async () => {
    const { supabase, createSignedUploadUrl } = fakeSupabase([])
    const r = await buatLinkUnggah({ supabase, bucket: 'b', folder: 'f', permintaan: { namaFile: 'a.exe', tipe: 'application/x-msdownload', ukuran: 10 } })
    expect(r.ok).toBe(false)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })
})
