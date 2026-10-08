export interface PesanObrolan {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function tanyaHermesMarcom(
  pesan: string,
  riwayat: PesanObrolan[] = [],
  sesiId: string = 'sesi-marcom-default'
): Promise<string> {
  // Tanpa nilai bawaan: alamat & kunci WAJIB dari env (Coolify + stage runner Dockerfile).
  const baseUrl = process.env.HERMES_API_URL?.trim()
  const apiKey = process.env.HERMES_API_KEY?.trim()
  if (!baseUrl || !apiKey) {
    console.error('[hermes-marcom] HERMES_API_URL/HERMES_API_KEY kosong: chat tidak dikirim')
    return 'Maaf, Bot Marcom belum dikonfigurasi di server. Hubungi tim IT.'
  }
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/p/marcom/v1/chat/completions`

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
          // Riwayat datang dari browser: hanya user/assistant yang diteruskan (role system = instruksi bot).
          ...riwayat
            .filter((r) => r.role === 'user' || r.role === 'assistant')
            .map((r) => ({ role: r.role, content: String(r.content ?? '') })),
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
