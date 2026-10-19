'use client'

import { useEffect, useState } from 'react'
import {
  daftarkanBotTelegram,
  simpanIdTelegramStaf,
  ubahAksesBotTelegram,
  simpanBotUsername,
  ambilDataWhitelistDanInvite,
  buatInviteCode,
  tambahWhitelistManual,
  ubahStatusWhitelist,
  hapusWhitelist,
  ubahStatusInviteCode,
} from './actions'

type Bot = { slug: string; nama: string; bot_username?: string | null }
type Staff = {
  id: string
  name: string
  username: string | null
  role: string
  telegramUserId: string | null
}
type Access = { botSlug: string; staffId: string }
type WhitelistRow = {
  id: string
  bot_slug: string
  telegram_user_id: string
  nama_pengguna: string
  username_telegram: string | null
  is_active: boolean
  catatan: string | null
  dibuat_at: string
}
type InviteRow = {
  id: string
  code: string
  bot_slug: string
  label: string | null
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
  dibuat_at: string
}

export default function AksesBotTelegram({ initialBots, initialStaff, initialAccess }: {
  initialBots: Bot[]
  initialStaff: Staff[]
  initialAccess: Access[]
}) {
  const [bots, setBots] = useState<Bot[]>(initialBots)
  const [selectedBot, setSelectedBot] = useState('')
  const [access, setAccess] = useState(initialAccess)
  const [search, setSearch] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [botUsernameInput, setBotUsernameInput] = useState('')

  // Tab: 'undangan' (Mandiri / Deep Link) vs 'staf' (Akun Staf Terdaftar)
  const [activeTab, setActiveTab] = useState<'undangan' | 'staf'>('undangan')

  // Data Whitelist & Invite Codes
  const [whitelist, setWhitelist] = useState<WhitelistRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loadingExtra, setLoadingExtra] = useState(false)

  // Form Buat Undangan
  const [inviteLabel, setInviteLabel] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('1')
  const [inviteExpiresHours, setInviteExpiresHours] = useState('24')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Form Tambah Manual Whitelist
  const [manualTgId, setManualTgId] = useState('')
  const [manualNama, setManualNama] = useState('')
  const [manualCatatan, setManualCatatan] = useState('')

  const [telegramIds, setTelegramIds] = useState<Record<string, string>>(
    () => Object.fromEntries(initialStaff.map((row) => [row.id, row.telegramUserId ?? '']))
  )
  const [savedTelegramIds, setSavedTelegramIds] = useState<Record<string, string>>(
    () => Object.fromEntries(initialStaff.map((row) => [row.id, row.telegramUserId ?? '']))
  )
  const [showRegister, setShowRegister] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const currentBot = bots.find((item) => item.slug === selectedBot)

  // Muat data whitelist & invite saat bot dipilih
  useEffect(() => {
    if (!selectedBot) {
      setWhitelist([])
      setInvites([])
      setGeneratedLink(null)
      return
    }
    setBotUsernameInput(currentBot?.bot_username ?? '')
    setLoadingExtra(true)
    setError(null)
    setGeneratedLink(null)

    ambilDataWhitelistDanInvite(selectedBot)
      .then((res) => {
        if ('error' in res && res.error) {
          setError(res.error)
        } else if ('whitelist' in res) {
          setWhitelist(res.whitelist as WhitelistRow[])
          setInvites(res.invites as InviteRow[])
          if (res.botUsername && currentBot) {
            currentBot.bot_username = res.botUsername
          }
        }
      })
      .finally(() => setLoadingExtra(false))
  }, [selectedBot])

  async function handleSaveBotUsername() {
    if (!selectedBot) return
    setBusy('bot_username')
    setError(null)
    try {
      const res = await simpanBotUsername(selectedBot, botUsernameInput)
      if (res.error) throw new Error(res.error)
      setBots((curr) => curr.map((b) => b.slug === selectedBot ? { ...b, bot_username: res.botUsername } : b))
      setSuccessMsg('Username bot Telegram berhasil disimpan.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan username bot.')
    } finally {
      setBusy(null)
    }
  }

  async function handleBuatInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedBot) return
    setBusy('create_invite')
    setError(null)
    try {
      const maxUses = inviteMaxUses === '0' ? null : parseInt(inviteMaxUses, 10) || 1
      const expiresHours = inviteExpiresHours === '0' ? null : parseInt(inviteExpiresHours, 10) || 24
      const res = await buatInviteCode(selectedBot, inviteLabel, maxUses, expiresHours)
      if (res.error) throw new Error(res.error)
      if (res.invite) {
        setInvites((curr) => [res.invite as InviteRow, ...curr])
        setGeneratedLink(res.deepLink ?? null)
        setInviteLabel('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat kode undangan.')
    } finally {
      setBusy(null)
    }
  }

  async function handleTambahManual(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedBot) return
    setBusy('manual_add')
    setError(null)
    try {
      const res = await tambahWhitelistManual(selectedBot, manualTgId, manualNama, manualCatatan)
      if (res.error) throw new Error(res.error)
      setManualTgId('')
      setManualNama('')
      setManualCatatan('')
      setSuccessMsg('User berhasil ditambahkan ke whitelist.')
      setTimeout(() => setSuccessMsg(null), 3000)
      // Refresh whitelist
      const refreshed = await ambilDataWhitelistDanInvite(selectedBot)
      if ('whitelist' in refreshed) setWhitelist(refreshed.whitelist as WhitelistRow[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menambahkan user manual.')
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleWhitelist(row: WhitelistRow) {
    setBusy(`whitelist_status_${row.id}`)
    setError(null)
    try {
      const res = await ubahStatusWhitelist(row.id, !row.is_active)
      if (res.error) throw new Error(res.error)
      setWhitelist((curr) => curr.map((r) => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengubah status whitelist.')
    } finally {
      setBusy(null)
    }
  }

  async function handleHapusWhitelist(id: string) {
    if (!confirm('Yakin ingin mencabut akses ID Telegram ini?')) return
    setBusy(`whitelist_del_${id}`)
    setError(null)
    try {
      const res = await hapusWhitelist(id)
      if (res.error) throw new Error(res.error)
      setWhitelist((curr) => curr.filter((r) => r.id !== id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menghapus user dari whitelist.')
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleInvite(row: InviteRow) {
    setBusy(`invite_status_${row.id}`)
    try {
      const res = await ubahStatusInviteCode(row.id, !row.is_active)
      if (res.error) throw new Error(res.error)
      setInvites((curr) => curr.map((r) => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengubah status undangan.')
    } finally {
      setBusy(null)
    }
  }

  function salinTeks(teks: string, key: string) {
    navigator.clipboard.writeText(teks)
    setCopiedCode(key)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  async function changeAccess(row: Staff) {
    const botSlug = selectedBot
    const enabled = !access.some((item) => item.botSlug === botSlug && item.staffId === row.id)
    setBusy(row.id)
    setError(null)
    try {
      const result = await ubahAksesBotTelegram(botSlug, row.id, enabled)
      if (result.error) throw new Error(result.error)
      setAccess((current) => enabled
        ? [...current, { botSlug, staffId: row.id }]
        : current.filter((item) => item.botSlug !== botSlug || item.staffId !== row.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Akses gagal diubah.')
    } finally {
      setBusy(null)
    }
  }

  async function registerBot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('register')
    setError(null)
    try {
      const result = await daftarkanBotTelegram(newSlug, newName)
      if (result.error) throw new Error(result.error)
      if (!result.bot) throw new Error('Bot gagal didaftarkan.')
      setBots((current) => [...current, result.bot!].sort((a, b) => a.nama.localeCompare(b.nama)))
      setSelectedBot(result.bot.slug)
      setNewSlug('')
      setNewName('')
      setShowRegister(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bot gagal didaftarkan.')
    } finally {
      setBusy(null)
    }
  }

  async function saveTelegramId(row: Staff, value = telegramIds[row.id] ?? '') {
    setBusy(`telegram:${row.id}`)
    setError(null)
    try {
      const result = await simpanIdTelegramStaf(selectedBot, row.id, value)
      if (result.error) throw new Error(result.error)
      const savedId = result.telegramUserId ?? ''
      setTelegramIds((current) => ({ ...current, [row.id]: savedId }))
      setSavedTelegramIds((current) => ({ ...current, [row.id]: savedId }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ID Telegram gagal disimpan.')
    } finally {
      setBusy(null)
    }
  }

  const filteredStaff = initialStaff.filter((row) =>
    `${row.name} ${row.username ?? ''} ${row.role}`.toLowerCase().includes(search.toLowerCase()))
  const staffCount = access.filter((item) => item.botSlug === selectedBot).length

  return (
    <section className="space-y-6">
      {/* 1. Pemilihan Bot & Pendaftaran Bot */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium text-gray-700">Pilih Bot Target
            <select
              value={selectedBot}
              onChange={(event) => { setSelectedBot(event.target.value); setError(null) }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
            >
              <option value="">-- Pilih bot yang akan dikelola --</option>
              {bots.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.nama} ({item.slug}) {item.bot_username ? `[@${item.bot_username}]` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowRegister((curr) => !curr)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showRegister ? 'Batal' : '+ Daftarkan Profil Bot Baru'}
          </button>
        </div>

        {/* Username Bot Telegram Helper */}
        {selectedBot && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
            <span className="text-xs font-medium text-gray-500">Username Telegram Bot (@):</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">@</span>
              <input
                type="text"
                placeholder="mis. SukaStokisBot"
                value={botUsernameInput}
                onChange={(e) => setBotUsernameInput(e.target.value)}
                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleSaveBotUsername}
                disabled={busy === 'bot_username'}
                className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {busy === 'bot_username' ? 'Menyimpan...' : 'Simpan Username'}
              </button>
            </div>
            <span className="text-xs text-gray-400">(Wajib diisi agar tautan undangan langsung membuka Telegram bot yang sesuai)</span>
          </div>
        )}

        {showRegister && (
          <form onSubmit={registerBot} className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
            <label className="text-sm text-gray-700">Nama profil Hermes di VPS
              <input required value={newSlug} onChange={(event) => setNewSlug(event.target.value.toLowerCase())}
                placeholder="mis. finance" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-gray-700">Nama Tampilan Bot
              <input required value={newName} onChange={(event) => setNewName(event.target.value)}
                placeholder="mis. Bot Finance" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-gray-500 sm:col-span-2">Daftarkan profil yang sudah dibuat di VPS. Pendaftaran di sini tidak membuat bot atau token Telegram baru.</p>
            <button type="submit" disabled={busy !== null} className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan bot</button>
          </form>
        )}
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMsg}</div>}

      {/* 2. Mode Akses: Tab Undangan Mandiri vs Akun Staf */}
      {selectedBot && (
        <div className="space-y-4">
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('undangan')}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'undangan'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🚀 Tautan Undangan &amp; Whitelist Mandiri
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{whitelist.length} User</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('staf')}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'staf'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Akses Akun Staf Internal
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{staffCount} Staf</span>
            </button>
          </div>

          {/* TAB 1: TAUTAN UNDANGAN & WHITELIST MANDIRI */}
          {activeTab === 'undangan' && (
            <div className="space-y-6">
              {/* Box Pembuatan Tautan Undangan */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
                <h2 className="text-base font-semibold text-blue-950">Buat Tautan Undangan Otomatis (Deep Link 1-Klik)</h2>
                <p className="mt-1 text-xs text-blue-800">
                  User cukup klik link ini di WhatsApp/HP dan tekan <strong>START</strong>. Akun Telegram mereka otomatis terdaftar dan bisa langsung chat bot tanpa perlu mengisi ID manual.
                </p>

                <form onSubmit={handleBuatInvite} className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">Label / Penerima</label>
                    <input
                      type="text"
                      required
                      placeholder="mis. Pak Hadi (Investor) / Vendor Ayam"
                      value={inviteLabel}
                      onChange={(e) => setInviteLabel(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Batas Kuota Pemakaian</label>
                    <select
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="1">1x pakai (Pribadi)</option>
                      <option value="5">5x pakai</option>
                      <option value="0">Tidak Terbatas (Grup)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Masa Berlaku</label>
                    <select
                      value={inviteExpiresHours}
                      onChange={(e) => setInviteExpiresHours(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="24">24 Jam</option>
                      <option value="72">3 Hari</option>
                      <option value="168">7 Hari</option>
                      <option value="0">Selamanya</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex items-center justify-between pt-1">
                    <button
                      type="submit"
                      disabled={busy === 'create_invite'}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy === 'create_invite' ? 'Membuat Tautan...' : '⚡ Generate Tautan Undangan'}
                    </button>
                    {generatedLink && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-100/70 px-3 py-1.5 text-xs text-emerald-900 border border-emerald-300">
                        <span className="font-mono">{generatedLink}</span>
                        <button
                          type="button"
                          onClick={() => salinTeks(generatedLink, 'latest_gen')}
                          className="rounded bg-emerald-700 px-2 py-0.5 font-semibold text-white hover:bg-emerald-800"
                        >
                          {copiedCode === 'latest_gen' ? '✓ Tersalin!' : 'Salin'}
                        </button>
                      </div>
                    )}
                  </div>
                </form>

                {/* Daftar Kode Undangan Aktif */}
                {invites.length > 0 && (
                  <div className="mt-5 border-t border-blue-100 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">Riwayat Kode Undangan Terbaru</h3>
                    <div className="mt-2 divide-y divide-gray-100 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-3 py-2">Kode</th>
                            <th className="px-3 py-2">Label</th>
                            <th className="px-3 py-2">Terpakai</th>
                            <th className="px-3 py-2">Kedaluwarsa</th>
                            <th className="px-3 py-2">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {invites.map((inv) => {
                            const link = currentBot?.bot_username
                              ? `https://t.me/${currentBot.bot_username}?start=inv_${inv.code}`
                              : `/start inv_${inv.code}`
                            return (
                              <tr key={inv.id} className={!inv.is_active ? 'opacity-50 bg-gray-50' : ''}>
                                <td className="px-3 py-2 font-mono font-semibold text-blue-600">{inv.code}</td>
                                <td className="px-3 py-2 text-gray-800">{inv.label || '-'}</td>
                                <td className="px-3 py-2">
                                  {inv.used_count} / {inv.max_uses ? `${inv.max_uses}x` : '∞'}
                                </td>
                                <td className="px-3 py-2 text-gray-500">
                                  {inv.expires_at ? new Date(inv.expires_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Selamanya'}
                                </td>
                                <td className="px-3 py-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => salinTeks(link, inv.id)}
                                    className="rounded bg-blue-50 border border-blue-200 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-100"
                                  >
                                    {copiedCode === inv.id ? '✓ Tersalin' : 'Salin Link'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInvite(inv)}
                                    disabled={busy === `invite_status_${inv.id}`}
                                    className="text-gray-500 hover:text-red-600 text-xs"
                                  >
                                    {inv.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Tambah Whitelist Manual */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Daftar ID Telegram Terdaftar (Whitelist)</h2>
                    <p className="text-xs text-gray-500">Daftar ID Telegram yang sudah memiliki akses ke bot <strong>{currentBot?.nama}</strong>.</p>
                  </div>
                </div>

                <form onSubmit={handleTambahManual} className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">ID Telegram Numerik</label>
                    <input
                      type="text"
                      required
                      placeholder="mis. 123456789"
                      value={manualTgId}
                      onChange={(e) => setManualTgId(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Nama Pengguna / Penanda</label>
                    <input
                      type="text"
                      required
                      placeholder="mis. Pak Joko"
                      value={manualNama}
                      onChange={(e) => setManualNama(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Catatan (Opsional)</label>
                    <input
                      type="text"
                      placeholder="mis. Mitra Cabang Depok"
                      value={manualCatatan}
                      onChange={(e) => setManualCatatan(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={busy === 'manual_add' || !manualTgId || !manualNama}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      {busy === 'manual_add' ? 'Menyimpan...' : '+ Tambah ID Manual'}
                    </button>
                  </div>
                </form>

                {/* Tabel Whitelist */}
                <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5">Nama</th>
                        <th className="px-4 py-2.5">Telegram ID</th>
                        <th className="px-4 py-2.5">Username</th>
                        <th className="px-4 py-2.5">Keterangan</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingExtra && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-500">Memuat whitelist...</td>
                        </tr>
                      )}
                      {!loadingExtra && whitelist.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-400">
                            Belum ada ID Telegram di whitelist bot ini. Buat tautan undangan atau tambahkan manual di atas.
                          </td>
                        </tr>
                      )}
                      {!loadingExtra && whitelist.map((row) => (
                        <tr key={row.id} className={!row.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{row.nama_pengguna}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-600">{row.telegram_user_id}</td>
                          <td className="px-4 py-2.5 text-gray-500">{row.username_telegram ? `@${row.username_telegram}` : '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{row.catatan || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleToggleWhitelist(row)}
                              disabled={busy === `whitelist_status_${row.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHapusWhitelist(row.id)}
                              disabled={busy === `whitelist_del_${row.id}`}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AKUN STAF INTERNAL */}
          {activeTab === 'staf' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
                Akses Staf mengaitkan akun staf di database internal. ID berlaku untuk semua bot yang diizinkan bagi staf tersebut.
              </div>

              <label className="block text-sm font-medium text-gray-700">Cari staf internal
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Nama, username, atau role staf"
                />
              </label>

              <div className="max-h-[65vh] divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {filteredStaff.map((row) => {
                  const allowed = access.some((item) => item.botSlug === selectedBot && item.staffId === row.id)
                  return (
                    <div key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-48 flex-1 text-sm">
                        <p className="font-medium text-gray-900">{row.name}</p>
                        <p className="text-gray-500">
                          {row.role}
                          {savedTelegramIds[row.id]
                            ? ` · Telegram ID ${savedTelegramIds[row.id]}`
                            : ' · Telegram belum diatur'}
                        </p>
                      </div>
                      {allowed && (
                        <div className="flex min-w-64 flex-1 gap-2">
                          <input
                            value={telegramIds[row.id] ?? ''}
                            onChange={(event) => setTelegramIds((current) => ({
                              ...current,
                              [row.id]: event.target.value.replace(/\D/g, '').slice(0, 24),
                            }))}
                            inputMode="numeric"
                            placeholder="ID Telegram numerik"
                            aria-label={`ID Telegram ${row.name}`}
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveTelegramId(row)}
                              disabled={busy !== null || !(telegramIds[row.id] ?? '')}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {busy === `telegram:${row.id}` ? 'Menyimpan…' : 'Simpan ID'}
                            </button>
                            {savedTelegramIds[row.id] && (
                              <button
                                type="button"
                                onClick={() => saveTelegramId(row, '')}
                                disabled={busy !== null}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                              >
                                Hapus ID
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => changeAccess(row)}
                        disabled={busy !== null}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                          allowed
                            ? 'border border-red-300 text-red-700'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {busy === row.id ? 'Menyimpan…' : allowed ? 'Cabut akses' : 'Beri akses'}
                      </button>
                    </div>
                  )
                })}
                {filteredStaff.length === 0 && <p className="p-4 text-sm text-gray-500">Staf tidak ditemukan.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedBot && (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Silakan pilih bot pada dropdown di atas untuk mengelola tautan undangan, whitelist, dan hak akses.
        </p>
      )}
    </section>
  )
}
