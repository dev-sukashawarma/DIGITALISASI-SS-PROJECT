import { Package, Clock, Truck, ShoppingBag, BarChart3, Settings, Shield, ArrowUpRight, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  label: string
  url:   string
  desc:  string
}

interface AppConfig {
  icon: ReactNode
  /** Gradient for the icon chip */
  chip: string
  /** Ring + shadow tint on hover */
  hover: string
  /** Accent text colour for title + CTA on hover */
  accentText: string
  /** Soft radial glow revealed on hover */
  glow: string
}

export default function AppTile({ label, url, desc }: Props) {
  const getAppConfig = (): AppConfig => {
    const key = label.toLowerCase()
    if (key.includes('stok')) return {
      icon: <Package size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-emerald-500 to-suka-green',
      hover: 'hover:border-suka-green/30 hover:shadow-suka-green/10',
      accentText: 'group-hover:text-suka-green',
      glow: 'bg-suka-green/15',
    }
    if (key.includes('absensi')) return {
      icon: <Clock size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-suka-orange to-amber-500',
      hover: 'hover:border-suka-orange/30 hover:shadow-suka-orange/10',
      accentText: 'group-hover:text-suka-orange',
      glow: 'bg-suka-orange/15',
    }
    if (key.includes('distribusi')) return {
      icon: <Truck size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-indigo-500 to-blue-600',
      hover: 'hover:border-indigo-500/30 hover:shadow-indigo-500/10',
      accentText: 'group-hover:text-indigo-600',
      glow: 'bg-indigo-500/15',
    }
    if (key.includes('pos') || key.includes('kasir')) return {
      icon: <ShoppingBag size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-suka-orange to-suka-brown',
      hover: 'hover:border-suka-brown/30 hover:shadow-suka-brown/10',
      accentText: 'group-hover:text-suka-brown',
      glow: 'bg-suka-brown/15',
    }
    if (key.includes('owner')) return {
      icon: <BarChart3 size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-amber-500 to-suka-brown',
      hover: 'hover:border-amber-600/30 hover:shadow-amber-600/10',
      accentText: 'group-hover:text-amber-700',
      glow: 'bg-amber-600/15',
    }
    if (key.includes('admin')) return {
      icon: <Settings size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-suka-brown to-suka-ink',
      hover: 'hover:border-suka-brown/30 hover:shadow-suka-brown/10',
      accentText: 'group-hover:text-suka-brown',
      glow: 'bg-suka-brown/15',
    }
    if (key.includes('finance') || key.includes('keuangan')) return {
      icon: <Wallet size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-emerald-600 to-teal-700',
      hover: 'hover:border-emerald-600/30 hover:shadow-emerald-600/10',
      accentText: 'group-hover:text-emerald-700',
      glow: 'bg-emerald-600/15',
    }
    return {
      icon: <Shield size={24} strokeWidth={2.25} />,
      chip: 'bg-gradient-to-br from-suka-orange to-suka-brown',
      hover: 'hover:border-suka-orange/30 hover:shadow-suka-orange/10',
      accentText: 'group-hover:text-suka-orange',
      glow: 'bg-suka-orange/15',
    }
  }

  const { icon, chip, hover, accentText, glow } = getAppConfig()

  return (
    <a
      href={url}
      className={`group relative flex flex-col overflow-hidden rounded-[22px] border border-suka-brown/[0.07] bg-white/75 backdrop-blur-md p-5 shadow-[0_2px_12px_-4px_rgba(112,22,4,0.10)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white/95 hover:shadow-[0_16px_36px_-12px_rgba(112,22,4,0.22)] ${hover}`}
    >
      {/* Soft accent glow on hover */}
      <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${glow}`} />

      <div className="relative z-10 flex items-start justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-suka-brown/15 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 ${chip}`}>
          {icon}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-suka-brown/10 bg-white/70 text-suka-brown/40 transition-all duration-300 group-hover:border-transparent group-hover:bg-suka-ink group-hover:text-white group-hover:rotate-0">
          <ArrowUpRight size={16} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

      <h3 className={`mt-5 text-base font-extrabold tracking-tight text-suka-ink transition-colors ${accentText}`}>
        {label}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-suka-gray-500 font-medium line-clamp-2">
        {desc}
      </p>

      <div className={`mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-suka-brown/70 transition-colors ${accentText}`}>
        <span>Buka Modul</span>
        <span className="h-px w-4 bg-current opacity-40 transition-all duration-300 group-hover:w-7 group-hover:opacity-100" />
      </div>
    </a>
  )
}
