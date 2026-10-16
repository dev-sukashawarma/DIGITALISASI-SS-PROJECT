'use client'

import { useState } from 'react'

type Props = { awalTerhubung: boolean; username: string | null; botTersedia: boolean }

export default function TelegramSettings({ awalTerhubung, username, botTersedia }: Props) {
  const [linked, setLinked] = useState(awalTerhubung)
  const [name, setName] = useState(username)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch('/api/telegram/link', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Status koneksi gagal dimuat.')
    setLinked(!!data.linked)
    setName(data.username ?? null)
    if (data.linked) setUrl(null)
  }

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal membuat tautan.')
      setUrl(data.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat tautan.')
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
      setUrl(null)
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
          <button onClick={connect} disabled={busy || !botTersedia} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Menyiapkan tautan…' : 'Hubungkan Telegram'}
          </button>
          {!botTersedia && <p className="text-sm text-amber-300">Token bot Stokist belum dikonfigurasi.</p>}
          {url && (
            <>
              <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-cyan-700 p-3 text-center text-sm text-cyan-200 hover:bg-cyan-950">
                Buka bot Stokist di Telegram ↗
              </a>
              <button onClick={() => refresh().catch((cause) => setError(cause.message))} className="text-sm text-cyan-300 hover:underline">
                Saya sudah menekan Start — cek koneksi
              </button>
            </>
          )}
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>
  )
}
