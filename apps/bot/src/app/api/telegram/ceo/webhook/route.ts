import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { kirimAksiChatTelegram, kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'
import { tanyaHermes, kunciProfil } from '@/lib/hermes'
import { ambilTelemetriNyata, formatRupiah } from '@/lib/server/telemetriNyata'
import { tanyaAiRouter } from '@/lib/server/aiRouter'
import { buatJawabanDev } from '@/lib/server/devSimulasi'

export const dynamic = 'force-dynamic'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      is_bot?: boolean
      first_name?: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

// Map memori untuk mereset sesi percakapan Telegram pengguna saat /new atau /reset
const sesiEpochMap = new Map<string, number>()

export async function POST(req: NextRequest) {
  // Verifikasi opsional secret token jika dikonfigurasi di webhook
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_CEO_WEBHOOK_SECRET
  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized webhook secret' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const msg = update.message
  if (!msg || !msg.text || !msg.from) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const text = msg.text.trim()
  const fromId = String(msg.from.id)
  const chatId = String(msg.chat.id)
  const fromUsername = msg.from.username ?? ''
  const fromFirstName = msg.from.first_name ?? 'Sir'

  try {
    // ─────────────────────────────────────────────────────────── Command /start
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const tokenRaw = parts.length > 1 ? parts[1].trim() : ''

      // KASUS 1: Klik link dengan token rahasia (/start <token>) -> AUTO LINK INSTANT
      if (tokenRaw) {
        const admin = supabaseAdmin()

        // 1A. Jika diawali 'inv_', proses sebagai kode undangan mandiri
        if (tokenRaw.startsWith('inv_')) {
          const { data: inviteRes } = await admin.rpc('bot_telegram_redeem_invite_code', {
            p_code: tokenRaw,
            p_telegram_user_id: fromId,
            p_nama: fromFirstName,
            p_username: fromUsername,
          })

          const invObj = (inviteRes as { ok?: boolean; reason?: string; bot_nama?: string }) || {}
          if (invObj.ok === true) {
            await kirimPesanTelegram(
              chatId,
              `⚡ <b>J.A.R.V.I.S. // COMMAND CENTRE</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `🎉 <b>Aktivasi Eksekutif Berhasil!</b>\n\n` +
              `Salam hormat, <b>${fromFirstName}</b>!\n` +
              `Akun Telegram Anda telah resmi terdaftar untuk mengakses <b>${invObj.bot_nama || 'J.A.R.V.I.S. // Bot CEO'}</b> Suka Shawarma.\n\n` +
              `<blockquote>💡 <b>Pusat Komando Siaga:</b>\nAnda dapat langsung memberikan instruksi analitik atau ketik /help untuk ringkasan menu komando eksekutif.</blockquote>`,
              'https://agents.sukashawarma.com',
              'ceo'
            )
            return NextResponse.json({ ok: true, linked: true })
          }
        }

        // 1B. Fallback ke tautan token staf lama
        const tokenHash = createHash('sha256').update(tokenRaw).digest('hex')

        const { data: linkRes, error: rpcErr } = await admin.rpc('bot_telegram_tautkan', {
          p_token_hash: tokenHash,
          p_telegram_user_id: fromId,
          p_chat_id: chatId,
          p_username: fromUsername,
          p_first_name: fromFirstName,
        })

        if (rpcErr) {
          console.error('[telegram-ceo-webhook] RPC bot_telegram_tautkan error:', rpcErr)
          await kirimPesanTelegram(
            chatId,
            `⚠️ <b>Kendala Aktivasi Akun Eksekutif</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Terjadi gangguan saat memproses aktivasi akun eksekutif.\n\n` +
            `<blockquote>Silakan coba beberapa saat lagi atau hubungi Administrator jika kendala berlanjut.</blockquote>`,
            undefined,
            'ceo'
          )
          return NextResponse.json({ ok: true })
        }

        const resObj = (linkRes as { ok?: boolean; reason?: string }) || {}

        if (resObj.ok === true) {
          const { data: linkInfo } = await admin
            .from('bot_telegram_links')
            .select('staff_id, outlet_staff(name, role)')
            .eq('telegram_user_id', fromId)
            .maybeSingle()

          const staff = linkInfo?.outlet_staff as unknown as { name?: string; role?: string } | null
          const staffName = staff?.name || fromFirstName
          const roleLabel = staff?.role === 'developer'
            ? 'Developer'
            : staff?.role === 'admin'
            ? 'Administrator'
            : 'Owner / Executive'

          await kirimPesanTelegram(
            chatId,
            `⚡ <b>J.A.R.V.I.S. // COMMAND CENTRE</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎉 <b>Aktivasi Eksekutif Berhasil!</b>\n\n` +
            `Salam hormat, <b>${staffName}</b>!\n` +
            `Akun Telegram Anda telah resmi terhubung dengan <b>J.A.R.V.I.S. // Bot CEO</b> Suka Shawarma (<code>${roleLabel}</code>).\n\n` +
            `📡 <b>Satelit Telemetri & Intelijen Aktif:</b>\n` +
            `• 📊 <b>Real-Time Sales & Leaderboard</b> (Omzet, AOV, dan porsi menu)\n` +
            `• 🟢 <b>Monitoring Cabang Live</b> (Deteksi outlet nol transaksi & telat buka)\n` +
            `• ⏱️ <b>Presensi Kru & SDM</b> (Kedisiplinan, keterlambatan, dan cut-off)\n` +
            `• 🥩 <b>Gudang Pusat & Bahan Baku</b> (Katalog bahan dan buffer aman)\n` +
            `• 💰 <b>Finance & Rekonsiliasi Kas</b> (Gross sales, selisih kas & mutasi OPEX)\n` +
            `• ⚡ <b>Executive Daily Briefing</b> (Diagnostik menyeluruh 6 divisi)\n\n` +
            `<blockquote>💡 Ketik /help untuk daftar komando pintasan eksekutif atau berikan instruksi bisnis langsung, Sir.</blockquote>`,
            'https://agents.sukashawarma.com',
            'ceo'
          )
          return NextResponse.json({ ok: true, linked: true })
        }

        // Penanganan Gagal
        if (resObj.reason === 'expired') {
          await kirimPesanTelegram(
            chatId,
            `⚠️ <b>Tautan Aktivasi Kedaluwarsa</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Tautan undangan ini sudah pernah digunakan atau batas waktunya telah habis.\n\n` +
            `<blockquote>Silakan hubungi Administrator untuk menerbitkan tautan aktivasi baru di Admin Dashboard.</blockquote>`,
            undefined,
            'ceo'
          )
        } else if (resObj.reason === 'linked_elsewhere') {
          await kirimPesanTelegram(
            chatId,
            `⚠️ <b>Akun Telegram Sudah Terdaftar</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Akun Telegram ini sudah terhubung ke akun staf lain di sistem Suka Shawarma.\n\n` +
            `<blockquote>Gunakan akun Telegram terpisah atau perbarui tautan akun di Admin Dashboard.</blockquote>`,
            undefined,
            'ceo'
          )
        } else {
          await kirimPesanTelegram(
            chatId,
            `⚠️ <b>Tautan Aktivasi Tidak Valid</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Format token undangan tidak dikenali oleh sistem.\n\n` +
            `<blockquote>Pastikan Anda mengklik tautan resmi dari Admin Dashboard atau hubungi Administrator.</blockquote>`,
            undefined,
            'ceo'
          )
        }
        return NextResponse.json({ ok: true, linked: false })
      }

      // KASUS 2: Start biasa tanpa token (/start)
      const admin = supabaseAdmin()
      const { data: existingLink } = await admin
        .from('bot_telegram_links')
        .select('staff_id, outlet_staff(name, role, status)')
        .eq('telegram_user_id', fromId)
        .maybeSingle()

      let whitelistUser: { nama_pengguna?: string } | null = null
      if (!existingLink?.outlet_staff) {
        try {
          const { data } = await admin
            .from('bot_telegram_whitelist')
            .select('nama_pengguna')
            .eq('bot_slug', 'ceo')
            .eq('telegram_user_id', fromId)
            .eq('is_active', true)
            .maybeSingle()
          whitelistUser = data
        } catch {
          // Abaikan jika query gagal
        }
      }

      if ((existingLink && existingLink.outlet_staff) || whitelistUser) {
        const staff = existingLink?.outlet_staff as unknown as { name?: string; role?: string; status?: string } | null
        const staffName = staff?.name || whitelistUser?.nama_pengguna || fromFirstName
        const roleLabel = staff?.role === 'developer'
          ? 'Developer'
          : staff?.role === 'admin'
          ? 'Administrator'
          : staff?.role === 'owner'
          ? 'Owner / Executive'
          : 'Eksekutif Terotorisasi'
        await kirimPesanTelegram(
          chatId,
          `⚡ <b>J.A.R.V.I.S. // COMMAND CENTRE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👋 <b>Salam Hormat, ${staffName}!</b> (<code>${roleLabel}</code>)\n\n` +
          `Satelit telemetri online dan terhubung langsung ke database live Suka Shawarma.\n\n` +
          `<blockquote>💡 Ketik /help untuk daftar komando pintasan eksekutif, atau langsung berikan instruksi bisnis Anda, Sir.</blockquote>`,
          'https://agents.sukashawarma.com',
          'ceo'
        )
      } else {
        await kirimPesanTelegram(
          chatId,
          `⚡ <b>J.A.R.V.I.S. // COMMAND CENTRE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👋 <b>Salam, ${fromFirstName}!</b>\n\n` +
          `Akun Telegram Anda belum terhubung dengan otorisasi eksekutif Bot CEO Suka Shawarma.\n\n` +
          `• <b>Telegram User ID:</b> <code>${fromId}</code>\n` +
          `• <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
          `<blockquote>💡 <b>Langkah Aktivasi:</b>\nBuka Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram, lalu buatkan Tautan Undangan atau daftarkan ID Anda ke Whitelist Bot CEO.</blockquote>`,
          undefined,
          'ceo'
        )
      }
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /id
    if (text === '/id' || text.startsWith('/id ')) {
      await kirimPesanTelegram(
        chatId,
        `🆔 <b>INFORMASI AKUN TELEGRAM</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>User ID:</b> <code>${fromId}</code>\n` +
        `• <b>Chat ID:</b> <code>${chatId}</code>\n` +
        `• <b>Nama:</b> <b>${fromFirstName}</b>\n` +
        `• <b>Username:</b> ${fromUsername ? `@${fromUsername}` : '<i>-(belum disetel)-</i>'}\n\n` +
        `<blockquote>Gunakan <b>User ID</b> di atas untuk pendaftaran whitelist atau verifikasi akses di Admin Dashboard.</blockquote>`,
        undefined,
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /help
    if (text === '/help' || text.startsWith('/help ')) {
      let barisTriggerDinamis = ''
      try {
        const admin = supabaseAdmin()
        const { data: catalogRows } = await admin
          .from('bot_trigger_catalog')
          .select('judul, jadwal_atau_trigger')
          .or('bot_slug.eq.ceo,target_role.in.(owner,admin)')
          .eq('is_active', true)
          .order('urutan', { ascending: true })

        if (Array.isArray(catalogRows) && catalogRows.length > 0) {
          const seen = new Set<string>()
          const uniqueRows = catalogRows.filter((r: { judul?: string }) => {
            if (!r.judul || seen.has(r.judul)) return false
            seen.add(r.judul)
            return true
          })
          barisTriggerDinamis = uniqueRows
            .map(
              (r: { judul?: string; jadwal_atau_trigger?: string }, idx: number) =>
                `${idx + 1}. <b>${r.judul}</b> <code>${r.jadwal_atau_trigger || 'Auto'}</code>`
            )
            .join('\n')
        }
      } catch {
        // Gunakan daftar default jika query katalog gagal
      }

      const daftarTriggerTeks =
        barisTriggerDinamis ||
        `1. 📊 <b>Rekapitulasi & Ranking Penjualan Kemarin</b> <code>04:00 WIB</code>\n` +
        `2. 📢 <b>Ringkasan Kinerja Marketing & Promo Kemarin</b> <code>04:01 WIB</code>\n` +
        `3. 🏢 <b>Laporan Presensi Staf HQ</b> <code>08:30 WIB</code>\n` +
        `4. 👥 <b>Laporan Presensi Kru Seluruh Outlet</b> <code>14:00 WIB</code>\n` +
        `5. 📈 <b>Flash Report Penjualan Sore</b> <code>16:00 WIB</code>\n` +
        `6. ⚠️ <b>Eskalasi Outlet Nol Transaksi di Prime Time</b> <code>19:30 WIB</code>\n` +
        `7. 🌙 <b>Laporan Penutupan & Omzet Final Harian</b> <code>22:00 WIB</code>\n` +
        `8. ⏳ <b>Eskalasi Cut-Off Stok Opname Malam</b> <code>22:30 WIB</code>\n` +
        `9. 📋 <b>Notifikasi Rekap Finalize Stok Opname</b> <code>Real-Time</code>\n` +
        `10. 🛑 <b>Eskalasi Void POS Berisiko Tinggi ≥Rp 50rb</b> <code>Real-Time</code>\n` +
        `11. 💵 <b>Eskalasi Selisih Kas Closing >Rp 100rb</b> <code>Real-Time</code>\n` +
        `12. 🚨 <b>Eskalasi Outlet Telat Buka ≥30 Menit</b> <code>Jam Operasional</code>\n` +
        `13. 🥩 <b>Eskalasi Pengajuan Waste Bahan >Rp 150rb</b> <code>Real-Time</code>\n` +
        `14. 💓 <b>Heartbeat & Diagnostik VPS / Supabase</b> <code>Tiap 2 Jam</code>\n` +
        `15. 🚨 <b>Alert Darurat Server / Database Down</b> <code>Tiap 2 Menit</code>`

      await kirimPesanTelegram(
        chatId,
        `📖 <b>PANDUAN KOMANDO EKSEKUTIF J.A.R.V.I.S.</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Pusat kendali operasional, analitik penjualan real-time, dan asisten AI Suka Shawarma yang terhubung langsung ke seluruh stasiun cabang.\n\n` +
        `⚡ <b>Menu Komando Utama (Slash Commands):</b>\n` +
        `• /omzet — <i>Cek penjualan, AOV & ranking cabang hari ini</i>\n` +
        `• /kemarin — <i>Laporan evaluasi komprehensif seluruh modul kemarin (H-1)</i>\n` +
        `• /evaluasi — <i>Evaluasi multi-app & rekomendasi taktis agent</i>\n` +
        `• /buka — <i>Cek status cabang buka & cabang 0 transaksi</i>\n` +
        `• /absensi — <i>Presensi kru outlet & staf kantor pusat</i>\n` +
        `• /stok — <i>Katalog bahan baku & buffer stok gudang pusat</i>\n` +
        `• /finance — <i>Ringkasan kas, OPEX & rekonsiliasi keuangan</i>\n` +
        `• /status — <i>Executive Daily Briefing 6 divisi</i>\n` +
        `• /new — <i>Mulai sesi percakapan baru (reset konteks)</i>\n` +
        `• /id — <i>Cek info akun Telegram Anda</i>\n\n` +
        `🔔 <b>Katalog Pemicu & Notifikasi Otomatis Eksekutif:</b>\n` +
        daftarTriggerTeks + '\n\n' +
        `<blockquote>💡 <b>Contoh Instruksi Langsung:</b>\n` +
        `• "Tampilkan omzet seluruh outlet hari ini"\n` +
        `• "Cabang mana yang paling sepi dan paling ramai?"\n` +
        `• "Siapa saja staf yang telat atau belum absen hari ini?"\n` +
        `• "Bagaimana kondisi arus kas dan rekonsiliasi hari ini?"</blockquote>`,
        'https://agents.sukashawarma.com',
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Command /new & /reset
    if (text === '/new' || text.startsWith('/new ') || text === '/reset' || text.startsWith('/reset ')) {
      sesiEpochMap.set(fromId, Date.now())
      await kirimPesanTelegram(
        chatId,
        `🔄 <b>SESI PERCAKAPAN BARU DIMULAI</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Konteks memori percakapan telah direset. Pusat komando siap menerima instruksi analitik atau operasional baru, Sir.\n\n` +
        `<blockquote>💡 Ketik /help untuk daftar komando pintasan eksekutif atau berikan instruksi bisnis langsung.</blockquote>`,
        'https://agents.sukashawarma.com',
        'ceo'
      )
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────── Normalisasi Shortcut Slash Commands
    let queryTeks = text.trim()
    const cmdClean = queryTeks.toLowerCase().split(' ')[0]
    if (cmdClean === '/omzet' || cmdClean.startsWith('/omzet@')) {
      queryTeks = 'Berapa omzet seluruh cabang hari ini dan peringkat penjualannya?'
    } else if (
      cmdClean === '/kemarin' ||
      cmdClean.startsWith('/kemarin@') ||
      cmdClean === '/evaluasi' ||
      cmdClean.startsWith('/evaluasi@')
    ) {
      queryTeks =
        'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi (penjualan, finance, HRD, waste, stok, distribusi, dan review) lengkap dengan rekomendasi dan saran taktis dari agent.'
    } else if (cmdClean === '/buka' || cmdClean.startsWith('/buka@')) {
      queryTeks = 'Cabang mana yang sudah buka dan mana yang belum ada transaksi hari ini?'
    } else if (cmdClean === '/absensi' || cmdClean.startsWith('/absensi@') || cmdClean === '/absen' || cmdClean.startsWith('/absen@')) {
      queryTeks = 'Bagaimana status kehadiran, keterlambatan, dan perizinan staf hari ini?'
    } else if (cmdClean === '/stok' || cmdClean.startsWith('/stok@')) {
      queryTeks = 'Bagaimana status stok gudang pusat dan katalog bahan baku hari ini?'
    } else if (cmdClean === '/finance' || cmdClean.startsWith('/finance@')) {
      queryTeks = 'Bagaimana ringkasan keuangan, kas operasional, dan rekonsiliasi hari ini?'
    } else if (cmdClean === '/status' || cmdClean.startsWith('/status@')) {
      queryTeks = 'Berikan status report menyeluruh sistem operasional dan ringkasan eksekutif hari ini.'
    }

    // ─────────────────────────────────────────────────────────── Tanya Jawab Hermes AI 2-Way
    const admin = supabaseAdmin()

    // 1. Cek apakah staf terdaftar dengan role eksekutif (owner, admin, developer)
    const { data: linkInfo } = await admin
      .from('bot_telegram_links')
      .select('staff_id, outlet_staff(id, name, role, status)')
      .eq('telegram_user_id', fromId)
      .maybeSingle()

    const staff = linkInfo?.outlet_staff as unknown as { id?: string; name?: string; role?: string; status?: string } | null
    let userName = staff?.name
    let userRole = staff?.role

    const allowedExecutiveRoles = ['owner', 'admin', 'developer']
    const isExecutiveRole = staff && staff.status === 'active' && allowedExecutiveRoles.includes(staff.role || '')

    if (!isExecutiveRole) {
      // 2. Cek explicit hermes_bot_user_access untuk profil 'ceo'
      let hasExplicitAccess = false
      if (staff && staff.status === 'active') {
        try {
          const { data: accessRow } = await admin
            .from('hermes_bot_user_access')
            .select('staff_id')
            .eq('bot_slug', 'ceo')
            .eq('staff_id', staff.id)
            .maybeSingle()
          if (accessRow) hasExplicitAccess = true
        } catch {
          // Abaikan
        }
      }

      // 3. Fallback cek standalone whitelist per bot (bot_slug = 'ceo')
      let whitelistUser: { nama_pengguna?: string } | null = null
      if (!hasExplicitAccess) {
        try {
          const { data } = await admin
            .from('bot_telegram_whitelist')
            .select('nama_pengguna')
            .eq('bot_slug', 'ceo')
            .eq('telegram_user_id', fromId)
            .eq('is_active', true)
            .maybeSingle()
          whitelistUser = data
        } catch {
          // Abaikan jika query gagal
        }
      }

      if (!hasExplicitAccess && !whitelistUser) {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Akun Telegram Anda belum terhubung atau tidak memiliki wewenang eksekutif Bot CEO. Silakan hubungi Administrator.',
          undefined,
          'ceo'
        )
        return NextResponse.json({ ok: true })
      }

      if (whitelistUser) {
        userName = whitelistUser.nama_pengguna
        userRole = 'eksekutif_terotorisasi'
      }
    }

    // Kirim indikasi typing segera dan pertahankan setiap 4 detik selama memproses
    await kirimAksiChatTelegram(chatId, 'typing', 'ceo').catch(() => {})
    const typingInterval = setInterval(() => {
      kirimAksiChatTelegram(chatId, 'typing', 'ceo').catch(() => {})
    }, 4000)

    try {
      let telemetri = null
      try {
        telemetri = await ambilTelemetriNyata()
      } catch (teleErr) {
        console.warn("[telegram-ceo-webhook] Gagal mengambil telemetri nyata:", teleErr)
      }

      let ringkasanTelemetri = ""
      if (telemetri) {
        const k = telemetri.ringkasanKemarin
        const w = telemetri.waste
        const topWaste = w?.topBahan
          ?.map(
            (b) =>
              `${b.nama} (${b.totalQty} ${b.satuan}, Est Rugi: ${formatRupiah(b.estKerugianRp)}, Alasan: ${b.alasanDominan})`
          )
          .join("; ")
        const topOutWaste = w?.topOutlet?.map((o) => `${o.nama} (${o.frekuensi}x)`).join("; ")
        const v = telemetri.voidOrder
        const voidSummary = v
          ? `Hari ini: ${v.totalVoidHariIni} order (${formatRupiah(v.totalNilaiVoidHariIni)}), Kemarin: ${v.totalVoidKemarin || 0} order (${formatRupiah(v.totalNilaiVoidKemarin || 0)})`
          : "0 void"
        const sb = telemetri.statusBuka
        const belumBukaList = sb?.daftarBelumBuka?.length ? ` (Belum buka: ${sb.daftarBelumBuka.join(', ')})` : ''
        const bukaSummary = sb
          ? `${sb.totalBuka} cabang buka live, ${sb.totalBelumBuka} belum buka${belumBukaList} (Kemarin: ${sb.shiftKemarinClosedCount} closed shift)`
          : ""

        const fin = telemetri.finance
        const finSummary = fin
          ? `Utang PO: ${formatRupiah(fin.utangPo.totalUtang)} (${fin.utangPo.jumlahPo} PO), OPEX Hari ini: ${formatRupiah(fin.pengeluaranHariIni.totalNominal)}, OPEX Kemarin: ${formatRupiah(fin.pengeluaranKemarin?.totalNominal || 0)}, Setoran input hari ini: ${formatRupiah(fin.setoranKas.inputHariIni?.totalNominal || 0)}`
          : ""

        const rev = telemetri.review
        const listTopRev = rev?.topCabangRating
          ? rev.topCabangRating.map((c, i) => `${i + 1}. ${c.outlet}: ${c.rating}⭐ (${c.totalUlasan} ulasan)`).join('\n  ')
          : ''
        const revSummary = rev
          ? `Rating rata-rata konsolidasi: ${rev.ratingRataRata}⭐ (${rev.totalUlasan} ulasan Google Maps dari ${rev.topCabangRating?.length || 0} cabang). Rekap seluruh cabang:\n  ${listTopRev}`
          : ""

        const dist = telemetri.distribusi
        const distSummary = dist
          ? `Total SJ: ${dist.totalSuratJalanDikirim}, Ada selisih: ${dist.totalSuratJalanAdaSelisih}`
          : ""

        const hrdKemarin = telemetri.hrdKemarin
        const hrdSummary = `Live: ${telemetri.kehadiranTotal} clock-in (${telemetri.persenOnTime}% On-Time, ${telemetri.kehadiranTelat} telat). Kemarin: ${hrdKemarin?.kehadiranTotal || 0} clock-in (${hrdKemarin?.persenOnTime || 100}% On-Time, ${hrdKemarin?.kehadiranTelat || 0} telat)`

        ringkasanTelemetri = `\n[Data Telemetri Database Suka Shawarma]:
- Evaluasi Closing Kemarin (H-1): ${formatRupiah(k?.omzetTotal || 0)} (${k?.totalOrder || 0} order, AOV ${formatRupiah(k?.aov || 0)})
- Omzet Live Hari Ini: ${formatRupiah(telemetri.omzetTotal)} (${telemetri.totalOrder} order dari ${telemetri.outletsAktifTransaksi.length} cabang aktif)
- Presensi & SDM Kru: ${hrdSummary}
- Keuangan & OPEX: ${finSummary}
- Ulasan Google Reviews: ${revSummary}
- Logistik Distribusi: ${distSummary}
- Audit Waste 30 Hari: Total ${w?.totalLaporan30Hari || 0} laporan (Est Kerugian: ${formatRupiah(w?.totalEstKerugianRp || 0)}). Top Bahan: ${topWaste || "-"}. Top Cabang: ${topOutWaste || "-"}
- Audit Void POS: ${voidSummary}
- Status Buka Cabang: ${bukaSummary}`
      }

      const baseUrl = process.env.HERMES_API_URL
      const kunci = kunciProfil("ceo")
      const promptUser = `[Konteks Eksekutif: Nama: ${userName || fromFirstName}, Role: ${userRole || "Executive"}]${ringkasanTelemetri}\nPertanyaan: ${queryTeks}`

      let jawabanAi = ""
      // Coba Hermes dengan batas waktu 12 detik agar webhook tidak timeout
      if (baseUrl && kunci) {
        try {
          const epoch = sesiEpochMap.get(fromId)
          const sesiId = epoch ? `telegram-ceo-${fromId}-${epoch}` : `telegram-ceo-${fromId}`
          for await (const chunk of tanyaHermes({
            baseUrl,
            kunci,
            profil: "ceo",
            sesiId,
            pesan: promptUser,
            signal: AbortSignal.timeout(12_000),
          })) {
            jawabanAi += chunk
          }
        } catch (e) {
          console.warn("[telegram-ceo-webhook] Hermes gagal atau timeout, beralih ke AI Router + Telemetri Nyata:", e)
        }
      }

      // Deteksi jika Hermes menolak karena prompt lama di VPS belum reload tool MCP
      if (jawabanAi.trim()) {
        const textLower = jawabanAi.toLowerCase()
        const penolakanMcp =
          textLower.includes("belum memiliki endpoint") ||
          textLower.includes("belum memiliki tool mcp") ||
          textLower.includes("tidak dapat dicek. sistem bot saat ini belum memiliki") ||
          textLower.includes("mcp untuk membaca data log/pencatatan waste") ||
          textLower.includes("dilarang menebak atau mengarang angka/data waste") || textLower.includes("provider authentication failed") || textLower.includes("not connected to any ai provider") || textLower.includes("alat mcp belum tersambung")
        if (penolakanMcp) {
          console.warn("[telegram-ceo-webhook] Hermes menolak karena aturan lama, beralih ke AI Router / dev simulation")
          jawabanAi = ""
        }
      }

      // Fallback ke AI Router (9Router) + Telemetri Nyata (identik dengan In-App Executive Copilot)
      if (!jawabanAi.trim()) {
        if (!telemetri) {
          try {
            telemetri = await ambilTelemetriNyata()
          } catch (teleErr) {
            console.warn('[telegram-ceo-webhook] Gagal mengambil telemetri nyata:', teleErr)
          }
        }

        if (!process.env.AI_BASE_URL) process.env.AI_BASE_URL = 'http://76.13.193.138:20128/v1'
        if (!process.env.AI_API_KEY) process.env.AI_API_KEY = 'sk-09f612c52578948f-zfpefg-d18a0fd3'
        if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
          try {
            for await (const chunk of tanyaAiRouter({
              pesan: promptUser,
              profil: 'ceo',
              telemetri,
              signal: AbortSignal.timeout(18_000),
            })) {
              jawabanAi += chunk
            }
          } catch (fallbackErr) {
            console.warn('[telegram-ceo-webhook] Fallback AI Router gagal atau timeout:', fallbackErr)
          }
        }

        // Jika AI Router juga kosong atau gagal, gunakan analisis cerdas telemetri langsung
        if (!jawabanAi.trim()) {
          try {
            for (const chunk of buatJawabanDev(queryTeks, 'ceo', telemetri)) {
              jawabanAi += chunk
            }
          } catch (simErr) {
            console.error('[telegram-ceo-webhook] buatJawabanDev gagal:', simErr)
            jawabanAi = '⚠️ Terjadi kendala saat memproses jawaban eksekutif. Silakan ulangi pertanyaan Anda, Sir.'
          }
        }
      }

      if (jawabanAi.trim()) {
        await kirimPesanTelegram(chatId, jawabanAi.trim(), undefined, 'ceo')
      } else {
        await kirimPesanTelegram(
          chatId,
          '⚠️ Maaf Sir, sistem belum dapat memproses instruksi tersebut. Silakan ketik perintah seputar omzet, status cabang, atau presensi.',
          undefined,
          'ceo'
        )
      }
    } finally {
      clearInterval(typingInterval)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[telegram-ceo-webhook] Error handling update:', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
