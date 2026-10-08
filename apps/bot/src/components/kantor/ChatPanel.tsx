'use client'
// Panel chat satu bot di dalam Kantor Bot (spec §10). Riwayat & percakapan baru per profil.
import { useEffect, useRef, useState } from 'react'
import { History, Plus, Send, Trash2 } from 'lucide-react'
import { pecahTeks } from '@/lib/teks'
import type { Profil } from '@/lib/peran'

type Percakapan = { id: string; judul: string; diperbarui_at: string }
type Pesan = { id: string | number; peran: 'user' | 'bot'; isi: string }

const CEPAT: Record<Profil, string[]> = {
  ceo: ['Omzet kemarin berapa?', 'Peringkat outlet minggu ini', 'Menu terlaris bulan ini', 'Laporan pagi hari ini'],
  hrd: ['Siapa yang belum absen hari ini?', 'Cuti & izin minggu ini', 'Rekap keterlambatan bulan ini'],
  gudang: ['Bahan yang hampir habis', 'Kiriman hari ini'],
  finance: ['Utang supplier jatuh tempo', 'Pengeluaran bulan ini', 'Setoran kas minggu ini', 'Selisih kasir kemarin'],
}
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

export default function ChatPanel({ profil }: { profil: Profil }) {
  const [daftar, setDaftar] = useState<Percakapan[]>([])
  const [aktif, setAktif] = useState<string | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [menunggu, setMenunggu] = useState(false)
  const [riwayat, setRiwayat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const bawah = useRef<HTMLDivElement>(null)

  const muatDaftar = async () => {
    const r = await fetch(`/api/percakapan?profil=${profil}`, { cache: 'no-store' })
    if (r.ok) setDaftar((await r.json()).percakapan)
  }
  useEffect(() => { muatDaftar() }, [profil])
  useEffect(() => { bawah.current?.scrollIntoView({ behavior: 'smooth' }) }, [pesan])

  const buka = async (id: string) => {
    setRiwayat(false); setGalat(null); setAktif(id); setPesan([])
    const r = await fetch(`/api/percakapan/${id}`, { cache: 'no-store' })
    if (r.ok) setPesan((await r.json()).pesan)
    else setGalat('Gagal memuat percakapan.')
  }
  const baru = () => { setAktif(null); setPesan([]); setRiwayat(false); setGalat(null) }
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
        body: JSON.stringify({ pesan: isi, profil, percakapanId: aktif ?? undefined }),
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button onClick={() => setRiwayat((x) => !x)} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-suka-brown hover:bg-suka-cream" aria-expanded={riwayat}>
          <History size={14} /> Riwayat
        </button>
        <button onClick={baru} className="flex items-center gap-1 rounded-lg bg-suka-orange px-2 py-1 text-xs text-white">
          <Plus size={14} /> Percakapan baru
        </button>
      </div>

      {riwayat && (
        <ul className="absolute inset-x-0 top-[41px] z-10 max-h-[60%] overflow-y-auto border-b bg-white px-2 py-1 shadow">
          {daftar.map((d) => (
            <li key={d.id} className={`flex items-center gap-1 rounded-lg px-2 py-2 ${aktif === d.id ? 'bg-suka-cream' : ''}`}>
              <button className="flex-1 truncate text-left text-sm" onClick={() => buka(d.id)}>{d.judul}</button>
              <button onClick={() => hapus(d.id)} aria-label="Hapus" className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </li>
          ))}
          {daftar.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">Belum ada percakapan.</li>}
        </ul>
      )}

      <section className="flex-1 space-y-3 overflow-y-auto p-3">
        {pesan.length === 0 && (
          <div className="pt-6 text-center">
            <p className="mb-3 text-sm text-gray-600">Contoh pertanyaan:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {CEPAT[profil].map((q) => (
                <button key={q} onClick={() => kirim(q)} disabled={sibuk} className="rounded-full border border-suka-orange px-3 py-1 text-sm text-suka-brown">{q}</button>
              ))}
            </div>
          </div>
        )}
        {pesan.map((m, i) => (
          <div key={m.id} className={`flex ${m.peran === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.peran === 'user' ? 'bg-suka-orange text-white' : 'bg-suka-cream'}`}>
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

      <form onSubmit={(e) => { e.preventDefault(); kirim(input) }} className="flex gap-2 border-t p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Tanya sesuatu…"
          className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm"
          disabled={sibuk}
        />
        <button type="submit" disabled={sibuk || !input.trim()} className="rounded-full bg-suka-orange p-2 text-white disabled:opacity-50" aria-label="Kirim">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
