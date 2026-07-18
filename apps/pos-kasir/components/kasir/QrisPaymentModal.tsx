'use client'

import { useState, useRef } from 'react'
import { X, QrCode, Loader2, CheckCircle2, Upload, Camera } from 'lucide-react'
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
  onSubmit: (paymentProofUrl?: string | null) => void
  submitting: boolean
}) {
  const [qrisMode, setQrisMode] = useState<'static' | 'transfer'>('static')
  const [uploading, setUploading] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const qrData = `shawarma-kasir://pay?amount=${totalPrice}`
  const qrImageUrl = isOnline
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=1e293b&margin=10`
    : '/qris-static.png'

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('payment_proofs')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      setPaymentProofUrl(data.path)
      postToNative({ type: 'haptic', style: 'success' })
    } catch (err) {
      console.error('Failed to upload proof:', err)
      alert('Gagal mengunggah bukti transfer.')
      postToNative({ type: 'haptic', style: 'error' })
    } finally {
      setUploading(false)
    }
  }

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
              onClick={() => setQrisMode('static')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${qrisMode === 'static' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Scan (Statis)
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
                <p className="text-sm text-gray-600 mb-3 text-center">Silakan unggah bukti transfer dari pelanggan.</p>
                
                <input 
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                
                {paymentProofUrl ? (
                  <div className="relative border border-gray-200 rounded-xl overflow-hidden mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={supabase.storage.from('payment_proofs').getPublicUrl(paymentProofUrl).data.publicUrl} alt="Bukti Transfer" className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <button onClick={() => fileInputRef.current?.click()} className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Ganti Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-40 border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors text-blue-600"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-bold">Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold">Ambil / Unggah Foto Bukti</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            <div className="text-center w-full mb-6">
              <p className="text-sm font-bold text-gray-600 mb-1">TOTAL BAYAR</p>
              <p className="text-3xl font-black text-amber-500">{formatRupiah(totalPrice)}</p>
            </div>

            <button
              onClick={() => {
                onSubmit(paymentProofUrl)
              }}
              disabled={submitting || (qrisMode === 'transfer' && !paymentProofUrl)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {qrisMode === 'transfer' && !paymentProofUrl ? 'Menunggu Bukti Transfer...' : 'Konfirmasi Pembayaran Selesai'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
