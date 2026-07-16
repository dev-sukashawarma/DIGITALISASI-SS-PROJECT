'use client'

import { useEffect, useState } from 'react'
import { usePrinterStore } from '@/lib/printerStore'
import { connectBluetoothPrinter, autoConnectBluetoothPrinter } from '@/lib/bluetooth-printer'
import { Printer, Bluetooth, CheckCircle2, Loader2, MousePointerClick, Check, X } from 'lucide-react'

export default function PrinterBlockerMount() {
  const { device, isConnecting } = usePrinterStore()
  const [hasInteracted, setHasInteracted] = useState(false)
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false)
  
  // State for success animation before unmounting
  const [shouldRender, setShouldRender] = useState(!device)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Auto-connect attempt on first interaction
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (hasInteracted) return
      setHasInteracted(true)
      
      if (!device && !autoConnectAttempted) {
        try {
          await autoConnectBluetoothPrinter()
        } catch (e) {
          console.warn("Auto-connect silent failed", e)
        } finally {
          setAutoConnectAttempted(true)
        }
      }
      
      window.removeEventListener('click', handleFirstInteraction, true)
      window.removeEventListener('touchstart', handleFirstInteraction, true)
    }

    window.addEventListener('click', handleFirstInteraction, true)
    window.addEventListener('touchstart', handleFirstInteraction, true)

    return () => {
      window.removeEventListener('click', handleFirstInteraction, true)
      window.removeEventListener('touchstart', handleFirstInteraction, true)
    }
  }, [hasInteracted, device, autoConnectAttempted])

  // Handle successful connection animation
  useEffect(() => {
    if (device) {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setShowSuccess(false)
      setShouldRender(true)
    }
  }, [device])

  if (!shouldRender || isDismissed) return null

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-opacity duration-500 ${showSuccess ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className={`relative bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col transition-all duration-500 transform ${showSuccess ? 'scale-95' : 'scale-100 animate-in fade-in zoom-in-95'}`}>
        
        {/* Temporary Close Button for Development */}
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors z-10"
          title="Tutup (Hanya untuk Development)"
        >
          <X className="w-5 h-5" />
        </button>
        
        {showSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Terhubung!</h2>
            <p className="text-gray-500">{device?.name || 'Printer Bluetooth'} siap digunakan.</p>
          </div>
        ) : (
          <div className="p-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 ring-8 ring-indigo-50/50">
                <Printer className="w-8 h-8 text-indigo-600" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Koneksi Printer</h2>
              <p className="text-gray-500 text-sm max-w-[280px]">
                Printer Bluetooth wajib terhubung untuk melayani transaksi.
              </p>
            </div>

            {/* Content (Wizard Steps) */}
            <div className="space-y-4 mb-8">
              {/* Step 1 */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-100 transition-colors hover:bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    Siapkan Printer
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">Pastikan daya menyala dan kertas struk terisi penuh.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-100 transition-colors hover:bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    Aktifkan Bluetooth
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">Nyalakan koneksi Bluetooth di perangkat kasir ini.</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div>
              {!hasInteracted && !autoConnectAttempted ? (
                <div 
                  className="w-full py-4 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center gap-3 cursor-pointer hover:bg-orange-100 transition-all active:scale-[0.98]"
                  onClick={() => {
                    // Triggers the global click listener
                  }}
                >
                  <MousePointerClick className="w-5 h-5 text-orange-600 animate-bounce" />
                  <span className="text-sm font-semibold text-orange-700">Sentuh layar untuk memulai</span>
                </div>
              ) : (
                <button
                  onClick={() => connectBluetoothPrinter()}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-900/20"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Mencari Perangkat...
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-5 h-5" />
                      Hubungkan Printer
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
