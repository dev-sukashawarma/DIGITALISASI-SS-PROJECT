'use client'

import { useState, useRef, useEffect } from 'react'
import { X, QrCode, Loader2, CheckCircle2, Upload, Camera, RefreshCw, AlertCircle, FileImage } from 'lucide-react'
import { formatRupiah } from '@/lib/validations'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { postToNative } from '@suka/design-system'

export function QrisPaymentModal({
  isOpen,
  onClose,
  totalPrice,
  isOnline = true,
  onSubmit,
  submitting
}: {
  isOpen: boolean
  onClose: () => void
  totalPrice: number
  isOnline?: boolean
  onSubmit: (paymentProofFile?: File | null) => void
  submitting: boolean
}) {
  const [qrisMode, setQrisMode] = useState<'static' | 'transfer'>('transfer')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const qrData = `shawarma-kasir://pay?amount=${totalPrice}`
  const qrImageUrl = isOnline
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=1e293b&margin=10`
    : '/qris-static.png'

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    postToNative({ type: 'haptic', style: 'success' })
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }
    setIsCameraActive(false)
  }

  const startCamera = async (overrideFacingMode?: 'environment' | 'user') => {
    setCameraError(false)
    setIsCameraActive(false)
    
    stopCamera()
    
    const mode = overrideFacingMode || facingMode
    setFacingMode(mode)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsCameraActive(true)
      }
    } catch (err) {
      console.error(`Failed to access camera with facingMode ${mode}:`, err)
      if (mode === 'environment') {
        startCamera('user')
      } else {
        setCameraError(true)
      }
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `qris_proof_${Date.now()}.webp`, { type: 'image/webp' })
            setSelectedFile(file)
            setPreviewUrl(URL.createObjectURL(file))
            stopCamera()
            postToNative({ type: 'haptic', style: 'success' })
          }
        }, 'image/webp', 0.7)
      }
    }
  }

  useEffect(() => {
    if (isOpen && qrisMode === 'transfer' && !previewUrl) {
      startCamera()
    } else if (!isOpen || qrisMode !== 'transfer') {
      stopCamera()
    }
    
    return () => stopCamera()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qrisMode, previewUrl])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-[slideUp_0.3s_ease-out]">
        <div className="h-1 bg-blue-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">Pembayaran QRIS</h2>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
            <button
              onClick={() => {}}
              disabled={true}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all opacity-50 cursor-not-allowed bg-gray-100 text-gray-500`}
            >
              Scan (Statis) - Sedang Diperbaiki
            </button>
            <button
              onClick={() => setQrisMode('transfer')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${qrisMode === 'transfer' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Transfer (Bukti)
            </button>
          </div>

          <div className="flex flex-col items-center">
            {qrisMode === 'static' ? (
              <>
                <div className="bg-white p-4 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.05)] border border-gray-100 mb-4 inline-block">
                  {isOnline ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={qrImageUrl} alt="QRIS" width={200} height={200} className="rounded-xl mx-auto" />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl relative overflow-hidden flex-col">
                      <QrCode className="w-12 h-12 text-gray-400 mb-2" />
                      <p className="text-sm font-bold text-gray-600">QRIS STATIS</p>
                      <p className="text-xs text-gray-500 mt-1">Mode Offline</p>
                    </div>
                  )}
                </div>
                <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg font-medium border border-amber-200 mb-6 text-center">
                  Fitur QRIS Dinamis sedang diperbaiki / akan datang. Gunakan QRIS Statis meja kasir untuk saat ini.
                </div>
              </>
            ) : (
              <div className="w-full mb-6">
                <p className="text-sm text-gray-600 mb-3 text-center">Silakan ambil foto bukti transfer pelanggan menggunakan kamera.</p>
                
                <input 
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                
                {previewUrl ? (
                  <div className="relative border border-gray-200 rounded-xl overflow-hidden mb-3 bg-gray-50 w-full aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Bukti Transfer" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity gap-3">
                      <button onClick={() => startCamera()} className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Ulangi Foto
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="bg-white/80 text-gray-900 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-white transition-colors">
                        <FileImage className="w-4 h-4" /> Pilih dari Galeri
                      </button>
                    </div>
                  </div>
                ) : cameraError ? (
                  <div className="w-full aspect-[4/3] border-2 border-dashed border-red-200 bg-red-50 rounded-2xl flex flex-col items-center justify-center gap-3 p-4 text-center text-red-500 mb-3">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-sm font-medium">Gagal mengakses kamera.<br/>Silakan pilih file secara manual.</span>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 border border-red-100 hover:bg-red-50 transition-colors"
                    >
                      <FileImage className="w-4 h-4" /> Pilih File
                    </button>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative border border-gray-200 rounded-xl overflow-hidden mb-3 bg-black flex flex-col w-full aspect-[4/3]">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                      playsInline 
                      autoPlay 
                      muted 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <button 
                      onClick={(e) => {
                        e.preventDefault()
                        startCamera(facingMode === 'environment' ? 'user' : 'environment')
                      }}
                      className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2.5 backdrop-blur-md hover:bg-black/60 transition-all z-10"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                      <button 
                        onClick={capturePhoto} 
                        className="bg-white text-blue-600 rounded-full p-4 shadow-lg flex items-center justify-center border-4 border-gray-200 hover:scale-105 transition-transform"
                      >
                        <Camera className="w-7 h-7" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 mb-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-sm font-medium">Membuka kamera...</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-center w-full mb-6">
              <p className="text-sm font-bold text-gray-600 mb-1">TOTAL BAYAR</p>
              <p className="text-3xl font-black text-amber-500">{formatRupiah(totalPrice)}</p>
            </div>

            <button
              onClick={() => onSubmit(selectedFile)}
              disabled={submitting || (qrisMode === 'transfer' && !selectedFile)}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Proses Pembayaran</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
