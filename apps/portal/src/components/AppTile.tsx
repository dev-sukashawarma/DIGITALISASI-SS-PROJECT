'use client'

import { useState } from 'react'
import { Package, Clock, Truck, ShoppingBag, BarChart3, Settings, Shield, Download } from 'lucide-react'

interface Props {
  label: string
  url:   string
  desc:  string
}

export default function AppTile({ label, url, desc }: Props) {
  const [transitioning, setTransitioning] = useState(false)

  const getAppConfig = () => {
    const key = label.toLowerCase()
    if (key.includes('stok')) return {
      icon: <Package size={22} />,
      accentClass: 'hover:border-suka-green/40 hover:shadow-suka-green/5',
      iconBgClass: 'group-hover:bg-suka-green text-suka-green bg-suka-green/5',
      glowClass: 'bg-suka-green/10'
    }
    if (key.includes('absensi')) return {
      icon: <Clock size={22} />,
      accentClass: 'hover:border-suka-orange/40 hover:shadow-suka-orange/5',
      iconBgClass: 'group-hover:bg-suka-orange text-suka-orange bg-suka-orange/5',
      glowClass: 'bg-suka-orange/10'
    }
    if (key.includes('distribusi')) return {
      icon: <Truck size={22} />,
      accentClass: 'hover:border-indigo-500/40 hover:shadow-indigo-500/5',
      iconBgClass: 'group-hover:bg-indigo-500 text-indigo-500 bg-indigo-500/5',
      glowClass: 'bg-indigo-500/10'
    }
    if (key.includes('pos') || key.includes('kasir')) return {
      icon: <ShoppingBag size={22} />,
      accentClass: 'hover:border-suka-orange/40 hover:shadow-suka-orange/5',
      iconBgClass: 'group-hover:bg-suka-orange text-suka-orange bg-suka-orange/5',
      glowClass: 'bg-suka-orange/10'
    }
    if (key.includes('owner')) return {
      icon: <BarChart3 size={22} />,
      accentClass: 'hover:border-amber-600/40 hover:shadow-amber-600/5',
      iconBgClass: 'group-hover:bg-amber-600 text-amber-600 bg-amber-600/5',
      glowClass: 'bg-amber-600/10'
    }
    if (key.includes('admin')) return {
      icon: <Settings size={22} />,
      accentClass: 'hover:border-suka-brown/40 hover:shadow-suka-brown/5',
      iconBgClass: 'group-hover:bg-suka-brown text-suka-brown bg-suka-brown/5',
      glowClass: 'bg-suka-brown/10'
    }
    return {
      icon: <Shield size={22} />,
      accentClass: 'hover:border-suka-orange/40 hover:shadow-suka-orange/5',
      iconBgClass: 'group-hover:bg-suka-orange text-suka-orange bg-suka-orange/5',
      glowClass: 'bg-suka-orange/10'
    }
  }

  const { icon, accentClass, iconBgClass, glowClass } = getAppConfig()

  const navigate = (e: React.MouseEvent, target = '_self') => {
    if (target === '_blank') return // biarkan browser handle
    e.preventDefault()
    setTransitioning(true)
    setTimeout(() => { window.location.href = url }, 500)
  }

  return (
    <>
      {/* Fade overlay */}
      {transitioning && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: '#fff8f1',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '1rem',
            animation: 'suka-fade-in 0.35s ease forwards',
          }}
        >
          {/* Spinner */}
          <div style={{
            width: 40, height: 40,
            border: '3px solid #d9c2b2',
            borderTopColor: '#f29744',
            borderRadius: '50%',
            animation: 'suka-spin 0.7s linear infinite',
          }} />
          <span style={{
            fontSize: '0.75rem', fontWeight: 700,
            color: '#701604', letterSpacing: '0.1em',
            textTransform: 'uppercase', opacity: 0.7,
          }}>
            {label}
          </span>
          <style>{`
            @keyframes suka-fade-in {
              from { opacity: 0 } to { opacity: 1 }
            }
            @keyframes suka-spin {
              to { transform: rotate(360deg) }
            }
          `}</style>
        </div>
      )}

      <div className={`group relative flex flex-col justify-between overflow-hidden bg-white/70 backdrop-blur-md border border-suka-orange/10 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:bg-white/90 hover:-translate-y-1 ${accentClass}`}>
        <div className={`absolute -right-10 -top-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${glowClass}`} />

        <a href={url} onClick={navigate} className="flex flex-col gap-0 flex-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border border-suka-orange/5 group-hover:text-white group-hover:scale-105 ${iconBgClass}`}>
            {icon}
          </div>
          <h3 className="font-extrabold text-sm sm:text-base text-suka-ink mt-4 group-hover:text-suka-orange transition-colors truncate">
            {label}
          </h3>
          <p className="text-[11px] sm:text-xs text-suka-gray-500 font-medium leading-relaxed mt-1 line-clamp-2">
            {desc}
          </p>
          <div className="hidden md:flex mt-5 items-center gap-1.5 text-[10px] font-extrabold text-suka-brown group-hover:text-suka-orange transition-colors uppercase tracking-wider">
            <span>Buka Modul</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </div>
        </a>

        {/* Mobile only */}
        <div className="md:hidden mt-4 flex gap-2">
          <a
            href={url}
            onClick={navigate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-suka-orange/10 text-suka-orange text-[11px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
          >
            Buka
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => navigate(e, '_blank')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-suka-green/10 text-suka-green text-[11px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
          >
            <Download size={11} />
            Install
          </a>
        </div>
      </div>
    </>
  )
}
