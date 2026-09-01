export type Tagihan = {
  ref: string
  url: string
  status: 'menunggu' | 'lunas' | 'gagal'
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
      payment_methods: ['QRIS', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'BCA', 'BNI', 'BRI', 'MANDIRI'],
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
