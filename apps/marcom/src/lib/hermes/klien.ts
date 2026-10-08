export interface PesanObrolan {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function tanyaHermesMarcom(
  pesan: string,
  riwayat: PesanObrolan[] = [],
  sesiId: string = 'sesi-marcom-default'
): Promise<string> {
  const baseUrl = process.env.HERMES_API_URL || 'http://127.0.0.1:8000'
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/p/marcom/v1/chat/completions`
  const apiKey = process.env.HERMES_API_KEY || 'hermes_marcom_secret'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Hermes-Session-Id': sesiId,
      },
      body: JSON.stringify({
        model: 'marcom',
        messages: [
          ...riwayat.map((r) => ({ role: r.role, content: r.content })),
          { role: 'user', content: pesan },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(
        `[hermes-marcom] HTTP error ${res.status} dari Hermes:`,
        errText
      )
      return (
        'Maaf, Bot Marcom mengalami kendala saat memproses permintaan Anda (' +
        `status ${res.status}). Silakan coba beberapa saat lagi.`
      )
    }

    const data = await res.json()
    const balasan = data?.choices?.[0]?.message?.content
    if (!balasan) {
      return 'Maaf, tidak ada tanggapan yang diterima dari Bot Marcom.'
    }

    return balasan
  } catch (err: any) {
    clearTimeout(timeoutId)
    console.error('[hermes-marcom] Gagal menghubungi endpoint Hermes:', err)
    return (
      'Maaf, saat ini Bot Marcom sedang tidak dapat terhubung ke server Hermes AI. ' +
      'Pastikan server Hermes VPS aktif dan berjalan.'
    )
  }
}
