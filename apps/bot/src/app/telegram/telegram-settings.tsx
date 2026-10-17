'use client'

import { useState } from 'react'

type Props = { awalTerhubung: boolean; username: string | null; botTersedia: boolean; loginTersedia: boolean }

export default function TelegramSettings({ awalTerhubung, username, botTersedia, loginTersedia }: Props) {
  const [linked, setLinked] = useState(awalTerhubung)
  const [name, setName] = useState(username)
  const [telegramUserId, setTelegramUserId] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch('/api/telegram/link', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Status koneksi gagal dimuat.')
    setLinked(!!data.linked)
    setName(data.username ?? null)
    if (data.linked) setCodeSent(false)
  }

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/telegram/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegramUserId }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim kode.')
      setCodeSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengirim kode.')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/telegram/link', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegramUserId, code }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kode tidak dapat diverifikasi.')
      await refresh()
      setCode('')
      setCodeSent(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kode tidak dapat diverifikasi.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/telegram/link', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal memutus koneksi.')
      setLinked(false)
      setName(null)
      setCodeSent(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memutus koneksi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 space-y-3">
      {linked ? (
        <>
          <p className="text-sm font-semibold text-emerald-300">✓ Telegram terhubung {name ? `(@${name})` : ''}</p>
          <button onClick={disconnect} disabled={busy} className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-200 disabled:opacity-50">
            Putuskan koneksi
          </button>
        </>
      ) : (
        <>
          {loginTersedia && (
            <a href="/api/telegram/login/start" className="inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
              Hubungkan dengan Telegram
            </a>
          )}
          {loginTersedia && <p className="text-xs text-zinc-400">Alternatif: hubungkan dengan kode manual di bawah.</p>}
          <label className="block text-sm text-zinc-300">Telegram User ID
            <input value={telegramUserId} onChange={(event) => setTelegramUserId(event.target.value.replace(/\D/g, '').slice(0, 24))} inputMode="numeric" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" placeholder="Kirim /id ke bot Stokist" />
          </label>
          {!codeSent ? (
            <button onClick={connect} disabled={busy || !botTersedia || !telegramUserId} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Mengirim kode…' : 'Kirim kode verifikasi'}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-emerald-300">Kode dikirim ke chat bot Stokist. Masukkan kode 6 digit di bawah.</p>
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" placeholder="Kode verifikasi" />
              <button onClick={verify} disabled={busy || code.length !== 6} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memverifikasi…' : 'Verifikasi & hubungkan'}</button>
            </div>
          )}
          {!botTersedia && <p className="text-sm text-amber-300">Token bot Stokist belum dikonfigurasi.</p>}
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>
  )
}
