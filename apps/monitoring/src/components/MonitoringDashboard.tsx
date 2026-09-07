'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, LogOut, MapPin, MonitorDot, Radio, Search, ShieldCheck, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { portalUrl } from '@/lib/portal'

const CameraViewer = dynamic(() => import('./CameraViewer'), { ssr: false })

type Outlet = { id: string; name: string }
type StreamRequest = {
  outlet_id: string
  request_id: string
  status: 'requested' | 'streaming' | 'stopped' | 'expired' | 'error'
  expires_at: string | null
  error_message: string | null
}

function isActive(request?: StreamRequest) {
  return !!request && ['requested', 'streaming'].includes(request.status)
}

export default function MonitoringDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [requests, setRequests] = useState<Record<string, StreamRequest>>({})
  const [selected, setSelected] = useState<Outlet | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadInitial = useCallback(async () => {
    const [outletsResult, requestsResult] = await Promise.all([
      supabase.from('outlets').select('id, name').order('name'),
      supabase.from('camera_stream_requests').select('outlet_id, request_id, status, expires_at, error_message'),
    ])
    if (outletsResult.error) console.error('outlets', outletsResult.error)
    if (requestsResult.error) console.error('camera requests', requestsResult.error)
    setOutlets((outletsResult.data ?? []) as Outlet[])
    setRequests(Object.fromEntries(((requestsResult.data ?? []) as StreamRequest[]).map((item) => [item.outlet_id, item])))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadInitial()
    const channel = supabase.channel(`monitoring-requests-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camera_stream_requests' }, (payload) => {
        const row = (payload.new ?? payload.old) as StreamRequest
        if (!row?.outlet_id) return
        setRequests((current) => ({ ...current, [row.outlet_id]: row }))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadInitial, supabase])

  const filtered = outlets.filter((outlet) => outlet.name.toLowerCase().includes(query.trim().toLowerCase()))
  const activeCount = Object.values(requests).filter(isActive).length

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = portalUrl()
  }

  return (
    <main className="monitor-grid min-h-screen px-4 py-6 sm:px-8 sm:py-9 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-10 flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600"><MonitorDot size={24} /></div>
            <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500"><ShieldCheck size={12} /> Suka Operations</div><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Live monitor</h1><p className="mt-1 text-sm text-slate-500">Buka kamera hanya saat diperlukan. Tidak ada rekaman.</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5"><p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Sedang ditonton</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{activeCount}<span className="ml-1 text-xs font-semibold text-slate-400">/ 4</span></p></div>
            <Link href="/lokasi" className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors duration-200 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"><MapPin size={16} />Peta staff</Link>
            <button onClick={logout} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Keluar"><LogOut size={18} /></button>
          </div>
        </header>

        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Outlet</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Pilih kamera yang ingin dilihat</h2></div>
          <label className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-400 shadow-sm sm:max-w-sm"><Search size={17} /><input aria-label="Cari outlet" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" placeholder="Cari outlet" /></label>
        </section>

        {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-[24px] bg-white/5" />)}</div> :
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((outlet, index) => {
              const request = requests[outlet.id]
              const active = isActive(request)
              const streaming = active && request?.status === 'streaming'
              return <article key={outlet.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Camera size={20} /></div><span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider ${streaming ? 'bg-rose-50 text-rose-600' : active ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${streaming ? 'status-pulse bg-rose-500' : active ? 'bg-amber-500' : 'bg-emerald-500'}`} />{streaming ? 'LIVE' : active ? 'MENYIAPKAN' : 'SIAP'}</span></div>
                <div className="mt-5"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Outlet {String(index + 1).padStart(2, '0')}</p><h3 className="mt-1 truncate text-base font-extrabold text-slate-900">{outlet.name}</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">360p · 30 FPS · tanpa audio</p></div>
                <button onClick={() => setSelected(outlet)} disabled={active && selected?.id !== outlet.id} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white transition-colors duration-200 hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300"><Video size={15} />{streaming ? 'Sedang ditonton' : active ? 'Menyiapkan kamera' : 'Lihat kamera'}</button>
              </article>
            })}
          </div>}

        {!loading && filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm font-medium text-slate-500"><Radio className="mx-auto mb-3" />Outlet tidak ditemukan.</div>}
      </div>
      {selected && <CameraViewer outletId={selected.id} outletName={selected.name} onClose={() => setSelected(null)} />}
    </main>
  )
}
