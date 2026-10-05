'use client'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Settings } from 'lucide-react'
import type { Pose } from './AvatarSukaBot'
import { ambilPesan, ambilRekap, kirimPesan, perbaruiRekap, type Rekap } from './api'

type Pesan = { peran: 'user' | 'assistant'; isi: string }

const jam = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// Percakapan berlanjut walau panel ditutup / halaman dimuat ulang, selama hari yang sama (WIB).
// Server juga menolak melanjutkan percakapan dari hari lain.
const KUNCI_PERCAKAPAN = 'sukaBot.percakapan'
const hariIniWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
function bacaPercakapan(): string | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_PERCAKAPAN) || 'null')
    return v && v.tanggal === hariIniWib() && typeof v.id === 'string' ? v.id : undefined
  } catch { return undefined }
}
function simpanPercakapan(id: string | undefined) {
  try {
    if (id) localStorage.setItem(KUNCI_PERCAKAPAN, JSON.stringify({ id, tanggal: hariIniWib() }))
    else localStorage.removeItem(KUNCI_PERCAKAPAN)
  } catch { /* abaikan */ }
}

export default function PanelSukaBot({ apiBase, penuh = false, onRekap, onPose, ukuran, setelan }: {
  apiBase: string
  penuh?: boolean
  onRekap?: (r: Rekap) => void
  /** Pose chef mengikuti keadaan panel (berpikir saat menunggu, bingung saat galat). */
  onPose?: (pose: Pose) => void
  /** Ukuran dari widget (panel melayang di samping chef). */
  ukuran?: { w: number; h: number }
  /** Isi layar setelan (ikon roda gigi hanya tampil bila diisi). JSX.Element, bukan ReactNode: lihat catatan tipe di SukaBotWidget.tsx. */
  setelan?: JSX.Element
}) {
  const [rekap, setRekap] = useState<Rekap | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [pose, setPose] = useState<Pose>('rekap')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [lihatSetelan, setLihatSetelan] = useState(false)
  const percakapanId = useRef<string | undefined>(undefined)
  const bawah = useRef<HTMLDivElement>(null)

  useEffect(() => { onPose?.(pose) }, [pose, onPose])

  useEffect(() => {
    setSibuk(true)
    ambilRekap(apiBase)
      .then(({ rekap }) => { setRekap(rekap); onRekap?.(rekap) })
      .catch((e) => { setGalat(e.message); setPose('bingung') })
      .finally(() => setSibuk(false))
  }, [apiBase, onRekap])

  // Muat ulang percakapan hari ini (bila ada). Rekap tidak ditampilkan ulang dari riwayat —
  // sudah tampil sebagai kartu di atas.
  useEffect(() => {
    const id = bacaPercakapan()
    if (!id) return
    percakapanId.current = id
    ambilPesan(apiBase, id)
      .then(({ pesan }) => setPesan(pesan.filter((m) => m.jenis !== 'rekap').map((m) => ({ peran: m.peran, isi: m.isi }))))
      .catch(() => { percakapanId.current = undefined; simpanPercakapan(undefined) })
  }, [apiBase])

  useEffect(() => { bawah.current?.scrollIntoView({ behavior: 'smooth' }) }, [pesan, rekap])

  function mulaiBaru() {
    percakapanId.current = undefined
    simpanPercakapan(undefined)
    setPesan([])
    setGalat(null)
    setPose('rekap')
  }

  async function kirim() {
    const teks = input.trim()
    if (!teks || sibuk) return
    setInput('')
    setGalat(null)
    setPesan((p) => [...p, { peran: 'user', isi: teks }])
    setSibuk(true)
    setPose('berpikir')
    try {
      const r = await kirimPesan(apiBase, teks, percakapanId.current)
      percakapanId.current = r.percakapanId
      simpanPercakapan(r.percakapanId)
      setPesan((p) => [...p, { peran: 'assistant', isi: r.jawaban }])
      setPose('diam')
    } catch (e: any) {
      setGalat(e.message)
      setPose('bingung')
    } finally {
      setSibuk(false)
    }
  }

  async function perbarui() {
    if (!rekap || sibuk) return
    setSibuk(true)
    try {
      const { rekap: baru } = await perbaruiRekap(apiBase, rekap.tanggal)
      setRekap(baru)
      onRekap?.(baru)
      // Percakapan lama berisi rekap versi lama; mulai baru agar AI membaca angka terbaru.
      mulaiBaru()
    } catch (e: any) {
      setGalat(e.message)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div
      style={ukuran ? { width: ukuran.w, height: ukuran.h } : undefined}
      className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-suka-orange/20 overflow-hidden ${penuh ? 'h-[calc(100vh-8rem)]' : ukuran ? '' : 'w-[min(24rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-7rem))]'}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-suka-ink text-white">
        <div className="flex-1">
          <p className="font-bold leading-tight">SUKA Bot</p>
          <p className="text-xs opacity-75">{sibuk ? 'Lagi mikir…' : 'Siap bantu, Bos'}</p>
        </div>
        {pesan.length > 0 && (
          <button onClick={mulaiBaru} disabled={sibuk} className="text-xs font-semibold rounded-full border border-white/40 px-3 py-1 hover:bg-white/10 disabled:opacity-40">
            Percakapan baru
          </button>
        )}
        {setelan && (
          <button
            type="button"
            onClick={() => setLihatSetelan((v) => !v)}
            aria-label={lihatSetelan ? 'Kembali ke chat' : 'Setelan SUKA Bot'}
            aria-pressed={lihatSetelan}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            {lihatSetelan ? <MessageCircle size={18} /> : <Settings size={18} />}
          </button>
        )}
      </div>

      {lihatSetelan && setelan ? setelan : (<>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {rekap && (
          <div className="bg-amber-50 border border-suka-orange/30 rounded-xl p-3">
            <p className="whitespace-pre-wrap text-suka-ink">{rekap.teks}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Dibuat {jam(rekap.dibuat_at)} WIB{rekap.versi > 1 ? ` · versi ${rekap.versi}` : ''}</span>
              <button onClick={perbarui} disabled={sibuk} className="text-suka-orange font-semibold disabled:opacity-40">Perbarui rekap</button>
            </div>
          </div>
        )}
        {pesan.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${m.peran === 'user' ? 'ml-auto bg-suka-orange text-white' : 'bg-gray-100 text-suka-ink'}`}>
            {m.isi}
          </div>
        ))}
        {galat && <p className="text-red-600 text-xs">{galat}</p>}
        <div ref={bawah} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); kirim() }} className="flex gap-2 p-3 border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Tanya omzet, ranking outlet, stok bahan…"
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-suka-orange"
        />
        <button type="submit" disabled={sibuk || !input.trim()} className="rounded-full bg-suka-orange text-white px-4 text-sm font-semibold disabled:opacity-40">
          Kirim
        </button>
      </form>
      </>)}
    </div>
  )
}
