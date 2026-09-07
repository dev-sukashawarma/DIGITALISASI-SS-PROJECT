import { timingSafeEqual } from 'node:crypto'

export type Tagihan = {
  ref: string
  url: string
  status: 'menunggu' | 'lunas' | 'gagal'
}

/**
 * Perbandingan rahasia tahan-waktu.
 * Preseden proyek: P8 di pos-kasir (2026-07-21) — perbandingan string biasa
 * membocorkan rahasia sedikit demi sedikit lewat selisih waktu balasan.
 * Dipakai oleh webhook Xendit dan cron.
 */
export function rahasiaCocok(diberikan: string | null, diharapkan: string): boolean {
  if (!diberikan) return false
  const a = Buffer.from(diberikan)
  const b = Buffer.from(diharapkan)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const BATAS_BAYAR_DETIK = 15 * 60

export async function buatTagihan(input: {
  externalId: string
  amount: number
  description: string
  customerName: string
}): Promise<Tagihan> {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) throw new Error('XENDIT_SECRET_KEY belum di-set')

  // Penjagaan di batas pembayaran. Tagihan nol atau negatif adalah tanda ada
  // yang salah di hulu; tolak di sini daripada menunggu Xendit menolaknya
  // setelah satu perjalanan jaringan.
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error('Nilai tagihan tidak sah')
  }

  const res = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      description: input.description,
      customer: { given_names: input.customerName },
      invoice_duration: BATAS_BAYAR_DETIK,
      currency: 'IDR',
      // QRIS SAJA. Keputusan owner 2026-09-07.
      //
      // Alasannya bukan sekadar penyederhanaan: satu kode QRIS bisa dipindai
      // oleh SEMUA aplikasi bank dan e-wallet di Indonesia, jadi membatasi ke
      // QRIS tidak mengurangi siapa pun yang bisa membayar -- ia hanya
      // menghapus langkah memilih. Transfer VA justru menyulitkan untuk
      // pesanan ambil-sendiri: pelanggan harus membuka mobile banking dan
      // menunggu, sementara makanannya sudah dibuat.
      //
      // Efek samping yang membereskan utang lama: `orders.payment_method`
      // dipatok `'qris'` di `orderPayload.ts` karena constraint produksi hanya
      // mengizinkan cash|qris|card. Dulu itu label yang bisa keliru (pelanggan
      // bayar OVO, tercatat QRIS). Dengan kanal dibatasi QRIS, label itu kini
      // SELALU BENAR -- bukan lagi kompromi.
      //
      // Kalau kelak kanal lain dibuka kembali, catatan Pasca-Pilot di
      // docs/2026-09-01-tahap1-gateway-plan.md berlaku lagi dan harus dibaca
      // sebelum menambah nilai ke daftar ini.
      payment_methods: ['QRIS'],
    }),
  })

  if (!res.ok) {
    const teks = await res.text()
    throw new Error(`Xendit menolak pembuatan tagihan (${res.status}): ${teks}`)
  }

  const data = (await res.json()) as { id?: string; invoice_url?: string }
  if (!data.id || !data.invoice_url) {
    throw new Error('Balasan Xendit tidak memuat id atau invoice_url')
  }

  return { ref: data.id, url: data.invoice_url, status: 'menunggu' }
}

/**
 * Menurunkan payload webhook menjadi keputusan yang bisa ditindak.
 * Status di luar daftar dikembalikan null: kita hanya bertindak pada
 * peristiwa yang benar-benar final.
 */
export function bacaStatusWebhook(
  payload: unknown
): { externalId: string; status: 'lunas' | 'gagal' } | null {
  if (typeof payload !== 'object' || payload === null) return null

  const p = payload as Record<string, unknown>
  const externalId = p.external_id
  const status = p.status

  if (typeof externalId !== 'string' || typeof status !== 'string') return null

  if (status === 'PAID' || status === 'SETTLED') {
    return { externalId, status: 'lunas' }
  }
  if (status === 'EXPIRED' || status === 'FAILED') {
    return { externalId, status: 'gagal' }
  }
  return null
}
