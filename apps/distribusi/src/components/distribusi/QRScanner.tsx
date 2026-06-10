'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function QRScanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const animFrameRef = useRef<number | null>(null)

  const navigateToVerifikasi = async (documentNumber: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('surat_jalan')
      .select('id, status')
      .eq('document_number', documentNumber)
      .single()

    if (error || !data) {
      setError(`Surat Jalan "${documentNumber}" tidak ditemukan`)
      return
    }
    if (data.status === 'diterima') {
      setError('Surat Jalan ini sudah diterima sebelumnya')
      return
    }
    stopCamera()
    router.push(`/distribusi/terima/${data.id}`)
  }

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
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
      // @ts-ignore — BarcodeDetector not in TS lib yet
      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
      setScanning(true)
      scanLoop()
    } catch {
      setCameraAvailable(false)
    }
  }

  const scanLoop = () => {
    if (!videoRef.current || !detectorRef.current) return
    detectorRef.current
      .detect(videoRef.current)
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
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Scan QR Surat Jalan</h1>
      <p className="text-gray-500 text-sm mb-6">
        Arahkan kamera ke QR code di Surat Jalan fisik
      </p>

      {cameraAvailable ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 mb-6 bg-black aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 mb-6 p-8 text-center bg-gray-50">
          <p className="text-gray-500 text-sm">Kamera tidak tersedia di browser ini</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="space-y-3">
        <p className="text-sm text-gray-600 font-medium">Atau masukkan nomor manual:</p>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="SJ/KITCHEN/20260610/001"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700"
        >
          Cari Surat Jalan
        </button>
      </form>
    </div>
  )
}
