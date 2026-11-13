import { describe, expect, it } from 'vitest'
import { petakanStatusPenutupan, ringkasPenutupan } from './petakan'

const mentah = {
  outlet_id: 'o1',
  nama: 'SUKA SHAWARMA SAWANGAN (INTERNAL)',
  jenis: 'internal',
  status: 'inactive',
  nonaktif_at: '2026-09-25',
  alasan_tutup: 'Berganti jadi Mitra Sawangan DTC',
  penutupan_selesai_at: null,
  siap_selesai: false,
  langkah: [
    { kunci: 'crew', label: 'Crew dipindah', penanggung_jawab: 'HR', wajib: true, selesai: true, info: null, manual: false, dicentang_oleh: null, dicentang_at: null },
    { kunci: 'pesanan_nyasar', label: 'Pesanan sesudah tutup', penanggung_jawab: 'Admin', wajib: false, selesai: false, info: '3 pesanan: online (2026-11): 3', manual: false, dicentang_oleh: null, dicentang_at: null },
    { kunci: 'kanal_online', label: 'Aplikasi mati', penanggung_jawab: 'Admin', wajib: true, selesai: false, info: null, manual: true, dicentang_oleh: 'Admin Dev', dicentang_at: '13 Nov 2026 16:00' },
  ],
}

describe('petakanStatusPenutupan', () => {
  it('memetakan snake_case ke camelCase termasuk langkah manual', () => {
    const s = petakanStatusPenutupan(mentah)
    expect(s.outletId).toBe('o1')
    expect(s.nonaktifAt).toBe('2026-09-25')
    expect(s.alasanTutup).toBe('Berganti jadi Mitra Sawangan DTC')
    expect(s.penutupanSelesaiAt).toBeNull()
    expect(s.siapSelesai).toBe(false)
    expect(s.langkah[2]).toEqual({
      kunci: 'kanal_online', label: 'Aplikasi mati', penanggungJawab: 'Admin', wajib: true, selesai: false,
      info: null, manual: true, dicentangOleh: 'Admin Dev', dicentangAt: '13 Nov 2026 16:00',
    })
  })
})

describe('ringkasPenutupan', () => {
  it('hanya menghitung langkah wajib; peringatan yang belum selesai tidak menahan', () => {
    const s = petakanStatusPenutupan(mentah)
    expect(ringkasPenutupan(s.langkah)).toEqual({ selesai: 1, total: 2, tertahan: 'Aplikasi mati' })
  })

  it('tertahan null bila semua langkah wajib selesai walau peringatan belum', () => {
    const s = petakanStatusPenutupan(mentah)
    const langkah = s.langkah.map(l => (l.kunci === 'kanal_online' ? { ...l, selesai: true } : l))
    expect(ringkasPenutupan(langkah)).toEqual({ selesai: 2, total: 2, tertahan: null })
  })
})
