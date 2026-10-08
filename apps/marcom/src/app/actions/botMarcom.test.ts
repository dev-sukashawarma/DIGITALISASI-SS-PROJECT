import { describe, it, expect, vi, beforeEach } from 'vitest'
import { kirimPesanBotMarcom } from './botMarcom'
import * as auth from '@/lib/auth'
import * as klien from '@/lib/hermes/klien'

describe('botMarcom server action', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('menolak pengiriman pesan jika user belum login', async () => {
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(null)

    const res = await kirimPesanBotMarcom('Halo bot')
    expect(res.success).toBe(false)
    expect(res.error).toContain('Sesi login telah berakhir')
  })

  it('menolak pesan kosong', async () => {
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'marcom@ss.id',
      name: 'Tim Marcom',
      role: 'MARCOM',
    })

    const res = await kirimPesanBotMarcom('   ')
    expect(res.success).toBe(false)
    expect(res.error).toContain('Pesan tidak boleh kosong')
  })

  it('berhasil memanggil tanyaHermesMarcom saat user terotentikasi', async () => {
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'marcom@ss.id',
      name: 'Tim Marcom',
      role: 'MARCOM',
    })
    const spyKlien = vi
      .spyOn(klien, 'tanyaHermesMarcom')
      .mockResolvedValue('Jadwal konten hari ini ada 2 video')

    const res = await kirimPesanBotMarcom('jadwal hari ini?')
    expect(res.success).toBe(true)
    expect(res.balasan).toBe('Jadwal konten hari ini ada 2 video')
    expect(spyKlien).toHaveBeenCalledWith('jadwal hari ini?', [], 'sesi-user-1')
  })
})
