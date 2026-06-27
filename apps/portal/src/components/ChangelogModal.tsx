'use client'

import { useEffect, useState } from 'react'
import { Sparkles, BellRing, Volume2, LayoutGrid, Zap, X } from 'lucide-react'

export default function ChangelogModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const versionKey = 'suka-announcement-v2.8'
    const seen = localStorage.getItem(versionKey)
    if (seen) return

    // Tampilkan tooltip setelah 1.5 detik
    const t1 = setTimeout(() => setShowTooltip(true), 1500)
    // Otomatis buka modal sekali setelah 2.5 detik
    const t2 = setTimeout(() => setIsOpen(true), 2500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    setShowTooltip(false)
    localStorage.setItem('suka-announcement-v2.8', 'true')
  }

  const updates = [
    {
      title: 'Push Notification Native',
      desc: 'Menerima pesanan masuk, verifikasi stock, dan rekap harian instan langsung ke status bar HP iOS & Android Anda.',
      icon: <BellRing className="w-5 h-5 text-suka-orange" />,
    },
    {
      title: 'Sound & Haptic Feedback',
      desc: 'Efek getar (haptics) dan alarm suara saat transaksi kasir berhasil, pesanan baru masuk, atau verifikasi absensi wajah sukses/gagal.',
      icon: <Volume2 className="w-5 h-5 text-suka-brown" />,
    },
    {
      title: 'Premium Shimmer Skeletons',
      desc: 'Transisi loading halaman kasir dan dashboard stok kini dihiasi efek shimmer linear gradien yang cepat, menggantikan spinner putar kaku.',
      icon: <LayoutGrid className="w-5 h-5 text-emerald-600" />,
    },
    {
      title: 'Transisi Splash Screen Mulus',
      desc: 'Pembukaan aplikasi native shell terasa mewah dengan transisi logo membesar lembut (zoom) dan memudar (fade-out) saat web siap.',
      icon: <Zap className="w-5 h-5 text-amber-500" />,
    },
  ]

  return (
    <>
      {/* Floating Badge & Tooltip Trigger */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {showTooltip && (
          <div className="mb-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white px-3 py-2 rounded-xl shadow-lg border border-white/10 text-[11px] font-black uppercase tracking-wider animate-bounce flex items-center gap-1.5 max-w-[240px]">
            <span>✨ Versi terbaru aktif! Lihat fitur baru</span>
            <button onClick={() => setShowTooltip(false)} className="hover:text-suka-orange transition-colors">
              <X size={12} />
            </button>
          </div>
        )}
        <button
          onClick={() => {
            setIsOpen(true)
            setShowTooltip(false)
          }}
          className="bg-white/80 hover:bg-white text-suka-brown border border-suka-orange/20 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all p-3 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest cursor-pointer backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4 text-suka-orange animate-pulse" />
          <span>Update v2.8</span>
        </button>
      </div>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          onClick={handleClose}
          className="fixed inset-0 bg-suka-ink/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
        >
          {/* Modal Container */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-suka-cream rounded-3xl border border-suka-orange/15 shadow-2xl p-6 max-w-lg w-full relative space-y-5 animate-slide-up"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-block text-[9px] font-black tracking-widest text-suka-orange uppercase bg-suka-orange/10 px-2 py-0.5 rounded-md leading-none mb-1">
                  Changelog v2.8.0
                </span>
                <h2 className="text-xl font-black text-suka-brown font-display tracking-wide leading-tight">
                  Perubahan Terbaru Aplikasi
                </h2>
              </div>
              <button 
                onClick={handleClose}
                className="w-8 h-8 rounded-xl bg-white border border-suka-orange/10 hover:bg-suka-orange/5 active:scale-95 transition-colors flex items-center justify-center text-suka-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* List Updates */}
            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              {updates.map((item, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 border border-suka-orange/5 flex gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-suka-cream border border-suka-orange/10 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-extrabold text-sm text-suka-ink leading-snug">{item.title}</h3>
                    <p className="text-[11px] sm:text-xs text-suka-gray-500 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-suka-orange/10 flex justify-end">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-suka-orange/20 cursor-pointer"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded styles for transitions */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  )
}
