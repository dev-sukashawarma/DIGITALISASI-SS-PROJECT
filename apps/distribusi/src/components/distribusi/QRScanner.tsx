'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import jsQR from 'jsqr'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { ArrowLeft, QrCode, Camera, AlertCircle, Sparkles, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

export function QRScanner() {
  const router = useRouter()
  const { outletStaff } = useAuth()
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

    let cleanedCode = code.trim()

    // Trigger subtle haptic feedback if supported on mobile
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80)
      } catch (e) {
        // ignore vibrate error
      }
    }

    // Jika hasil scan berupa URL (misal scan QR dari device/app lain), ekstrak ID di bagian akhir
    if (cleanedCode.includes('/')) {
      const parts = cleanedCode.split('/')
      cleanedCode = parts[parts.length - 1]
    }

    const isUUID = cleanedCode.length === 36 && cleanedCode.includes('-')
    const finalCode = isUUID ? cleanedCode.toLowerCase() : cleanedCode.toUpperCase()
    const column = isUUID ? 'id' : 'verification_code'

    const supabase = createSupabaseBrowserClient()
    const { data, error: fetchErr } = await supabase
      .from('surat_jalan')
      .select('id, status, document_number')
      .eq(column, finalCode)
      .single()

    if (fetchErr || !data) {
      const errMsg = `Kode verifikasi "${finalCode}" tidak ditemukan di database`
      setError(errMsg)
      toast.error(errMsg)
      return
    }
    if (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian' || data.status === 'selesai' || data.status === 'diterima') {
      const msg = 'Surat Jalan ini sudah selesai diverifikasi sebelumnya'
      setError(msg)
      toast.warning(msg)
      return
    }

    toast.success(`Surat Jalan ${data.document_number || ''} terverifikasi!`)

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`unlocked_verification_${data.id}`, 'true')
      localStorage.setItem(`unlocked_verification_${data.id}`, 'true')
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
      setError('Browser tidak mendukung akses kamera. Silakan gunakan input kode manual di bawah.')
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
        setError('Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser atau gunakan kode manual.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan pada perangkat ini. Silakan ketik kode verifikasi manual.')
      } else {
        setError('Kamera tidak bisa dibuka. Gunakan kode verifikasi manual di bawah.')
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
    if (!manualInput.trim()) {
      toast.warning('Ketik kode verifikasi terlebih dahulu')
      return
    }
    setError(null)
    navigateToVerifikasi(manualInput.trim())
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-24 relative overflow-hidden bg-grain select-none">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex justify-between items-center shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/distribusi/terima"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Pindai QR Surat Jalan
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? 'Outlet'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-md mx-auto space-y-4 mt-2 relative z-10">
        <div className="bg-white/80 backdrop-blur-md border border-suka-orange/15 p-4 rounded-2xl shadow-sm text-center space-y-1">
          <p className="text-xs font-black text-suka-ink uppercase tracking-wide">
            Arahkan Kamera ke Lembar Surat Jalan
          </p>
          <p className="text-[10px] text-suka-gray-500 font-semibold">
            Pindai kode QR yang tercetak pada dokumen fisik yang dibawa oleh kurir/supir.
          </p>
        </div>

        {/* Viewfinder Camera Box with Target Laser Animation */}
        {cameraAvailable ? (
          <div className="relative rounded-3xl overflow-hidden border-2 border-suka-orange/30 bg-black aspect-square shadow-xl flex items-center justify-center group">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

            {/* Target Crosshair Corners */}
            <div className="absolute inset-8 pointer-events-none flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-suka-orange rounded-tl-xl shadow-sm" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-suka-orange rounded-tr-xl shadow-sm" />
              </div>

              {/* Center animated laser scanner */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-suka-orange to-transparent animate-pulse shadow-[0_0_12px_#f29744]" />

              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-suka-orange rounded-bl-xl shadow-sm" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-suka-orange rounded-tr-xl shadow-sm" />
              </div>
            </div>

            {/* Viewfinder Badge */}
            <div className="absolute bottom-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider text-white border border-white/20 flex items-center gap-1.5 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-suka-green animate-ping" />
              Pemindai Aktif
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-suka-brown/20 p-10 text-center bg-white/70 shadow-sm space-y-2">
            <Camera size={36} className="mx-auto text-suka-gray-400" />
            <p className="text-suka-brown font-extrabold text-xs uppercase tracking-wide">Kamera Tidak Aktif</p>
            <p className="text-suka-gray-500 text-[10px] font-semibold">
              Gunakan input kode verifikasi 6-karakter di bawah ini.
            </p>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Manual Input Fallback Card */}
        <div className="bg-white/85 backdrop-blur-md border border-suka-orange/15 p-5 rounded-2xl shadow-sm space-y-3">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label className="flex items-center gap-1.5 text-[10px] font-black text-suka-brown uppercase tracking-wider pl-0.5">
              <KeyRound size={13} className="text-suka-orange" /> Masukkan Kode Verifikasi Manual:
            </label>
            <div className="relative">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                placeholder="Contoh: A3F9D2 atau No. SJ"
                className="w-full px-4 py-3 rounded-xl border border-suka-brown/20 bg-white focus:outline-none focus:ring-2 focus:ring-suka-orange text-xs text-suka-ink placeholder-suka-gray-400 font-mono font-bold tracking-widest text-center uppercase shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-suka-brown hover:bg-suka-ink active:scale-[0.98] text-white transition-all rounded-xl font-extrabold uppercase tracking-wider text-xs shadow-md cursor-pointer"
            >
              Buka Form Verifikasi
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
