'use client'

import { useEffect, useRef, useState } from 'react'
import { Home, LogOut, Menu, Plus, Send, Trash2, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { pecahTeks } from '@/lib/teks'

type Percakapan = { id: string; judul: string; diperbarui_at: string }
type Pesan = { id: string | number; peran: 'user' | 'bot'; isi: string }

const CEPAT = ['Omzet kemarin berapa?', 'Peringkat outlet minggu ini', 'Menu terlaris bulan ini', 'Laporan pagi hari ini']
const GALAT_UMUM = 'Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.'

function Isi({ isi }: { isi: string }) {
  return (
    <>
      {pecahTeks(isi).map((baris, i) => (
        <p key={i} className="min-h-[1em]">
          {baris.map((s, j) => (s.tebal ? <strong key={j}>{s.teks}</strong> : <span key={j}>{s.teks}</span>))}
        </p>
      ))}
    </>
  )
}

// Pola sama dengan signOut() di @suka/auth AuthProvider: hapus sesi lokal + cookie sb-* (juga di
// domain bersama), lalu kembali ke portal. Batas 1 dtk agar tombol tak menggantung bila jaringan lambat.
async function keluar(portalUrl: string) {
  try {
    await Promise.race([
      createSupabaseBrowserClient().auth.signOut({ scope: 'local' }),
      new Promise((r) => setTimeout(r, 1000)),
    ])
  } catch {}
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0].trim()
    if (!name.startsWith('sb-')) continue
    document.cookie = `${name}=; Max-Age=0; path=/`
    if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
  }
  window.location.href = portalUrl
}

export default function ChatApp({ nama, judulBot, portalUrl }: { nama: string; judulBot: string; portalUrl: string }) {
  const [daftar, setDaftar] = useState<Percakapan[]>([])
  const [aktif, setAktif] = useState<string | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [menunggu, setMenunggu] = useState(false)
  const [laci, setLaci] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const bawah = useRef<HTMLDivElement>(null)

  const muatDaftar = async () => {
    const r = await fetch('/api/percakapan', { cache: 'no-store' })
    if (r.ok) setDaftar((await r.json()).percakapan)
  }
  useEffect(() => { muatDaftar() }, [])
  useEffect(() => { bawah.current?.scrollIntoView({ behavior: 'smooth' }) }, [pesan])

  const buka = async (id: string) => {
    setLaci(false); setGalat(null); setAktif(id); setPesan([])
    const r = await fetch(`/api/percakapan/${id}`, { cache: 'no-store' })
    if (r.ok) setPesan((await r.json()).pesan)
    else setGalat('Gagal memuat percakapan.')
  }
  const baru = () => { setAktif(null); setPesan([]); setLaci(false); setGalat(null) }
  const hapus = async (id: string) => {
    if (!confirm('Hapus percakapan ini?')) return
    await fetch(`/api/percakapan/${id}`, { method: 'DELETE' })
    if (aktif === id) baru()
    muatDaftar()
  }

  const kirim = async (teks: string) => {
    const isi = teks.trim()
    if (!isi || sibuk) return
    setSibuk(true); setMenunggu(true); setGalat(null); setInput('')
    setPesan((p) => [...p, { id: `u${Date.now()}`, peran: 'user', isi }, { id: `b${Date.now()}`, peran: 'bot', isi: '' }])
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: isi, percakapanId: aktif ?? undefined }),
      })
      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b.galat || GALAT_UMUM)
      }
      const id = r.headers.get('X-Percakapan-Id')
      if (id) setAktif(id)
      const pembaca = r.body.getReader()
      const dek = new TextDecoder()
      for (;;) {
        const { value, done } = await pembaca.read()
        if (done) break
        const t = dek.decode(value, { stream: true })
        setMenunggu(false)
        setPesan((p) => {
          const s = [...p]
          s[s.length - 1] = { ...s[s.length - 1], isi: s[s.length - 1].isi + t }
          return s
        })
      }
      muatDaftar()
    } catch (e) {
      setPesan((p) => p.slice(0, -1))
      setGalat((e as Error).message || GALAT_UMUM)
    } finally {
      setSibuk(false); setMenunggu(false)
    }
  }

  return (
    <div className="flex h-dvh">
      <aside className={`${laci ? 'fixed inset-0 z-20 flex' : 'hidden'} w-full flex-col bg-white md:static md:flex md:w-72 md:border-r`}>
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">Percakapan</span>
          <button className="md:hidden" onClick={() => setLaci(false)} aria-label="Tutup"><X size={20} /></button>
        </div>
        <button onClick={baru} className="m-3 flex items-center gap-2 rounded-lg bg-suka-orange px-3 py-2 text-white">
          <Plus size={16} /> Percakapan baru
        </button>
        <ul className="flex-1 overflow-y-auto px-2">
          {daftar.map((d) => (
            <li key={d.id} className={`flex items-center gap-1 rounded-lg px-2 py-2 ${aktif === d.id ? 'bg-suka-cream' : ''}`}>
              <button className="flex-1 truncate text-left text-sm" onClick={() => buka(d.id)}>{d.judul}</button>
              <button onClick={() => hapus(d.id)} aria-label="Hapus" className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </li>
          ))}
          {daftar.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">Belum ada percakapan.</li>}
        </ul>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white p-3">
          <button className="md:hidden" onClick={() => setLaci(true)} aria-label="Daftar percakapan"><Menu size={22} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl text-suka-brown">{judulBot}</h1>
            <p className="truncate text-xs text-gray-500">Halo, {nama}</p>
          </div>
          <a href={portalUrl} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-suka-brown hover:bg-suka-cream" aria-label="Kembali ke portal">
            <Home size={16} /> <span className="hidden sm:inline">Portal</span>
          </a>
          <button
            onClick={() => { if (confirm('Keluar dari akun?')) keluar(portalUrl) }}
            className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            aria-label="Keluar"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </header>

        <section className="flex-1 space-y-3 overflow-y-auto p-4">
          {pesan.length === 0 && (
            <div className="mx-auto max-w-md pt-8 text-center">
              <p className="mb-4 text-sm text-gray-600">Tanya data penjualan Suka Shawarma. Contoh:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CEPAT.map((q) => (
                  <button key={q} onClick={() => kirim(q)} disabled={sibuk} className="rounded-full border border-suka-orange px-3 py-1 text-sm text-suka-brown">{q}</button>
                ))}
              </div>
            </div>
          )}
          {pesan.map((m, i) => (
            <div key={m.id} className={`flex ${m.peran === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.peran === 'user' ? 'bg-suka-orange text-white' : 'bg-white shadow-sm'}`}>
                {m.peran === 'bot' && i === pesan.length - 1 && menunggu ? (
                  <span className="italic text-gray-500">Sedang mengambil data…</span>
                ) : (
                  <Isi isi={m.peran === 'bot' ? m.isi.replace(/^\s+/, '') : m.isi} />
                )}
              </div>
            </div>
          ))}
          {galat && <p className="text-center text-sm text-red-600">{galat}</p>}
          <div ref={bawah} />
        </section>

        <form onSubmit={(e) => { e.preventDefault(); kirim(input) }} className="flex gap-2 border-t bg-white p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Tanya sesuatu…"
            className="flex-1 rounded-full border px-4 py-2 text-sm"
            disabled={sibuk}
          />
          <button type="submit" disabled={sibuk || !input.trim()} className="rounded-full bg-suka-orange p-2 text-white disabled:opacity-50" aria-label="Kirim">
            <Send size={18} />
          </button>
        </form>
      </main>
    </div>
  )
}
