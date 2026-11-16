export type TipeOutletSuka = 'internal' | 'mitra'
export type StatusOutletSuka = 'active' | 'pending' | 'inactive'

export interface PayloadNotifikasiKredensial {
  aksi: 'outlet_baru' | 'perubahan_kredensial'
  namaOutlet: string
  slugOutlet: string
  tipeBaru: TipeOutletSuka
  tipeLama?: TipeOutletSuka | null
  statusOutlet: StatusOutletSuka
  email: string
  password: string
  urlLogin?: string
}

export interface HasilKirimTelegram {
  terkirim: boolean
  galat?: string
}

const URL_LOGIN_BAWAAN = 'https://order.sukashawarma.com/admin/login.html'

function escHtml(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function labelTipe(tipe: TipeOutletSuka): string {
  return tipe === 'mitra' ? 'MITRA' : 'INTERNAL'
}

function labelStatusOutlet(status: StatusOutletSuka): string {
  if (status === 'active') return 'Aktif (Operasional - Tampil di Form Order)'
  if (status === 'pending') return 'Pending (Persiapan - Belum Tampil ke Pelanggan)'
  return 'Nonaktif (Arsip)'
}

export function susunPesanKredensialTelegram(p: PayloadNotifikasiKredensial): string {
  const judul =
    p.aksi === 'outlet_baru'
      ? '[SISTEM FORM ORDER] AKUN OUTLET BARU'
      : '[SISTEM FORM ORDER] PEMBARUAN KREDENSIAL OUTLET'

  const barisTipe =
    p.tipeLama && p.tipeLama !== p.tipeBaru
      ? `${labelTipe(p.tipeLama)} -&gt; ${labelTipe(p.tipeBaru)}`
      : labelTipe(p.tipeBaru)

  const statusAkun = p.statusOutlet === 'inactive' ? 'Nonaktif' : 'Aktif (Siap Login)'
  const urlLogin = p.urlLogin || URL_LOGIN_BAWAAN

  return [
    `<b>${judul}</b>`,
    '',
    '<b>Informasi Outlet</b>',
    `• Nama Outlet: <b>${escHtml(p.namaOutlet)}</b>`,
    `• Slug URL: <code>${escHtml(p.slugOutlet)}</code>`,
    `• Tipe Outlet: <b>${barisTipe}</b>`,
    `• Status Outlet: <b>${labelStatusOutlet(p.statusOutlet)}</b>`,
    '',
    '<b>Kredensial Kelola Form Order</b>',
    `• Login Admin: ${escHtml(urlLogin)}`,
    `• Email: <code>${escHtml(p.email)}</code>`,
    `• Password: <code>${escHtml(p.password)}</code>`,
    `• Status Akun: <b>${statusAkun}</b>`,
  ].join('\n')
}

async function postPesanTelegram(token: string, chatId: string, html: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  let galatTerakhir = 'Gagal menghubungi Telegram API'

  for (let percobaan = 0; percobaan < 2; percobaan++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) return

      const detail = await res.text().catch(() => '')
      galatTerakhir = `Telegram HTTP ${res.status}: ${detail.slice(0, 200)}`
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(galatTerakhir)
      }
    } catch (err: unknown) {
      galatTerakhir = err instanceof Error ? err.message : String(err)
      if (percobaan === 0) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      throw new Error(galatTerakhir)
    }
  }

  throw new Error(galatTerakhir)
}

export async function kirimKredensialOrderOnlineTelegram(
  payload: PayloadNotifikasiKredensial,
): Promise<HasilKirimTelegram> {
  const token = process.env.TELEGRAM_HERMES_BOT_TOKEN?.trim().replace(/^['"]+|['"]+$/g, '')
  const rawChatIds = process.env.TELEGRAM_HERMES_CHAT_ID?.trim().replace(/^['"]+|['"]+$/g, '')

  if (!token || !rawChatIds) {
    const pesan = 'TELEGRAM_HERMES_BOT_TOKEN atau TELEGRAM_HERMES_CHAT_ID belum dikonfigurasi'
    console.warn(`[OrderOnlineTelegram] ${pesan}`)
    return { terkirim: false, galat: pesan }
  }

  const chatIds = rawChatIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (chatIds.length === 0) {
    return { terkirim: false, galat: 'Daftar TELEGRAM_HERMES_CHAT_ID kosong' }
  }

  const html = susunPesanKredensialTelegram(payload)
  const kegagalan: string[] = []

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        await postPesanTelegram(token, chatId, html)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[OrderOnlineTelegram] Gagal kirim ke chat ${chatId}:`, msg)
        kegagalan.push(`${chatId}: ${msg}`)
      }
    }),
  )

  if (kegagalan.length === chatIds.length) {
    return { terkirim: false, galat: kegagalan.join('; ') }
  }

  return {
    terkirim: true,
    ...(kegagalan.length > 0 ? { galat: `Sebagian gagal: ${kegagalan.join('; ')}` } : {}),
  }
}
