'use client'

import { useState } from 'react'
import { buatLinkAktivasiTelegram, daftarkanBotTelegram, ubahAksesBotTelegram } from './actions'

type Bot = { slug: string; nama: string }
type Staff = {
  id: string
  name: string
  username: string | null
  role: string
  telegramUserId: string | null
}
type Access = { botSlug: string; staffId: string }

export default function AksesBotTelegram({ initialBots, initialStaff, initialAccess }: {
  initialBots: Bot[]
  initialStaff: Staff[]
  initialAccess: Access[]
}) {
  const [bots, setBots] = useState(initialBots)
  const [selectedBot, setSelectedBot] = useState('')
  const [access, setAccess] = useState(initialAccess)
  const [search, setSearch] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [activationLinks, setActivationLinks] = useState<Record<string, string>>({})
  const [showRegister, setShowRegister] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function createActivationLink(row: Staff) {
    setBusy(`invite:${row.id}`)
    setError(null)
    try {
      const result = await buatLinkAktivasiTelegram(selectedBot, row.id, botUsername)
      if (result.error) throw new Error(result.error)
      if (!result.url) throw new Error('Link aktivasi gagal dibuat.')
      setActivationLinks((current) => ({ ...current, [`${selectedBot}:${row.id}`]: result.url! }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Link aktivasi gagal dibuat.')
    } finally {
      setBusy(null)
    }
  }

  async function copyActivationLink(key: string) {
    const url = activationLinks[key]
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setError(null)
    } catch {
      setError('Browser tidak mengizinkan penyalinan otomatis. Salin link yang ditampilkan secara manual.')
    }
  }

  const bot = bots.find((item) => item.slug === selectedBot)
  const filtered = initialStaff.filter((row) =>
    `${row.name} ${row.username ?? ''} ${row.role}`.toLowerCase().includes(search.toLowerCase()))
  const selectedCount = access.filter((item) => item.botSlug === selectedBot).length

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium text-gray-700">Pilih bot
            <select value={selectedBot} onChange={(event) => { setSelectedBot(event.target.value); setError(null) }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="">-- Pilih bot --</option>
              {bots.map((item) => <option key={item.slug} value={item.slug}>{item.nama} ({item.slug})</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setShowRegister((current) => !current)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
            {showRegister ? 'Batal' : 'Daftarkan bot lain'}
          </button>
        </div>
        {showRegister && (
          <form onSubmit={registerBot} className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
            <label className="text-sm text-gray-700">Nama profil Hermes di VPS
              <input required value={newSlug} onChange={(event) => setNewSlug(event.target.value.toLowerCase())}
                placeholder="mis. finance" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-700">Nama bot
              <input required value={newName} onChange={(event) => setNewName(event.target.value)}
                placeholder="mis. Bot Finance" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <p className="text-xs text-gray-500 sm:col-span-2">Daftarkan profil yang sudah dibuat di VPS. Pendaftaran di sini tidak membuat bot atau token Telegram baru.</p>
            <button type="submit" disabled={busy !== null} className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan bot</button>
          </form>
        )}
      </div>

      {bot && <p className="text-sm text-gray-600">{selectedCount} staf diberi akses ke <strong>{bot.nama}</strong>.</p>}
      {selectedBot && (
        <div className="space-y-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">
          <p>Setelah memberi akses, buat link aktivasi khusus untuk staf. Staf cukup membuka link, mengonfirmasi akun Telegram, lalu menekan Start pada bot.</p>
          <label className="block text-sm font-medium">Username bot Telegram
            <input value={botUsername} onChange={(event) => setBotUsername(event.target.value.replace(/^@/, ''))}
              placeholder="mis. Stokis_SukaShawarmaBot" className="mt-1 block w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-gray-900" />
          </label>
          <p className="text-xs text-green-800">Link berlaku 24 jam dan hanya bisa dipakai sekali. Kirim link melalui kanal internal yang aman.</p>
        </div>
      )}

      {!selectedBot && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">Pilih bot untuk melihat dan mengatur stafnya.</p>}
      {selectedBot && <label className="block text-sm font-medium text-gray-700">Cari staf
        <input value={search} onChange={(event) => setSearch(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          placeholder="Nama, username, atau role" />
      </label>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {selectedBot && <div className="max-h-[65vh] divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {filtered.map((row) => {
          const allowed = access.some((item) => item.botSlug === selectedBot && item.staffId === row.id)
          const inviteKey = `${selectedBot}:${row.id}`
          const inviteUrl = activationLinks[inviteKey]
          return (
            <div key={row.id} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">{row.name}</p>
                  <p className="text-gray-500">{row.role}{row.telegramUserId
                    ? ` · Telegram terhubung (${row.telegramUserId})`
                    : ' · Telegram belum terhubung'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {allowed && <button type="button" onClick={() => createActivationLink(row)} disabled={busy !== null || !botUsername}
                    className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">
                    {busy === `invite:${row.id}` ? 'Membuat…' : 'Buat link aktivasi'}
                  </button>}
                  <button type="button" onClick={() => changeAccess(row)} disabled={busy !== null}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${allowed
                      ? 'border border-red-300 text-red-700'
                      : 'bg-blue-600 text-white'}`}>
                    {busy === row.id ? 'Menyimpan…' : allowed ? 'Cabut akses' : 'Beri akses'}
                  </button>
                </div>
              </div>
              {inviteUrl && <div className="flex gap-2 rounded-lg bg-gray-50 p-2">
                <input readOnly value={inviteUrl} className="min-w-0 flex-1 bg-transparent text-xs text-gray-600" aria-label={`Link aktivasi ${row.name}`} />
                <button type="button" onClick={() => copyActivationLink(inviteKey)} className="text-xs font-semibold text-blue-700">Salin</button>
              </div>}
            </div>
          )
        })}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-500">Staf tidak ditemukan.</p>}
      </div>}
    </section>
  )
}
