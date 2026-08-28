'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
import { Camera, Circle, Loader2, Maximize2, Radio, VideoOff, Wifi, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// Feature flag: preserve the implementation while preventing any LiveKit or
// Supabase camera-session connection during the rollout pause.
const LIVE_CAMERA_ENABLED = false

type Outlet = { id: string; name: string }
type CameraSession = {
  outlet_id: string
  staff_id: string
  room_name: string
  status: 'live' | 'error' | 'stopped'
  started_at: string
  last_heartbeat_at: string
  error_message: string | null
}

type LiveKitCredentials = {
  server_url: string
  participant_token: string
}

const STALE_AFTER_MS = 75_000

function isSessionLive(session: CameraSession) {
  return session.status === 'live' && Date.now() - new Date(session.last_heartbeat_at).getTime() < STALE_AFTER_MS
}

function formatStartedAt(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date(value))
}

async function getViewerCredentials(outletId: string, supabase: ReturnType<typeof createClient>): Promise<LiveKitCredentials> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi admin berakhir. Silakan login kembali.')

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/livekit-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ outlet_id: outletId, mode: 'viewer', action: 'start' }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Gagal membuka live camera')
  return body as LiveKitCredentials
}

function CameraPlayer({ outletId, onClose }: { outletId: string; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [hasVideo, setHasVideo] = useState(false)

  useEffect(() => {
    let disposed = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const attachVideo = (track: Track) => {
      if (track.kind !== Track.Kind.Video || !videoContainerRef.current) return
      const element = track.attach()
      if (!(element instanceof HTMLVideoElement)) return
      element.autoplay = true
      element.playsInline = true
      element.muted = true
      element.className = 'w-full h-full object-cover bg-slate-950'
      // Front-camera frames from the Android publisher are mirrored. Flip
      // them once at the viewer so the admin sees a normal (non-mirrored) feed.
      element.style.transform = 'scaleX(-1)'
      videoContainerRef.current.replaceChildren(element)
      setHasVideo(true)
    }
    room.on(RoomEvent.TrackSubscribed, attachVideo)
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((element) => element.remove())
      if (track.kind === Track.Kind.Video) setHasVideo(false)
    })
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed) setError('Koneksi live camera terputus.')
    })

    void (async () => {
      try {
        const credentials = await getViewerCredentials(outletId, supabase)
        if (disposed) return
        await room.connect(credentials.server_url, credentials.participant_token)
        if (!disposed) setConnecting(false)
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : 'Gagal menyambungkan live camera')
          setConnecting(false)
        }
      }
    })()

    return () => {
      disposed = true
      room.disconnect()
      roomRef.current = null
    }
  }, [outletId, supabase])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Live camera">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-5 py-4">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400"><Radio className="h-4 w-4" /></div>
            <div><p className="text-sm font-extrabold">Live Camera</p><p className="text-[11px] text-slate-400">Streaming real-time · tanpa rekaman</p></div>
          </div>
          <div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />LIVE</span><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Tutup live camera"><X className="h-5 w-5" /></button></div>
        </div>
        <div className="relative aspect-video bg-black">
          <div ref={videoContainerRef} className="absolute inset-0" />
          {connecting && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /><span className="text-xs font-semibold text-slate-400">Menghubungkan ke kamera…</span></div>}
          {error && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-rose-200"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10"><Circle className="h-6 w-6" /></span><p className="max-w-sm text-sm font-semibold">{error}</p></div>}
          {!connecting && !error && !hasVideo && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950 text-center text-slate-400"><VideoOff className="h-7 w-7" /><p className="text-xs font-semibold">Menunggu video dari POS…</p></div>}
        </div>
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3 text-[11px] text-slate-400"><span className="flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5 text-emerald-400" />Koneksi terenkripsi LiveKit</span><span>Tekan × untuk menutup</span></div>
      </div>
    </div>
  )
}

function CameraPreview({ outletId, onOpen }: { outletId: string; onOpen: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const previewRef = useRef<HTMLButtonElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [hasVideo, setHasVideo] = useState(false)
  const [inViewport, setInViewport] = useState(false)

  useEffect(() => {
    const element = previewRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { rootMargin: '200px 0px', threshold: 0.1 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inViewport) {
      setConnected(false)
      setHasVideo(false)
      return
    }
    let disposed = false
    setError(null)
    setHasVideo(false)
    const room = new Room({ adaptiveStream: true, dynacast: true })

    const attachVideo = (track: Track) => {
      if (track.kind !== Track.Kind.Video || !videoContainerRef.current) return
      const element = track.attach()
      if (!(element instanceof HTMLVideoElement)) return
      element.autoplay = true
      element.playsInline = true
      element.muted = true
      element.className = 'h-full w-full object-cover bg-slate-950'
      // Normalize the front-camera orientation for the dashboard viewer.
      element.style.transform = 'scaleX(-1)'
      videoContainerRef.current.replaceChildren(element)
      setHasVideo(true)
    }

    room.on(RoomEvent.TrackSubscribed, attachVideo)
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((element) => element.remove())
      if (track.kind === Track.Kind.Video) setHasVideo(false)
    })
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed) setError('Koneksi terputus')
    })

    void (async () => {
      try {
        const credentials = await getViewerCredentials(outletId, supabase)
        if (disposed) return
        await room.connect(credentials.server_url, credentials.participant_token)
        if (!disposed) setConnected(true)
      } catch {
        if (!disposed) setError('Preview kamera gagal dimuat')
      }
    })()

    return () => {
      disposed = true
      room.disconnect()
    }
  }, [inViewport, outletId, supabase])

  return (
    <button ref={previewRef} type="button" onClick={onOpen} className="group relative block aspect-video w-full overflow-hidden bg-slate-950 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-suka-orange" aria-label="Perbesar live camera">
      <div ref={videoContainerRef} className="absolute inset-0" />
      {!inViewport && <div className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-semibold text-slate-400">Preview aktif saat terlihat</div>}
      {inViewport && !connected && !error && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>}
      {inViewport && connected && !hasVideo && !error && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-slate-950/90 text-center text-[10px] font-semibold text-slate-400"><VideoOff className="h-6 w-6" />Menunggu video dari POS…</div>}
      {error && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-slate-950/90 text-center text-xs font-semibold text-rose-200"><VideoOff className="h-6 w-6" />{error}</div>}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-slate-950/75 to-transparent p-3"><span className="flex items-center gap-1.5 rounded-full bg-rose-500 px-2 py-1 text-[9px] font-black tracking-wider text-white shadow-lg"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span><span className="rounded-lg bg-slate-950/65 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" /></span></div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950/80 to-transparent px-3 pb-3 pt-8 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">Klik untuk tampilan besar</span>
    </button>
  )
}

export default function LiveCameraPanel({ outlets }: { outlets: Outlet[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [sessions, setSessions] = useState<CameraSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from('camera_sessions')
      .select('outlet_id, staff_id, room_name, status, started_at, last_heartbeat_at, error_message')
      .order('last_heartbeat_at', { ascending: false })
    if (error) console.error('Live camera sessions failed to load', error)
    else setSessions((data ?? []) as CameraSession[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!LIVE_CAMERA_ENABLED) {
      setLoading(false)
      return
    }
    void loadSessions()
    const channel = supabase
      .channel(`live-camera-monitor-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camera_sessions' }, loadSessions)
      .subscribe()
    const staleTimer = window.setInterval(() => setSessions((value) => [...value]), 15_000)
    return () => {
      window.clearInterval(staleTimer)
      supabase.removeChannel(channel)
    }
  }, [loadSessions, supabase])

  const outletById = new Map(outlets.map((outlet) => [outlet.id, outlet]))
  const visibleSessions = sessions.filter((session) => outletById.has(session.outlet_id))

  if (!LIVE_CAMERA_ENABLED) return null

  return (
    <section className="space-y-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><Camera className="w-5 h-5 text-suka-orange" /> Live Camera Outlet</h2>
          <p className="text-xs text-slate-500 mt-1">Live stream saja; video tidak disimpan.</p>
        </div>
        <div className="text-xs font-bold text-slate-600">{visibleSessions.filter(isSessionLive).length} kamera aktif</div>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
      ) : visibleSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm font-semibold text-slate-500"><VideoOff className="w-7 h-7 mx-auto mb-2 text-slate-400" />Belum ada kamera POS yang aktif.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleSessions.map((session) => {
            const live = isSessionLive(session)
            return <article key={session.outlet_id} className="group overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-300/40">
              {live ? <CameraPreview outletId={session.outlet_id} onOpen={() => setSelectedOutletId(session.outlet_id)} /> : <div className="aspect-video bg-slate-950 flex items-center justify-center"><Camera className="w-10 h-10 text-slate-600" /></div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Outlet camera</p><h3 className="truncate text-sm font-extrabold text-slate-900">{outletById.get(session.outlet_id)?.name ?? 'Outlet'}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${live ? 'bg-emerald-100 text-emerald-700' : session.status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{live ? 'LIVE' : session.status === 'error' ? 'ERROR' : 'OFFLINE'}</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">Mulai <span className="font-bold text-slate-700">{formatStartedAt(session.started_at)} WIB</span></p><span className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Wifi className="h-3 w-3" />Realtime</span></div>
                {session.error_message && <p className="mt-2 line-clamp-2 text-xs text-rose-600">{session.error_message}</p>}
                <button disabled={!live} onClick={() => setSelectedOutletId(session.outlet_id)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><Maximize2 className="h-3.5 w-3.5" />Buka Live</button>
              </div>
            </article>
          })}
        </div>
      )}
      {selectedOutletId && <CameraPlayer outletId={selectedOutletId} onClose={() => setSelectedOutletId(null)} />}
    </section>
  )
}
