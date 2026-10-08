import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungKol } from './kol'
import { hitungPengeluaran } from './pengeluaran'
import { hitungIklan } from './iklan'
import { hitungAnalisisVideo } from './analisisVideo'
import { hitungTargetOutlet } from './targetOutlet'
import { hitungMenu } from './menu'
import { hitungJadwalKonten } from './konten'
import { DAFTAR_ALAT_MARCOM } from './registry'
import { batasi } from './bantu'

describe('marcom_kol', () => {
  it('mengurutkan KOL dari kerja sama terbanyak dan menjumlahkan ringkasan', async () => {
    const hasil = await hitungKol(buatKonteksMarcomPalsu())
    expect(hasil.daftar.map((k) => k.nama)).toEqual(['Rina Mukbang', 'Jessica Foodie', 'Budi Kuliner'])
    expect(hasil.ringkasan).toEqual({
      total_kol: 3,
      pernah_kerja_sama: 2,
      total_rate_card: 4500000,
      total_views: 130000,
    })
  })

  it('filter outlet hanya menyisakan KOL yang pernah ke outlet itu', async () => {
    const hasil = await hitungKol(buatKonteksMarcomPalsu(), { outlet: 'solo baru' })
    expect(hasil.daftar.map((k) => k.nama)).toEqual(['Rina Mukbang'])
  })

  it('tidak pernah membawa nomor HP atau rekening', async () => {
    const hasil = await hitungKol(buatKonteksMarcomPalsu())
    expect(JSON.stringify(hasil)).not.toMatch(/phone|bank_?account/i)
    expect(hasil.daftar[0]).toHaveProperty('punya_rekening')
  })
})

describe('marcom_pengeluaran', () => {
  it('default bulan ini: hanya Oktober, dirinci per kategori', async () => {
    const hasil = await hitungPengeluaran(buatKonteksMarcomPalsu())
    expect(hasil.meta.dari).toBe('2026-10-01')
    expect(hasil.meta.sampai).toBe('2026-10-31')
    expect(hasil.ringkasan.total).toBe(2000000)
    expect(hasil.ringkasan.jumlah_transaksi).toBe(3)
    expect(hasil.ringkasan.per_kategori[0]).toEqual({ nama: 'PRODUKSI_KONTEN', jumlah: 1, total: 1200000 })
    expect(hasil.ringkasan.per_kategori[1]).toEqual({ nama: 'CETAK_BRANDING', jumlah: 2, total: 800000 })
    expect(hasil.daftar[0].tanggal).toBe('2026-10-07')
  })

  it('filter kategori tidak peka huruf besar', async () => {
    const hasil = await hitungPengeluaran(buatKonteksMarcomPalsu(), { kategori: 'cetak_branding' })
    expect(hasil.ringkasan.total).toBe(800000)
  })
})

describe('marcom_iklan', () => {
  it('menghitung spent, views, dan biaya per 1.000 views bulan ini', async () => {
    const hasil = await hitungIklan(buatKonteksMarcomPalsu())
    expect(hasil.ringkasan.jumlah_iklan).toBe(2)
    expect(hasil.ringkasan.sedang_on).toBe(1)
    expect(hasil.ringkasan.total_spent).toBe(1000000)
    expect(hasil.ringkasan.total_views).toBe(40000)
    expect(hasil.ringkasan.biaya_per_1000_views).toBe(25000)
  })

  it('filter outlet juga mencocokkan nama akun', async () => {
    const hasil = await hitungIklan(buatKonteksMarcomPalsu(), {
      outlet: 'ofc tiktok',
      periode: 'custom',
      dari: '2026-09-01',
      sampai: '2026-10-31',
    })
    expect(hasil.daftar.map((a) => a.id)).toEqual(['ad-1', 'ad-3'])
  })

  it('biaya per 1.000 views null bila tak ada views', async () => {
    const hasil = await hitungIklan(buatKonteksMarcomPalsu(), { platform: 'instagram' })
    expect(hasil.ringkasan.biaya_per_1000_views).toBeNull()
  })
})

describe('marcom_analisis_video', () => {
  it('mengurutkan terbaru dulu dan merata-rata skor', async () => {
    const hasil = await hitungAnalisisVideo(buatKonteksMarcomPalsu())
    expect(hasil.daftar.map((v) => v.id)).toEqual(['va-3', 'va-1', 'va-2'])
    expect(hasil.ringkasan.rata_skor_total).toBe(69)
    expect(hasil.ringkasan.per_verdict).toEqual([
      { nama: 'READY', jumlah: 2 },
      { nama: 'REVISION', jumlah: 1 },
    ])
  })

  it('filter verdict', async () => {
    const hasil = await hitungAnalisisVideo(buatKonteksMarcomPalsu(), { verdict: 'revision' })
    expect(hasil.daftar).toHaveLength(1)
    expect(hasil.ringkasan.rata_skor.audio).toBe(5)
  })

  it('daftar kosong memberi rata-rata null, bukan NaN', async () => {
    const hasil = await hitungAnalisisVideo(buatKonteksMarcomPalsu(), { verdict: 'BOOSTER' })
    expect(hasil.ringkasan.rata_skor_total).toBeNull()
  })
})

describe('marcom_target_outlet', () => {
  it('default bulan & tahun berjalan', async () => {
    const hasil = await hitungTargetOutlet(buatKonteksMarcomPalsu())
    expect(hasil.meta.bulan).toBe(10)
    expect(hasil.ringkasan).toEqual({ jumlah_outlet: 2, total_target_budget: 5000000, total_target_kol: 6 })
  })

  it('bulan lain', async () => {
    const hasil = await hitungTargetOutlet(buatKonteksMarcomPalsu(), { bulan: 9 })
    expect(hasil.daftar).toHaveLength(1)
  })
})

describe('marcom_menu', () => {
  it('meringkas menu dan hanya promo yang berlaku hari ini', async () => {
    const hasil = await hitungMenu(buatKonteksMarcomPalsu())
    expect(hasil.ringkasan).toMatchObject({ total_menu: 3, tersedia: 2, tampil_di_app: 2, paket: 1, kampanye_aktif: 1 })
    // promo global SS Beji sudah selesai 5 Okt -> tidak ikut
    expect(hasil.promo_berlaku).toHaveLength(2)
  })

  it('hanya_tersedia & cari', async () => {
    const hasil = await hitungMenu(buatKonteksMarcomPalsu(), { cari: 'sapi', hanya_tersedia: true })
    expect(hasil.daftar).toHaveLength(0)
    const ayam = await hitungMenu(buatKonteksMarcomPalsu(), { cari: 'ayam' })
    expect(ayam.promo_berlaku.map((p) => p.menu_nama)).toEqual(['Original Ayam Jumbo'])
  })

  it('tidak membawa HPP', async () => {
    const hasil = await hitungMenu(buatKonteksMarcomPalsu())
    expect(JSON.stringify(hasil.daftar)).not.toMatch(/hpp/i)
  })
})

describe('marcom_konten_jadwal: tipe konten', () => {
  it('menyertakan daftar tipe konten dari Pengaturan', async () => {
    const hasil = await hitungJadwalKonten(buatKonteksMarcomPalsu())
    expect(hasil.tipe_konten).toEqual([
      { nama: 'Info promo', jumlah_konten: 3 },
      { nama: 'Sidak Outlet', jumlah_konten: 1 },
    ])
  })
})

describe('registry', () => {
  it('nama alat unik dan memuat 11 alat', () => {
    const nama = DAFTAR_ALAT_MARCOM.map((a) => a.name)
    expect(new Set(nama).size).toBe(nama.length)
    expect(nama).toHaveLength(11)
    expect(nama).toEqual(
      expect.arrayContaining([
        'marcom_kol',
        'marcom_pengeluaran',
        'marcom_iklan',
        'marcom_analisis_video',
        'marcom_target_outlet',
        'marcom_menu',
      ])
    )
  })

  it('setiap alat bisa dijalankan tanpa argumen', async () => {
    const k = buatKonteksMarcomPalsu()
    for (const alat of DAFTAR_ALAT_MARCOM) {
      await expect(alat.jalankan(k, {})).resolves.toBeTruthy()
    }
  })
})

describe('batasi', () => {
  it('memakai bawaan untuk nilai tak valid dan memotong di maksimum', () => {
    expect(batasi(undefined, 20)).toBe(20)
    expect(batasi('abc', 20)).toBe(20)
    expect(batasi(-3, 20)).toBe(20)
    expect(batasi(500, 20)).toBe(100)
    expect(batasi(7.9, 20)).toBe(7)
  })
})
