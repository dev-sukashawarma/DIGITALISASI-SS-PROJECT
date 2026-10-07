'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, RotateCcw, X } from 'lucide-react'
import { jakartaDayKey } from '@suka/auth'
import { kirimPesanBotHrd, ambilPesanBotHrd } from '@/app/actions/botHrd'
import { bacaPercakapan, simpanPercakapan, hapusPercakapan } from '@/lib/botHrd/simpanan'

type Pesan = { peran: 'user' | 'assistant'; isi: string }

const SARAN = ['Siapa yang telat hari ini?', 'Siapa yang alpa hari ini?', 'Siapa yang sedang cuti?', 'Ceklist harian hari ini sudah lengkap?']
const PEMBUKA: Pesan = {
  peran: 'assistant',
  isi: 'Halo! Saya Bot HRD. Saya bisa menjawab soal kehadiran, telat, alpa, cuti & izin, kasbon per outlet, dan ceklist harian. Mau tanya apa?',
}

const storage = () => (typeof window === 'undefined' ? null : window.localStorage)

export function PanelBotHrd({ onTutup }: { onTutup: () => void }) {
  const [pesan, setPesan] = useState<Pesan[]>([PEMBUKA])
  const [teks, setTeks] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const percakapanId = useRef<string | null>(null)
  const bawah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = bacaPercakapan(storage(), jakartaDayKey())
    if (!id) return
    percakapanId.current = id
    ambilPesanBotHrd(id).then((r) => {
      if (r.ok && r.pesan.length) setPesan([PEMBUKA, ...r.pesan.map((m) => ({ peran: m.peran, isi: m.isi }))])
    })
  }, [])

  useEffect(() => {
    bawah.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pesan, memuat])

  async function kirim(isi: string) {
    const t = isi.trim()
    if (!t || memuat) return
    setGalat(null)
    setTeks('')
    setPesan((p) => [...p, { peran: 'user', isi: t }])
    setMemuat(true)
    const r = await kirimPesanBotHrd({ pesan: t, percakapanId: percakapanId.current ?? undefined })
    setMemuat(false)
    if (!r.ok) {
      setGalat(r.galat)
      return
    }
    percakapanId.current = r.percakapanId
    simpanPercakapan(storage(), r.percakapanId, jakartaDayKey())
    setPesan((p) => [...p, { peran: 'assistant', isi: r.jawaban }])
  }

  function mulaiBaru() {
    hapusPercakapan(storage())
    percakapanId.current = null
    setPesan([PEMBUKA])
    setGalat(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-[#E8DCCB]">
      <div className="flex items-center justify-between bg-[#4A1713] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Bot HRD</p>
          <p className="text-xs text-white/70">Data absensi, cuti, kasbon & ceklist</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={mulaiBaru} className="rounded-lg p-2 hover:bg-white/10" aria-label="Percakapan baru">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={onTutup} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#FDF9F3] px-4 py-4">
        {pesan.map((m, i) => (
          <div key={i} className={m.peran === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.peran === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-suka-orange px-3 py-2 text-sm text-white'
                  : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-[#2B1B17] shadow-sm'
              }
            >
              {m.isi}
            </div>
          </div>
        ))}
        {pesan.length === 1 && (
          <div className="flex flex-wrap gap-2">
            {SARAN.map((s) => (
              <button key={s} type="button" onClick={() => kirim(s)} className="rounded-full border border-[#E8DCCB] bg-white px-3 py-1.5 text-xs text-[#4A1713] hover:bg-[#F6EDE1]">
                {s}
              </button>
            ))}
          </div>
        )}
        {memuat && (
          <div className="flex items-center gap-2 text-xs text-[#8A766C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Bot HRD sedang mengecek data…
          </div>
        )}
        {galat && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{galat}</p>}
        <div ref={bawah} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          kirim(teks)
        }}
        className="flex items-end gap-2 border-t border-[#E8DCCB] bg-white p-3"
      >
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              kirim(teks)
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Tanya soal absensi…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-[#E8DCCB] bg-[#FDF9F3] px-3 py-2 text-sm outline-none focus:border-suka-orange"
        />
        <button type="submit" disabled={memuat || !teks.trim()} className="rounded-xl bg-suka-orange p-2.5 text-white disabled:opacity-40" aria-label="Kirim">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
