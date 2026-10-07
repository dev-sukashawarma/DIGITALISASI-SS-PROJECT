'use client'
// Kantor Bot: satu layar — kantor pixel-art + panel chat bot terpilih (spec §5, §10).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Home, LogOut, X } from 'lucide-react'
import { muatAset } from '@/kantor/muatAset'
import { tempatkan, rencanaSinkron, type Penempatan } from '@/kantor/peta'
import type { MejaKantor, Keadaan } from '@/kantor/keadaan'
import { LABEL_PROFIL } from '@/lib/peran'
import { keluar } from '@/lib/keluar'
import { OfficeState } from '@/kantor/engine/office/engine/officeState'
import { renderFrame } from '@/kantor/engine/office/engine/renderer'
import { startGameLoop } from '@/kantor/engine/office/engine/gameLoop'
import { migrateLayoutColors } from '@/kantor/engine/office/layout/layoutSerializer'
import { TILE_SIZE } from '@/kantor/engine/office/types'
import ChatPanel from '@/components/kantor/ChatPanel'

const POLL_MS = 10_000
const BASE_ASET = '/kantor/assets/'
const LABEL: Record<Keadaan, string> = { bekerja: 'Bekerja', siaga: 'Siaga', galat: 'Ada masalah', tidur: 'Tidur' }
const WARNA: Record<Keadaan, string> = {
  bekerja: 'bg-suka-green text-white', siaga: 'bg-white text-suka-brown',
  galat: 'bg-red-600 text-white', tidur: 'bg-gray-200 text-gray-700',
}

type Label = { agentId: number; x: number; y: number; meja: MejaKantor }

function terapkanKeadaan(os: OfficeState, p: Penempatan<MejaKantor>) {
  const { agentId: id, meja } = p
  os.setAgentActive(id, meja.keadaan === 'bekerja')
  os.setAgentTool(id, meja.keadaan === 'bekerja' ? meja.alatTerakhir : null)
  if (meja.keadaan === 'galat') os.showPermissionBubble(id)
  else os.clearPermissionBubble(id)
}

export default function KantorApp({ nama, layarPenuh, portalUrl }: { nama: string; layarPenuh: boolean; portalUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const osRef = useRef<OfficeState | null>(null)
  const jumlahPaletRef = useRef(0)
  const offsetRef = useRef({ x: 0, y: 0, zoom: 1 })
  const penempatanRef = useRef<Penempatan<MejaKantor>[]>([])
  const [mesinSiap, setMesinSiap] = useState(false)
  const [asetGagal, setAsetGagal] = useState(false)
  const [meja, setMeja] = useState<MejaKantor[] | null>(null)
  const [diLuar, setDiLuar] = useState<MejaKantor[]>([])
  const [diambilAt, setDiambilAt] = useState<string | null>(null)
  const [pollingGagal, setPollingGagal] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [terpilih, setTerpilih] = useState<string | null>(null)

  // 1) Muat aset + engine sekali.
  useEffect(() => {
    let batal = false
    muatAset(BASE_ASET)
      .then(({ layout, jumlahKarakter }) => {
        if (batal) return
        osRef.current = new OfficeState(migrateLayoutColors(layout as never))
        jumlahPaletRef.current = jumlahKarakter
        setMesinSiap(true)
      })
      .catch(() => { if (!batal) setAsetGagal(true) })
    return () => { batal = true }
  }, [])

  // 2) Polling status (dijeda saat tab tersembunyi).
  const muatStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/kantor/status', { cache: 'no-store' })
      if (r.status === 401) { window.location.href = portalUrl; return }
      if (r.status === 403) { window.location.reload(); return }
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { diambilAt: string; meja: MejaKantor[] }
      setMeja(j.meja)
      setDiambilAt(j.diambilAt)
      setPollingGagal(false)
    } catch {
      setPollingGagal(true) // keadaan terakhir dipertahankan
    }
  }, [portalUrl])

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const mulai = () => { if (!t) { void muatStatus(); t = setInterval(muatStatus, POLL_MS) } }
    const henti = () => { if (t) { clearInterval(t); t = null } }
    const onVis = () => (document.hidden ? henti() : mulai())
    if (!document.hidden) mulai()
    document.addEventListener('visibilitychange', onVis)
    return () => { henti(); document.removeEventListener('visibilitychange', onVis) }
  }, [muatStatus])

  // 3) Sinkron meja → engine.
  useEffect(() => {
    const os = osRef.current
    if (!os || !meja) return
    const { diKantor, diLuar: luar } = tempatkan(meja, os.seats.size, jumlahPaletRef.current)
    const { tambah, hapus } = rencanaSinkron([...os.characters.keys()], diKantor)
    for (const id of hapus) os.removeAgent(id)
    for (const p of tambah) os.addAgent(p.agentId, p.palet, undefined, undefined, true)
    for (const p of diKantor) terapkanKeadaan(os, p)
    penempatanRef.current = diKantor
    setDiLuar(luar)
  }, [meja, mesinSiap])

  // 4) Game loop + render + posisi kartu nama.
  useEffect(() => {
    const canvas = canvasRef.current
    const os = osRef.current
    if (!canvas || !os || !mesinSiap) return
    let bingkai = 0
    const stop = startGameLoop(canvas, {
      update: (dt) => os.update(dt),
      render: (ctx) => {
        const dpr = window.devicePixelRatio || 1
        const w = Math.floor(canvas.clientWidth * dpr)
        const h = Math.floor(canvas.clientHeight * dpr)
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        const layout = os.getLayout()
        const zoom = Math.max(1, Math.floor(Math.min(w / (layout.cols * TILE_SIZE), h / (layout.rows * TILE_SIZE))))
        const { offsetX, offsetY } = renderFrame(
          ctx, w, h, os.tileMap, os.furniture, os.getCharacters(), zoom, 0, 0,
          { selectedAgentId: os.selectedAgentId, hoveredAgentId: os.hoveredAgentId, hoveredTile: os.hoveredTile, seats: os.seats, characters: os.characters },
          undefined, layout.tileColors, layout.cols, layout.rows, layout.carpetTiles, layout.areas, layout.areaTiles, false, null, os.pets,
        )
        offsetRef.current = { x: offsetX, y: offsetY, zoom }
        if (++bingkai % 6 === 0) {
          setLabels(penempatanRef.current.flatMap((p) => {
            const ch = os.characters.get(p.agentId)
            if (!ch) return []
            return [{ agentId: p.agentId, meja: p.meja, x: (offsetX + ch.x * zoom) / dpr, y: (offsetY + (ch.y - 30) * zoom) / dpr }]
          }))
        }
      },
    })
    return stop
  }, [mesinSiap])

  const pilih = (id: string | null) => {
    const os = osRef.current
    const p = penempatanRef.current.find((q) => q.meja.id === id)
    if (os) os.selectedAgentId = p ? p.agentId : null
    setTerpilih(id)
  }

  const klikKanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const os = osRef.current
    const canvas = canvasRef.current
    if (!os || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const { x, y, zoom } = offsetRef.current
    const wx = ((e.clientX - rect.left) * dpr - x) / zoom
    const wy = ((e.clientY - rect.top) * dpr - y) / zoom
    const id = os.getCharacterAt(wx, wy)
    const p = penempatanRef.current.find((q) => q.agentId === id)
    pilih(p ? p.meja.id : null)
  }

  const jam = diambilAt ? new Date(diambilAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : null
  const semua = meja ?? []
  const mejaTerpilih = semua.find((m) => m.id === terpilih) ?? null

  return (
    <main className="flex h-dvh flex-col bg-suka-cream">
      {!layarPenuh && (
        <header className="flex items-center gap-3 border-b bg-white p-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl text-suka-brown">Kantor Bot</h1>
            <p className="truncate text-xs text-gray-500">Halo, {nama} — klik bot untuk mengobrol</p>
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
      )}
      {pollingGagal && (
        <div role="status" className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
          Data terakhir {jam ?? '—'} — mencoba lagi
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {asetGagal ? (
            <section className="flex-1 overflow-auto p-4">
              <p className="mb-3 text-sm text-gray-600">Gambar kantor gagal dimuat. Status bot:</p>
              <DaftarMeja meja={semua} terpilih={terpilih} onPilih={pilih} />
            </section>
          ) : (
            <section className="relative min-h-0 flex-1">
              <canvas ref={canvasRef} onClick={klikKanvas} className="h-full w-full cursor-pointer [image-rendering:pixelated]" />
              <div className="pointer-events-none absolute inset-0 hidden md:block">
                {labels.map((l) => (
                  <div key={l.agentId} style={{ left: l.x, top: l.y }}
                    className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-2 py-0.5 text-xs shadow ${WARNA[l.meja.keadaan]} ${terpilih === l.meja.id ? 'ring-2 ring-suka-orange' : ''}`}>
                    {l.meja.keadaan === 'galat' && '! '}{l.meja.nama}
                    {l.meja.keadaan === 'tidur' && ' z z'}
                    {l.meja.keadaan === 'bekerja' && l.meja.alatTerakhir && <span className="opacity-80"> · {l.meja.alatTerakhir}</span>}
                  </div>
                ))}
              </div>
              {meja && semua.length === 0 && (
                <p className="absolute inset-x-0 top-4 text-center text-sm text-gray-600">Belum ada bot aktif</p>
              )}
            </section>
          )}
          {!asetGagal && (
            <section className="border-t bg-white p-3 md:hidden">
              <DaftarMeja meja={semua} terpilih={terpilih} onPilih={pilih} />
            </section>
          )}
          {!asetGagal && diLuar.length > 0 && (
            <section className="hidden border-t bg-white p-3 md:block">
              <p className="mb-2 text-xs text-gray-600">Di luar kantor (kursi penuh):</p>
              <DaftarMeja meja={diLuar} terpilih={terpilih} onPilih={pilih} />
            </section>
          )}
        </div>

        {mejaTerpilih && (
          <aside
            aria-label={`Panel ${mejaTerpilih.nama}`}
            className="fixed inset-x-0 bottom-0 z-30 flex h-[80dvh] flex-col rounded-t-2xl border-t bg-white shadow-2xl md:static md:z-auto md:h-auto md:w-[420px] md:rounded-none md:border-l md:border-t-0 md:shadow-none"
          >
            <div className="flex items-center gap-2 border-b p-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg text-suka-brown">
                  {mejaTerpilih.profil ? LABEL_PROFIL[mejaTerpilih.profil] : mejaTerpilih.nama}
                </h2>
                <p className="truncate text-xs text-gray-500">{mejaTerpilih.nama} · {mejaTerpilih.scope.join(', ')}</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs ${WARNA[mejaTerpilih.keadaan]}`}>{LABEL[mejaTerpilih.keadaan]}</span>
              <button onClick={() => pilih(null)} aria-label="Tutup panel" className="text-gray-500 hover:text-suka-brown"><X size={20} /></button>
            </div>
            {mejaTerpilih.bolehChat && mejaTerpilih.profil ? (
              <ChatPanel key={mejaTerpilih.profil} profil={mejaTerpilih.profil} />
            ) : (
              <div className="space-y-2 p-4 text-sm text-gray-700">
                {mejaTerpilih.alatTerakhir && <p>Terakhir memakai: <strong>{mejaTerpilih.alatTerakhir}</strong></p>}
                <p className="text-gray-500">Bot ini belum dibuka untuk akun Anda.</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  )
}

function DaftarMeja({ meja, terpilih, onPilih }: { meja: MejaKantor[]; terpilih: string | null; onPilih: (id: string) => void }) {
  return (
    <ul className="space-y-1">
      {meja.map((m) => (
        <li key={m.id}>
          <button onClick={() => onPilih(m.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-suka-cream ${terpilih === m.id ? 'bg-suka-cream' : ''}`}>
            <span className={`rounded px-2 py-0.5 text-xs ${WARNA[m.keadaan]}`}>{LABEL[m.keadaan]}</span>
            <span className="font-medium">{m.nama}</span>
            {m.keadaan === 'bekerja' && m.alatTerakhir && <span className="truncate text-gray-500">· {m.alatTerakhir}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
