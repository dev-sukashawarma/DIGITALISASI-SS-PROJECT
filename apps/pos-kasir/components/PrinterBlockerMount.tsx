'use client'

import { useEffect, useState } from 'react'
import { usePrinterStore } from '@/lib/printerStore'
import { connectBluetoothPrinter, autoConnectBluetoothPrinter } from '@/lib/bluetooth-printer'
import { Printer, Bluetooth, CheckCircle2, Loader2, MousePointerClick } from 'lucide-react'

export default function PrinterBlockerMount() {
  const { device, isConnecting } = usePrinterStore()
  const [hasInteracted, setHasInteracted] = useState(false)
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false)

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

  // If we already have a device, don't show anything
  if (device) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-center text-white relative">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
            <Printer className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Koneksi Printer Wajib</h2>
          <p className="text-indigo-100 text-sm">
            Anda harus menghubungkan printer Bluetooth sebelum melayani transaksi.
          </p>
        </div>

        {/* Content (Wizard Steps) */}
        <div className="p-8">
          <div className="space-y-6">
            
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  Siapkan Printer <Printer className="w-4 h-4 text-gray-500" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">Pastikan daya printer menyala dan terisi kertas struk.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  Aktifkan Bluetooth <Bluetooth className="w-4 h-4 text-gray-500" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">Nyalakan Bluetooth di tablet/device kasir ini.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  Hubungkan <CheckCircle2 className="w-4 h-4 text-gray-500" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">Tekan tombol di bawah dan pilih nama printer Anda.</p>
              </div>
            </div>

          </div>

          {/* Action Button */}
          <div className="mt-8">
            {!hasInteracted && !autoConnectAttempted ? (
              <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100 flex flex-col items-center gap-2 cursor-pointer hover:bg-orange-100 transition-colors"
                onClick={() => {
                  // This click will trigger the document click listener above
                }}
              >
                <MousePointerClick className="w-6 h-6 text-orange-500 animate-bounce" />
                <p className="text-sm text-orange-700 font-medium">Klik sembarang area layar untuk mengecek riwayat koneksi</p>
              </div>
            ) : (
              <button
                onClick={() => connectBluetoothPrinter()}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-70 disabled:cursor-wait shadow-lg shadow-indigo-200"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-6 h-6" />
                    Hubungkan Printer Sekarang
                  </>
                )}
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  )
}
