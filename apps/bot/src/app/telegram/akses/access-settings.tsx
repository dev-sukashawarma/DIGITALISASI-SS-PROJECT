'use client'

import { useEffect, useState } from 'react'

type Staff = { id: string; name: string; username: string | null; role: string; allowed: boolean; telegramUserId: string | null }

export default function AccessSettings() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/telegram/access', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Daftar staf gagal dimuat.')
        setStaff(data.staff)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Daftar staf gagal dimuat.'))
  }, [])

  async function changeAccess(row: Staff) {
    setBusy(row.id)
    setError(null)
    try {
      const response = await fetch('/api/telegram/access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: row.id, enabled: !row.allowed }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Akses gagal diubah.')
      setStaff((current) => current.map((item) => item.id === row.id ? { ...item, allowed: !row.allowed } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Akses gagal diubah.')
    } finally {
      setBusy(null)
    }
  }

  const filtered = staff.filter((row) => `${row.name} ${row.username ?? ''} ${row.role}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <section className="mt-6 space-y-4">
      <label className="block text-sm text-zinc-300">Cari staf
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" placeholder="Nama atau role" />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="max-h-[65vh] divide-y divide-zinc-800 overflow-y-auto rounded-lg border border-zinc-800">
        {filtered.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{row.name}</p>
              <p className="text-zinc-400">{row.role}{row.telegramUserId ? ` · Telegram ID ${row.telegramUserId}` : ' · Telegram belum terhubung'}</p>
            </div>
            <button onClick={() => changeAccess(row)} disabled={busy === row.id} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${row.allowed ? 'border border-red-700 text-red-200' : 'bg-cyan-600 text-white'}`}>
              {busy === row.id ? 'Menyimpan…' : row.allowed ? 'Cabut akses' : 'Beri akses'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
