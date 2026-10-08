'use server'

import { getCurrentUser } from '@/lib/auth'
import { tanyaHermesMarcom, type PesanObrolan } from '@/lib/hermes/klien'

export interface ResponBotMarcom {
  success: boolean
  balasan?: string
  error?: string
}

export async function kirimPesanBotMarcom(
  pesan: string,
  riwayat: PesanObrolan[] = [],
  sesiId?: string
): Promise<ResponBotMarcom> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'Sesi login telah berakhir. Silakan login kembali.',
    }
  }

  const pesanBersih = pesan.trim()
  if (!pesanBersih) {
    return {
      success: false,
      error: 'Pesan tidak boleh kosong.',
    }
  }

  if (pesanBersih.length > 1000) {
    return {
      success: false,
      error: 'Pesan terlalu panjang (maksimal 1000 karakter).',
    }
  }

  const idSesiFinal = sesiId || `sesi-${user.id}`
  const balasan = await tanyaHermesMarcom(pesanBersih, riwayat, idSesiFinal)

  return {
    success: true,
    balasan,
  }
}
