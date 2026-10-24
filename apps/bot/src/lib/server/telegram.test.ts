import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeHtml,
  formatPesanTelegramHtml,
  bersihkanMarkdown,
  kirimPesanTelegram,
} from './telegram'

describe('escapeHtml', () => {
  it('meng-escape karakter &, <, dan >', () => {
    expect(escapeHtml('A & B < C > D')).toBe('A &amp; B &lt; C &gt; D')
  })
})

describe('formatPesanTelegramHtml', () => {
  it('mengonversi bold, italic, code, blockquote, dan list ke HTML Telegram', () => {
    const raw = [
      'Halo Rekan Tim Finance. Berikut rincian (**2026-10-20**):',
      '',
      '> [!NOTE]',
      '> **OPEX TERBESAR HARI INI**: **Rp 1.129.425** di outlet **CIMANGGU**.',
      '',
      '### 💸 Daftar Pengeluaran Terbesar',
      '1. **Rp 1.129.425** — Wifi (*CIMANGGU* | `pengeluaran_outlet`)',
      '- **Total Pengeluaran**: **Rp 3.218.825**',
    ].join('\n')

    const formatted = formatPesanTelegramHtml(raw)

    // Alert [!NOTE] harus hilang
    expect(formatted).not.toContain('[!NOTE]')

    // Blockquote harus menggunakan <blockquote>
    expect(formatted).toContain('<blockquote>')
    expect(formatted).toContain('</blockquote>')
    expect(formatted).toContain('<b>OPEX TERBESAR HARI INI</b>: <b>Rp 1.129.425</b> di outlet <b>CIMANGGU</b>.')

    // Heading ### harus menjadi <b>
    expect(formatted).toContain('<b>💸 Daftar Pengeluaran Terbesar</b>')
    expect(formatted).not.toContain('###')

    // Bold dan italic
    expect(formatted).toContain('<b>2026-10-20</b>')
    expect(formatted).toContain('<i>CIMANGGU</i>')

    // Inline code dan snake_case terlindungi
    expect(formatted).toContain('<code>pengeluaran_outlet</code>')

    // List item dengan bullet
    expect(formatted).toContain('• <b>Total Pengeluaran</b>: <b>Rp 3.218.825</b>')
  })

  it('melindungi kode di dalam code blocks dari transformasi markdown', () => {
    const raw = [
      'Contoh script:',
      '```javascript',
      'const total = 5 * 10 < 100 && true;',
      '```',
    ].join('\n')

    const formatted = formatPesanTelegramHtml(raw)
    expect(formatted).toContain('<pre><code class="language-javascript">const total = 5 * 10 &lt; 100 &amp;&amp; true;</code></pre>')
    // Tidak ada <i> yang terpicu oleh * di dalam code block
    expect(formatted).not.toContain('<i>')
  })

  it('mengonversi link markdown menjadi tag <a>', () => {
    const raw = 'Silakan cek [Dashboard Finance](https://finance.sukashawarma.com).'
    const formatted = formatPesanTelegramHtml(raw)
    expect(formatted).toBe('Silakan cek <a href="https://finance.sukashawarma.com">Dashboard Finance</a>.')
  })

  it('mengonversi teks miring berturut-turut tanpa melompati kata (lookaround regex)', () => {
    const raw = '*satu* *dua* *tiga*'
    const formatted = formatPesanTelegramHtml(raw)
    expect(formatted).toBe('<i>satu</i> <i>dua</i> <i>tiga</i>')
  })

  it('mencegah tag ganda <b><b>...</b></b> pada header yang sudah dibold', () => {
    const raw = '### **Judul Penting**'
    const formatted = formatPesanTelegramHtml(raw)
    expect(formatted).toBe('<b>Judul Penting</b>')
    expect(formatted).not.toContain('<b><b>')
  })

  it('memotong pesan yang melebihi 3800 karakter secara aman', () => {
    const longText = 'a'.repeat(4500)
    const formatted = formatPesanTelegramHtml(longText)
    expect(formatted.length).toBeLessThan(4000)
    expect(formatted).toContain('...(pesan dipotong)')
  })

  it('mempertahankan tag HTML Telegram native tanpa escaping ganda', () => {
    const raw = '⚡ <b>J.A.R.V.I.S. ALERT</b>\n• Nominal: <code>Rp 1.500.000</code>\n<blockquote>Atensi Direksi & Manajemen</blockquote>'
    const formatted = formatPesanTelegramHtml(raw)
    expect(formatted).toContain('⚡ <b>J.A.R.V.I.S. ALERT</b>')
    expect(formatted).toContain('<code>Rp 1.500.000</code>')
    expect(formatted).toContain('<blockquote>Atensi Direksi &amp; Manajemen</blockquote>')
    expect(formatted).not.toContain('&lt;b&gt;')
    expect(formatted).not.toContain('&lt;code&gt;')
  })
})

describe('bersihkanMarkdown', () => {
  it('menghapus semua simbol formatting untuk fallback teks biasa', () => {
    const raw = [
      '> [!NOTE]',
      '> **OPEX**: **Rp 1.000.000**',
      '### Subtitle',
      '- Item `kode`',
      '[Link](https://sukashawarma.com)',
    ].join('\n')

    const plain = bersihkanMarkdown(raw)
    expect(plain).not.toContain('**')
    expect(plain).not.toContain('###')
    expect(plain).not.toContain('`')
    expect(plain).not.toContain('[!NOTE]')
    expect(plain).toContain('OPEX: Rp 1.000.000')
    expect(plain).toContain('Subtitle')
    expect(plain).toContain('• Item kode')
    expect(plain).toContain('Link (https://sukashawarma.com)')
  })
})

describe('kirimPesanTelegram', () => {
  const originalFetch = global.fetch
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.TELEGRAM_FINANCE_BOT_TOKEN = 'mock-finance-token'
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = { ...envBackup }
    vi.restoreAllMocks()
  })

  it('mengirim pesan dengan parse_mode HTML dan tanpa duplikasi URL jika ada inline button', async () => {
    let capturedBody: any = null
    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 123 } }),
      }
    })

    await kirimPesanTelegram(
      '123456',
      'Halo **Rekan Finance**',
      'https://finance.sukashawarma.com',
      'finance'
    )

    expect(capturedBody).toBeDefined()
    expect(capturedBody.chat_id).toBe('123456')
    expect(capturedBody.parse_mode).toBe('HTML')
    expect(capturedBody.text).toBe('Halo <b>Rekan Finance</b>')
    // URL tidak boleh ada di teks karena sudah ada tombol inline keyboard
    expect(capturedBody.text).not.toContain('https://finance.sukashawarma.com')
    expect(capturedBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: '🔗 Buka di Dashboard',
      url: 'https://finance.sukashawarma.com',
    })
  })

  it('melakukan fallback ke plain text bersih jika Telegram menolak entitas HTML (HTTP 400)', async () => {
    let callCount = 0
    let lastBody: any = null

    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      callCount++
      lastBody = JSON.parse(opts.body)
      if (callCount === 1) {
        // Percobaan pertama (HTML) ditolak oleh Telegram
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, description: "Bad Request: can't parse entities: Character '<' is reserved" }),
        }
      }
      // Percobaan kedua (fallback plain text) berhasil
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 124 } }),
      }
    })

    await kirimPesanTelegram(
      '123456',
      'Pesan **bold** bermasalah',
      undefined,
      'finance'
    )

    expect(callCount).toBe(2)
    expect(lastBody.parse_mode).toBeUndefined()
    expect(lastBody.text).toBe('Pesan bold bermasalah')
  })
})
