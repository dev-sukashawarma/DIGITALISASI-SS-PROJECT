import { timingSafeEqual } from 'node:crypto'

export type Tagihan = {
  ref: string
  /** Halaman tagihan Xendit. Null untuk QR yang digambar aplikasi sendiri. */
  url: string | null
  /** Teks mentah kode QRIS. Null untuk jalur Invoice. */
  qrString: string | null
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

/**
 * Nominal terkecil untuk jalur **Invoice** (halaman pembayaran Xendit).
 *
 * Bukan angka teoretis: tagihan Rp3 dibuat pada 2026-09-07 dan halaman
 * pembayarannya TIDAK PERNAH selesai memuat -- tanpa pesan galat, hanya
 * kerangka kosong selamanya. Tagihan Rp8.000 pada menit yang sama tampil
 * normal.
 *
 * ⚠️ Batas ini milik HALAMAN-nya, bukan QRIS-nya. Yang gagal adalah render
 * halaman Xendit, bukan pembuatan tagihannya. Karena itu batas ini TIDAK
 * berlaku di `buatQris`: di sana aplikasi menggambar kodenya sendiri, tidak
 * ada halaman yang bisa gagal, dan Xendit-lah yang berhak menentukan batas
 * nominalnya sendiri.
 */
export const NOMINAL_MIN_INVOICE = 1_000

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
  //
  // Batas Rp1.000 berlaku KHUSUS di jalur ini: halaman tagihan Xendit terbukti
  // tak pernah selesai memuat untuk nominal sangat kecil (lihat
  // NOMINAL_MIN_INVOICE). Melempar di sini membuat pemanggil menandai draft
  // gagal dengan alasan yang jelas, alih-alih mengirim pelanggan ke halaman
  // kosong yang tak pernah hidup.
  if (!Number.isInteger(input.amount) || input.amount < NOMINAL_MIN_INVOICE) {
    throw new Error(
      `Nominal minimum halaman tagihan adalah Rp${NOMINAL_MIN_INVOICE}; diminta Rp${input.amount}`
    )
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

  return { ref: data.id, url: data.invoice_url, qrString: null, status: 'menunggu' }
}

/**
 * Membuat kode QRIS dinamis lewat **QR Code API**, bukan Invoice API.
 *
 * Bedanya menentukan: Invoice hanya mengembalikan URL halaman Xendit, jadi
 * pelanggan harus dilempar ke peramban. QR Code API mengembalikan
 * `qr_string` -- teks mentahnya -- sehingga aplikasi bisa MENGGAMBAR SENDIRI
 * kodenya. Tidak ada peramban, tidak ada bilah alamat, tidak ada logo pihak
 * ketiga di tengah alur pembayaran.
 *
 * **Bentuk webhook-nya BERBEDA** dari Invoice: peristiwanya `qr.payment`
 * dengan `data.reference_id`, bukan `external_id` di akar payload. Lihat
 * `bacaStatusWebhook`, yang kini menerima kedua bentuk.
 *
 * ⚠️ Callback QR harus didaftarkan TERPISAH di dashboard Xendit, di bagian
 * **QR Codes** -- bukan bagian Invoices. Dua bagian berbeda, dua pendaftaran
 * berbeda. Kalau hanya Invoices yang terdaftar, pembayaran QR masuk tapi
 * gateway tidak pernah diberi tahu, dan pesanan tidak sampai ke dapur.
 */
export async function buatQris(input: {
  externalId: string
  amount: number
}): Promise<Tagihan> {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) throw new Error('XENDIT_SECRET_KEY belum di-set')

  // TIDAK ADA batas minimum di sini, dan itu disengaja.
  //
  // Versi pertama memasang batas Rp1.000, dipinjam dari kegagalan jalur
  // Invoice. Itu keliru: yang gagal pada Rp3 adalah HALAMAN Xendit yang tak
  // pernah selesai memuat -- sedangkan di jalur ini aplikasi menggambar
  // kodenya sendiri dari `qr_string`, jadi tidak ada halaman yang bisa gagal.
  //
  // Kalau Xendit memang punya batas, Xendit yang menolak, dengan pesannya
  // sendiri -- dan pemanggil jatuh ke Invoice. Menebak batas milik pihak lain
  // berarti menolak pembayaran yang sebenarnya bisa jalan.
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error(`Nominal tagihan tidak sah: ${input.amount}`)
  }

  const res = await fetch('https://api.xendit.co/qr_codes', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'content-type': 'application/json',
      // Wajib. Tanpa header ini Xendit memakai versi API lama yang bentuk
      // balasannya berbeda dan tidak memuat `qr_string`.
      'api-version': '2022-07-31',
    },
    body: JSON.stringify({
      reference_id: input.externalId,
      type: 'DYNAMIC',
      currency: 'IDR',
      amount: input.amount,
      expires_at: new Date(Date.now() + BATAS_BAYAR_DETIK * 1000).toISOString(),
    }),
  })

  if (!res.ok) {
    const teks = await res.text()
    throw new Error(`Xendit menolak pembuatan QRIS (${res.status}): ${teks}`)
  }

  const data = (await res.json()) as { id?: string; qr_string?: string }
  if (!data.id || !data.qr_string) {
    throw new Error('Balasan Xendit tidak memuat id atau qr_string')
  }

  return { ref: data.id, url: null, qrString: data.qr_string, status: 'menunggu' }
}

/**
 * Menurunkan payload webhook menjadi keputusan yang bisa ditindak.
 *
 * Menerima DUA bentuk, karena gateway ini memakai dua jalur pembayaran:
 *
 * 1. **Invoice** -- `external_id` dan `status` di AKAR payload:
 *    `{ "external_id": "...", "status": "PAID" }`
 *
 * 2. **QR Code** -- `reference_id` dan `status` di dalam `data`:
 *    `{ "event": "qr.payment", "data": { "reference_id": "...",
 *       "status": "SUCCEEDED" } }`
 *
 * Keduanya dipertahankan dengan sengaja: jalur Invoice tetap jadi cadangan
 * kalau QR bermasalah, dan pesanan lama yang tagihannya masih hidup harus
 * tetap bisa diselesaikan setelah gateway di-redeploy. Menghapus salah satu
 * berarti pembayaran yang sedang berjalan hilang di tengah jalan.
 *
 * Status di luar daftar dikembalikan null: kita hanya bertindak pada
 * peristiwa yang benar-benar final.
 */
export function bacaStatusWebhook(
  payload: unknown
): { externalId: string; status: 'lunas' | 'gagal' } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>

  // Bentuk QR Code lebih spesifik, jadi diperiksa lebih dulu.
  const data = p.data
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    const ref = d.reference_id
    const st = d.status
    if (typeof ref === 'string' && typeof st === 'string') {
      return petakanStatus(ref, st)
    }
  }

  const externalId = p.external_id
  const status = p.status
  if (typeof externalId !== 'string' || typeof status !== 'string') return null
  return petakanStatus(externalId, status)
}

function petakanStatus(
  externalId: string,
  status: string
): { externalId: string; status: 'lunas' | 'gagal' } | null {
  // PAID/SETTLED dari Invoice; SUCCEEDED/COMPLETED dari QR Code.
  if (status === 'PAID' || status === 'SETTLED' || status === 'SUCCEEDED' || status === 'COMPLETED') {
    return { externalId, status: 'lunas' }
  }
  if (status === 'EXPIRED' || status === 'FAILED' || status === 'INACTIVE') {
    return { externalId, status: 'gagal' }
  }
  return null
}
