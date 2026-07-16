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
  const [isScanningAnim, setIsScanningAnim] = useState(false)

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
      setIsScanningAnim(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setShowSuccess(false)
      setShouldRender(true)
    }
  }, [device])

  const handleConnectClick = () => {
    setIsScanningAnim(true)
    // Build hype with custom scanning UI for 2 seconds before calling real bluetooth prompt
    setTimeout(() => {
      connectBluetoothPrinter().catch(() => {
        // If it fails immediately (e.g. cancelled), reset the animation state
        setIsScanningAnim(false)
      })
    }, 2000)
  }

  // Effect to reset scanning animation if store connection state changes to false and we don't have device
  useEffect(() => {
    if (!isConnecting && !device) {
      setIsScanningAnim(false)
    }
  }, [isConnecting, device])

  if (!shouldRender || isDismissed) return null

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 transition-opacity duration-500 ${showSuccess ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className={`relative bg-white border border-slate-200/60 rounded-[2.5rem] w-full max-w-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col transition-all duration-500 transform ${showSuccess ? 'scale-95' : 'scale-100 animate-in fade-in zoom-in-95'}`}>
        
        {/* Temporary Close Button for Development */}
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-white backdrop-blur-md transition-colors z-20 shadow-sm"
          title="Tutup (Hanya untuk Development)"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>
        
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center text-center min-h-[460px] bg-white animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/30">
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Terhubung!</h2>
            <p className="text-slate-500">{device?.name || 'Printer Bluetooth'} siap digunakan.</p>
          </div>
        ) : isScanningAnim ? (
          <div className="flex flex-col items-center justify-center text-center bg-gradient-to-b from-indigo-50/50 to-white min-h-[460px] animate-in fade-in duration-300">
            <div className="relative w-40 h-40 flex items-center justify-center mb-8 mt-4">
              <div className="absolute inset-[-20px] bg-indigo-500 rounded-full animate-[ping_2.5s_infinite] opacity-20"></div>
              <div className="absolute inset-[-10px] bg-indigo-400 rounded-full animate-[ping_2.5s_infinite_400ms] opacity-30"></div>
              <div className="absolute inset-0 bg-indigo-300 rounded-full animate-[ping_2.5s_infinite_800ms] opacity-40"></div>
              <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/40 border-4 border-white">
                <Bluetooth className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Mencari Perangkat...</h2>
            <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed">
              Tunggu sebentar, sedang memindai sinyal bluetooth printer di sekitar Anda.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Hero Banner Area */}
            <div className="relative h-56 w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 overflow-hidden flex items-center justify-center shrink-0">
              {/* Animated background elements */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute -top-10 -left-10 w-48 h-48 bg-white/20 rounded-full blur-2xl mix-blend-overlay animate-pulse"></div>
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-blue-300/30 rounded-full blur-2xl mix-blend-overlay animate-pulse" style={{ animationDelay: '1s' }}></div>
              </div>

              {/* Main Icon Composition */}
              <div className="relative z-10 flex items-center justify-center mt-[-10px]">
                {/* Floating Printer Icon */}
                <div className="relative animate-[bounce_4s_infinite_ease-in-out]">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center shadow-2xl relative z-20">
                    <Printer className="w-10 h-10 text-white drop-shadow-md" strokeWidth={1.5} />
                  </div>
                  {/* Animated Receipt (coming out of the printer) */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-8 bg-white rounded-t-sm shadow-inner overflow-hidden flex flex-col gap-1.5 py-2 px-1.5 z-10 animate-[bounce_3s_infinite_ease-in-out_reverse]">
                     <div className="w-full h-0.5 bg-gray-200 rounded-full"></div>
                     <div className="w-3/4 h-0.5 bg-gray-200 rounded-full"></div>
                     <div className="w-5/6 h-0.5 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
                
                {/* Bluetooth Signal Connecting */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-36 border border-white/30 rounded-full animate-[ping_3s_infinite] opacity-50"></div>
                  <div className="w-52 h-52 border border-white/20 rounded-full animate-[ping_3s_infinite_700ms] opacity-30 absolute"></div>
                </div>
              </div>
              
              {/* Decorative Wave at Bottom of Hero */}
              <div className="absolute -bottom-1 left-0 w-full overflow-hidden leading-none pointer-events-none">
                <svg className="relative block w-[calc(100%+1.3px)] h-[32px]" preserveAspectRatio="none" viewBox="0 0 1440 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 54H1440V0C1440 0 1153.27 43.5 720 43.5C286.727 43.5 0 0 0 0V54Z" fill="white"/>
                </svg>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-8 pt-6 bg-white">
              <div className="text-center mb-7">
                <h2 className="text-[22px] font-bold text-slate-900 tracking-tight">Koneksi Printer</h2>
                <p className="text-slate-500 text-sm mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                  Printer Bluetooth wajib terhubung untuk melayani transaksi.
                </p>
              </div>

              {/* Wizard Steps */}
              <div className="space-y-3 mb-8">
                {/* Step 1 */}
                <div className="group relative flex items-center p-4 bg-slate-50 hover:bg-slate-50/80 rounded-2xl border border-slate-100 transition-all hover:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] hover:border-indigo-100 cursor-default overflow-hidden">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-indigo-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center font-bold text-slate-600 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                    1
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-slate-900 text-sm">Siapkan Printer</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pastikan daya nyala & kertas struk terisi.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="group relative flex items-center p-4 bg-slate-50 hover:bg-slate-50/80 rounded-2xl border border-slate-100 transition-all hover:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] hover:border-indigo-100 cursor-default overflow-hidden">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-indigo-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center font-bold text-slate-600 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                    2
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-slate-900 text-sm">Aktifkan Bluetooth</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Nyalakan koneksi Bluetooth di perangkat kasir.</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {!hasInteracted && !autoConnectAttempted ? (
                  <div 
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center gap-3 cursor-pointer hover:from-orange-600 hover:to-amber-600 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/25"
                    onClick={() => {
                      // Triggers the global click listener
                    }}
                  >
                    <MousePointerClick className="w-5 h-5 text-white animate-bounce" />
                    <span className="text-sm font-semibold text-white">Sentuh layar untuk memulai</span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectClick}
                    disabled={isScanningAnim || isConnecting}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-slate-900/20"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Membuka Konfigurasi...
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
          </div>
        )}
      </div>
    </div>
  )
}
