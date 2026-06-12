'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import jsQR from 'jsqr'
import { createClient } from '@/lib/supabase'

export function QRScanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const animFrameRef = useRef<number | null>(null)

  const navigateToVerifikasi = async (code: string) => {
    // Stop scan loop immediately to prevent double-navigation race condition
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = null

    const cleanedCode = code.trim().toUpperCase()

    const supabase = createClient()
    const { data, error } = await supabase
      .from('surat_jalan')
      .select('id, status')
      .eq('verification_code', cleanedCode)
      .single()

    if (error || !data) {
      setError(`Kode verifikasi "${cleanedCode}" tidak ditemukan`)
      return
    }
    if (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian' || data.status === 'selesai' || data.status === 'diterima') {
      setError('Surat Jalan ini sudah diterima/diverifikasi sebelumnya')
      return
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`unlocked_verification_${data.id}`, 'true')
    }
    stopCamera()
    router.push(`/distribusi/terima/${data.id}`)
  }

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const startCamera = async () => {
    // getUserMedia butuh secure context (HTTPS / localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera. Gunakan kode manual di bawah.')
      setCameraAvailable(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // Pakai BarcodeDetector (Chrome/Android) kalau ada; selain itu fallback jsQR.
      if ('BarcodeDetector' in window) {
        // @ts-ignore — BarcodeDetector not in TS lib yet
        detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
      } else {
        detectorRef.current = null
      }
      scanLoop()
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Izin kamera ditolak. Aktifkan izin kamera atau gunakan kode manual.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan pada perangkat ini. Gunakan kode manual.')
      } else {
        setError('Kamera tidak bisa dibuka. Gunakan kode manual di bawah.')
      }
      setCameraAvailable(false)
    }
  }

  const scanLoop = () => {
    const video = videoRef.current
    if (!video) return

    // Jalur 1: BarcodeDetector native
    if (detectorRef.current) {
      detectorRef.current
        .detect(video)
        .then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            navigateToVerifikasi(barcodes[0].rawValue)
          } else {
            animFrameRef.current = requestAnimationFrame(scanLoop)
          }
        })
        .catch(() => {
          animFrameRef.current = requestAnimationFrame(scanLoop)
        })
      return
    }

    // Jalur 2: fallback jsQR (decode frame via canvas)
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (result?.data) {
          navigateToVerifikasi(result.data)
          return
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(scanLoop)
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    setError(null)
    navigateToVerifikasi(manualInput.trim())
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/distribusi/terima" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Inbox">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Scan QR Surat Jalan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-4 max-w-lg mx-auto space-y-4 mt-2">
        <p className="text-[#544437]/70 text-xs font-semibold px-1">
          Arahkan kamera ke QR code di Surat Jalan fisik untuk memverifikasi.
        </p>

        {cameraAvailable ? (
          <div className="rounded-2xl overflow-hidden border border-[#d9c2b2]/45 bg-black aspect-square shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          </div>
        ) : (
          <div className="rounded-2xl border border-[#d9c2b2]/45 p-8 text-center bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-2xl">📷</span>
            <p className="text-[#544437]/60 text-xs font-bold mt-2">Kamera tidak tersedia di browser ini</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
            <span>🚨</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-[#d9c2b2]/45 p-5 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label className="text-[10px] font-bold text-[#544437]/60 uppercase tracking-wider pl-1 block">Atau masukkan kode verifikasi manual:</label>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Contoh: A3F9D2"
              className="w-full px-4 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm uppercase"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white transition-all rounded-xl font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 cursor-pointer mt-1"
            >
              Cari Surat Jalan
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
