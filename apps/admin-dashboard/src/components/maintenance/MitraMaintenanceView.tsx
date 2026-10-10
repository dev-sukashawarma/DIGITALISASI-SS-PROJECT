import React from 'react'
import { Terminal } from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

interface MitraMaintenanceViewProps {
  customHtml?: string | null
}

export function MitraMaintenanceView({ customHtml }: MitraMaintenanceViewProps) {
  const { brandName, brandLogo } = useBrand()

  // If custom HTML is provided and non-empty, render isolated iframe
  if (customHtml && customHtml.trim().length > 0) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[9999] bg-suka-cream m-0 p-0 overflow-hidden">
        <iframe
          srcDoc={customHtml}
          title="UNDER MAINTENANCE"
          className="w-full h-full border-none m-0 p-0 block"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-suka-cream relative flex items-center justify-center p-4 sm:p-6 select-none font-sans overflow-hidden">
      {/* Suka Shawarma Warm Radial Background Gradients */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[540px] h-[540px] bg-suka-orange/20 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-suka-brown/10 rounded-full blur-[80px] pointer-events-none" />
      
      {/* Background grid pattern */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(112, 22, 4, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(112, 22, 4, 0.03) 1px, transparent 1px)`,
          backgroundSize: '36px 36px'
        }}
      />

      <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-suka-brown/10 shadow-2xl shadow-suka-brown/10 rounded-3xl p-6 sm:p-10 text-center relative z-10 animate-fade-in ring-1 ring-white/80">
        
        {/* 1. Suka Shawarma Official Logo Showcase */}
        <div className="flex flex-col items-center justify-center gap-3 mb-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-suka-orange to-amber-400 rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-300" />
            <div className="relative w-20 h-20 rounded-2xl bg-white p-2.5 border-2 border-suka-orange/40 shadow-lg shadow-suka-orange/20 flex items-center justify-center overflow-hidden">
              <img
                src={brandLogo || '/logo.png'}
                alt={brandName || 'Suka Shawarma'}
                className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(112,22,4,0.15)]"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png'
                }}
              />
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-suka-orange/10 border border-suka-orange/25 text-[11px] font-bold text-suka-brown tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-suka-orange" />
            <span>{brandName || 'SUKA SHAWARMA'}</span>
          </div>
        </div>

        {/* 2. Main Title: UNDER MAINTENANCE */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 leading-none uppercase text-suka-brown font-display">
          UNDER MAINTENANCE
        </h1>

        <div className="text-sm font-bold text-suka-orange mb-3 tracking-wide">
          Peningkatan Kualitas & Optimalisasi Layanan
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-suka-gray-600 leading-relaxed mb-8 font-medium">
          Sistem sedang menjalani peningkatan performa rutin guna memastikan akurasi data laporan, keamanan transaksi, dan stabilitas server.
        </p>



        {/* Footer Note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-mono text-suka-gray-400 tracking-widest uppercase">
          <Terminal className="w-3 h-3 text-suka-orange" />
          <span>SUKA SHAWARMA</span>
        </div>

      </div>
    </div>
  )
}
