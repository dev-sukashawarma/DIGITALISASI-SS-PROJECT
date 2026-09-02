'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Radio, VideoOff, X } from 'lucide-react'
import { createLocalAudioTrack, LocalAudioTrack, Room, RoomEvent, Track } from 'livekit-client'
import { createClient } from '@/lib/supabase'

type Credentials = {
  server_url: string
  participant_token: string
  request_id: string
}

async function callCamera(outletId: string, action: 'start' | 'stop', requestId?: string): Promise<Credentials | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi berakhir. Masuk kembali melalui Portal.')
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/livekit-token`, {
    method: 'POST',
    keepalive: action === 'stop',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ outlet_id: outletId, mode: 'viewer', action, ...(requestId ? { request_id: requestId } : {}) }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Permintaan live camera gagal')
  return action === 'start' ? body as Credentials : null
}

export default function CameraViewer({ outletId, outletName, onClose }: {
  outletId: string
  outletName: string
  onClose: () => void
}) {
  const videoHost = useRef<HTMLDivElement>(null)
  const roomRef = useRef<Room | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const stopRequested = useRef(false)
  const stopSent = useRef(false)
  const talkTrackRef = useRef<LocalAudioTrack | null>(null)
  const [phase, setPhase] = useState<'requesting' | 'waiting' | 'playing' | 'error'>('requesting')
  const [error, setError] = useState<string | null>(null)
  const [talking, setTalking] = useState(false)

  const sendStop = useCallback((requestId: string | null) => {
    if (!requestId || stopSent.current) return
    stopSent.current = true
    void callCamera(outletId, 'stop', requestId).catch(() => {
      stopSent.current = false
    })
  }, [outletId])

  const stopStream = useCallback(() => {
    stopRequested.current = true
    sendStop(requestIdRef.current)
  }, [sendStop])

  const close = useCallback(() => {
    stopStream()
    onClose()
  }, [onClose, stopStream])

  const stopTalking = useCallback(() => {
    const track = talkTrackRef.current
    talkTrackRef.current = null
    if (track) {
      roomRef.current?.localParticipant.unpublishTrack(track)
      track.stop()
    }
    setTalking(false)
  }, [])

  const startTalking = useCallback(async () => {
    const room = roomRef.current
    if (!room || phase === 'error' || talkTrackRef.current) return
    try {
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
      await room.localParticipant.publishTrack(track)
      talkTrackRef.current = track
      setTalking(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Mikrofon tidak dapat digunakan')
    }
  }, [phase])

  useEffect(() => {
    let disposed = false
    // adaptiveStream/dynacast off: the POS publishes a single layer, so the only
    // thing they can negotiate is pausing it outright — which shows up as a hitch.
    const room = new Room({ adaptiveStream: false, dynacast: false, stopLocalTrackOnUnpublish: true })
    roomRef.current = room

    const attach = (track: Track) => {
      if (track.kind !== Track.Kind.Video || !videoHost.current) return
      const element = track.attach()
      if (!(element instanceof HTMLVideoElement)) return
      element.autoplay = true
      element.playsInline = true
      element.muted = true
      element.className = 'h-full w-full bg-black object-contain'
      element.style.transform = 'none'
      videoHost.current.replaceChildren(element)
      setPhase('playing')
    }
    const detach = (track: Track) => {
      track.detach().forEach((element) => element.remove())
      if (!disposed && track.kind === Track.Kind.Video) setPhase('waiting')
    }

    room.on(RoomEvent.TrackSubscribed, attach)
    room.on(RoomEvent.TrackUnsubscribed, detach)
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed && phase !== 'error') setPhase('waiting')
    })

    void (async () => {
      try {
        const credentials = await callCamera(outletId, 'start')
        if (!credentials) return
        requestIdRef.current = credentials.request_id
        if (disposed || stopRequested.current) {
          sendStop(credentials.request_id)
          return
        }
        await room.connect(credentials.server_url, credentials.participant_token, { autoSubscribe: true })
        if (!disposed) setPhase('waiting')
      } catch (reason) {
        if (disposed) return
        setError(reason instanceof Error ? reason.message : 'Gagal membuka kamera')
        setPhase('error')
      }
    })()

    return () => {
      disposed = true
      stopTalking()
      room.disconnect()
      roomRef.current = null
      stopStream()
    }
  }, [outletId, sendStop, stopStream, stopTalking])

  useEffect(() => {
    const handlePageHide = () => stopStream()
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [stopStream])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [close])

  useEffect(() => () => stopTalking(), [stopTalking])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`Kamera ${outletName}`}>
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500"><Radio size={13} /> Live sekarang</div>
            <h2 className="truncate text-lg font-extrabold text-slate-900 sm:text-xl">{outletName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 sm:flex"><Radio size={14} />Aktif sampai ditutup</span>
            <button
              onPointerDown={() => void startTalking()}
              onPointerUp={stopTalking}
              onPointerCancel={stopTalking}
              onPointerLeave={stopTalking}
              disabled={phase === 'requesting' || phase === 'error'}
              className={`rounded-xl px-3 py-2 text-xs font-extrabold transition-colors ${talking ? 'bg-rose-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'} disabled:cursor-not-allowed disabled:opacity-50`}
              aria-label="Tekan dan tahan untuk berbicara ke POS"
            >{talking ? 'Berbicara…' : 'Tekan untuk bicara'}</button>
            <button onClick={close} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Tutup kamera"><X size={20} /></button>
          </div>
        </header>

        <div className="relative aspect-video max-h-[76vh] bg-black">
          <div ref={videoHost} className="absolute inset-0" />
          {phase !== 'playing' && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950">
              <div className="max-w-sm px-6 text-center">
                {phase === 'error' ? <VideoOff className="mx-auto mb-4 text-rose-400" size={40} /> : <Loader2 className="mx-auto mb-4 animate-spin text-orange-400" size={40} />}
                <p className="font-extrabold text-white">{phase === 'requesting' ? 'Menghubungkan ke POS…' : phase === 'waiting' ? 'Menunggu kamera POS…' : 'Kamera tidak dapat dibuka'}</p>
                <p className={`mt-2 text-sm leading-relaxed ${phase === 'error' ? 'text-rose-300' : 'text-slate-400'}`}>{error ?? 'Video akan muncul otomatis setelah perangkat outlet mulai publish.'}</p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white shadow-lg"><span className="status-pulse h-2 w-2 rounded-full bg-white" />LIVE</div>
        </div>
      </div>
    </div>
  )
}
