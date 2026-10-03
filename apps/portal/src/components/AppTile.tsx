import {
  Package,
  Clock,
  Truck,
  ShoppingBag,
  Settings2,
  ShieldCheck,
  ArrowUpRight,
  Wallet,
  Megaphone,
  Users2,
  ClipboardList,
  Cctv,
  Briefcase,
  TrendingUp,
  Star,
  Building2,
  Sparkles,
} from 'lucide-react'

export interface AppTileProps {
  id?: string
  label: string
  url: string
  desc: string
  category?: string
  badge?: string
}

interface AppVisualConfig {
  icon: any
  tag: string
  /** Gradient for the icon chip */
  chip: string
  /** Border & shadow glow on card hover */
  hover: string
  /** Accent text color on hover */
  accentText: string
  /** Button background on hover */
  accentBg: string
  /** Soft radial glow revealed behind card */
  glow: string
  /** Tag pill badge style */
  tagBadge: string
}

export default function AppTile({ id = '', label, url, desc, category, badge }: AppTileProps) {
  const getAppConfig = (): AppVisualConfig => {
    const key = `${id} ${label}`.toLowerCase()

    if (key.includes('review')) {
      return {
        icon: <Star size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Customer Voice',
        chip: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600',
        hover: 'hover:border-amber-400/40 hover:shadow-[0_20px_36px_-12px_rgba(245,158,11,0.22)]',
        accentText: 'group-hover:text-amber-700',
        accentBg: 'group-hover:bg-amber-500 group-hover:border-amber-500',
        glow: 'bg-amber-400/20',
        tagBadge: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
      }
    }

    if (key.includes('absensi')) {
      return {
        icon: <Clock size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Presensi Kru',
        chip: 'bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600',
        hover: 'hover:border-blue-500/40 hover:shadow-[0_20px_36px_-12px_rgba(37,99,235,0.22)]',
        accentText: 'group-hover:text-blue-700',
        accentBg: 'group-hover:bg-blue-600 group-hover:border-blue-600',
        glow: 'bg-blue-500/20',
        tagBadge: 'bg-blue-500/10 text-blue-800 border-blue-500/20',
      }
    }

    if (key.includes('supplier') || key.includes('vendor')) {
      return {
        icon: <Building2 size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Pengadaan',
        chip: 'bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-800',
        hover: 'hover:border-teal-500/40 hover:shadow-[0_20px_36px_-12px_rgba(13,148,136,0.22)]',
        accentText: 'group-hover:text-teal-700',
        accentBg: 'group-hover:bg-teal-600 group-hover:border-teal-600',
        glow: 'bg-teal-500/20',
        tagBadge: 'bg-teal-500/10 text-teal-800 border-teal-500/20',
      }
    }

    if (key.includes('admin') || key.includes('leader')) {
      return {
        icon: <Settings2 size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Sistem & Operasi',
        chip: 'bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900',
        hover: 'hover:border-slate-600/40 hover:shadow-[0_20px_36px_-12px_rgba(51,65,85,0.25)]',
        accentText: 'group-hover:text-slate-900',
        accentBg: 'group-hover:bg-slate-800 group-hover:border-slate-800',
        glow: 'bg-slate-700/20',
        tagBadge: 'bg-slate-500/10 text-slate-800 border-slate-500/20',
      }
    }

    if (key.includes('distribusi')) {
      return {
        icon: <Truck size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Logistik & Armada',
        chip: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700',
        hover: 'hover:border-indigo-500/40 hover:shadow-[0_20px_36px_-12px_rgba(79,70,229,0.22)]',
        accentText: 'group-hover:text-indigo-700',
        accentBg: 'group-hover:bg-indigo-600 group-hover:border-indigo-600',
        glow: 'bg-indigo-500/20',
        tagBadge: 'bg-indigo-500/10 text-indigo-800 border-indigo-500/20',
      }
    }

    if (key.includes('finance') || key.includes('keuangan') || key.includes('purchasing')) {
      return {
        icon: <Wallet size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Keuangan & Kas',
        chip: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800',
        hover: 'hover:border-emerald-500/40 hover:shadow-[0_20px_36px_-12px_rgba(16,185,129,0.22)]',
        accentText: 'group-hover:text-emerald-700',
        accentBg: 'group-hover:bg-emerald-600 group-hover:border-emerald-600',
        glow: 'bg-emerald-500/20',
        tagBadge: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20',
      }
    }

    if (key.includes('hr') || key.includes('sdm')) {
      return {
        icon: <Users2 size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'SDM & Payroll',
        chip: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-800',
        hover: 'hover:border-violet-500/40 hover:shadow-[0_20px_36px_-12px_rgba(139,92,246,0.22)]',
        accentText: 'group-hover:text-violet-700',
        accentBg: 'group-hover:bg-violet-600 group-hover:border-violet-600',
        glow: 'bg-violet-500/20',
        tagBadge: 'bg-violet-500/10 text-violet-800 border-violet-500/20',
      }
    }

    if (key.includes('inventori') || key.includes('inventaris')) {
      return {
        icon: <ClipboardList size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Aset & Audit',
        chip: 'bg-gradient-to-br from-amber-600 via-amber-700 to-stone-800',
        hover: 'hover:border-amber-600/40 hover:shadow-[0_20px_36px_-12px_rgba(217,119,6,0.22)]',
        accentText: 'group-hover:text-amber-800',
        accentBg: 'group-hover:bg-amber-700 group-hover:border-amber-700',
        glow: 'bg-amber-600/20',
        tagBadge: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
      }
    }

    if (key.includes('monitor') || key.includes('kamera')) {
      return {
        icon: <Cctv size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'CCTV & Live',
        chip: 'bg-gradient-to-br from-teal-500 via-cyan-700 to-slate-900',
        hover: 'hover:border-cyan-500/40 hover:shadow-[0_20px_36px_-12px_rgba(6,182,212,0.22)]',
        accentText: 'group-hover:text-cyan-800',
        accentBg: 'group-hover:bg-cyan-700 group-hover:border-cyan-700',
        glow: 'bg-cyan-500/20',
        tagBadge: 'bg-cyan-500/10 text-cyan-800 border-cyan-500/20',
      }
    }

    if (key.includes('manager')) {
      return {
        icon: <Briefcase size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Manajemen Area',
        chip: 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-800',
        hover: 'hover:border-rose-500/40 hover:shadow-[0_20px_36px_-12px_rgba(225,29,72,0.22)]',
        accentText: 'group-hover:text-rose-700',
        accentBg: 'group-hover:bg-rose-600 group-hover:border-rose-600',
        glow: 'bg-rose-500/20',
        tagBadge: 'bg-rose-500/10 text-rose-800 border-rose-500/20',
      }
    }

    if (key.includes('marcom') || key.includes('marketing') || key.includes('influencer')) {
      return {
        icon: <Megaphone size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Marketing & Ads',
        chip: 'bg-gradient-to-br from-orange-500 via-[#E8590C] to-red-600',
        hover: 'hover:border-orange-500/40 hover:shadow-[0_20px_36px_-12px_rgba(249,115,22,0.22)]',
        accentText: 'group-hover:text-orange-600',
        accentBg: 'group-hover:bg-orange-500 group-hover:border-orange-500',
        glow: 'bg-orange-500/20',
        tagBadge: 'bg-orange-500/10 text-orange-800 border-orange-500/20',
      }
    }

    if (key.includes('owner')) {
      return {
        icon: <TrendingUp size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Eksekutif & Omzet',
        chip: 'bg-gradient-to-br from-amber-500 via-amber-600 to-suka-brown',
        hover: 'hover:border-amber-600/40 hover:shadow-[0_20px_36px_-12px_rgba(217,119,6,0.22)]',
        accentText: 'group-hover:text-amber-800',
        accentBg: 'group-hover:bg-amber-600 group-hover:border-amber-600',
        glow: 'bg-amber-600/20',
        tagBadge: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
      }
    }

    if (key.includes('pos') || key.includes('kasir')) {
      return {
        icon: <ShoppingBag size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Point of Sale',
        chip: 'bg-gradient-to-br from-suka-orange via-orange-600 to-suka-brown',
        hover: 'hover:border-suka-brown/40 hover:shadow-[0_20px_36px_-12px_rgba(112,22,4,0.22)]',
        accentText: 'group-hover:text-suka-brown',
        accentBg: 'group-hover:bg-suka-brown group-hover:border-suka-brown',
        glow: 'bg-suka-brown/20',
        tagBadge: 'bg-orange-500/10 text-orange-900 border-orange-500/20',
      }
    }

    if (key.includes('stok')) {
      return {
        icon: <Package size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
        tag: category || 'Stok & Bahan',
        chip: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-suka-green',
        hover: 'hover:border-suka-green/40 hover:shadow-[0_20px_36px_-12px_rgba(10,125,44,0.22)]',
        accentText: 'group-hover:text-suka-green',
        accentBg: 'group-hover:bg-suka-green group-hover:border-suka-green',
        glow: 'bg-suka-green/20',
        tagBadge: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20',
      }
    }

    return {
      icon: <ShieldCheck size={24} strokeWidth={2.25} className="drop-shadow-xs" />,
      tag: category || 'Modul Sistem',
      chip: 'bg-gradient-to-br from-suka-orange to-suka-brown',
      hover: 'hover:border-suka-orange/40 hover:shadow-[0_20px_36px_-12px_rgba(242,151,68,0.22)]',
      accentText: 'group-hover:text-suka-brown',
      accentBg: 'group-hover:bg-suka-orange group-hover:border-suka-orange',
      glow: 'bg-suka-orange/20',
      tagBadge: 'bg-suka-orange/10 text-suka-brown border-suka-orange/20',
    }
  }

  const { icon, tag, chip, hover, accentText, accentBg, glow, tagBadge } = getAppConfig()

  return (
    <a
      href={url}
      aria-label={`${label} - ${desc}`}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] sm:rounded-[22px] border border-suka-brown/[0.08] bg-white/85 backdrop-blur-xl p-4 sm:p-5 shadow-[0_4px_16px_-4px_rgba(112,22,4,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:bg-white hover:shadow-[0_20px_40px_-12px_rgba(112,22,4,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange focus-visible:ring-offset-2 active:scale-[0.985] cursor-pointer ${hover}`}
    >
      {/* Soft accent radial glow on hover */}
      <div className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${glow}`} />

      {/* Top subtle gloss highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-30" />

      {/* Header section: Icon Chip + Badge / Action Arrow */}
      <div className="relative z-10 flex items-start justify-between gap-2.5 sm:gap-3">
        <div className={`relative flex h-11 w-11 sm:h-[52px] sm:w-[52px] items-center justify-center rounded-[15px] sm:rounded-[18px] text-white shadow-md shadow-black/10 ring-1 ring-inset ring-white/30 transition-all duration-300 ease-out group-hover:scale-105 group-hover:-rotate-3 shrink-0 ${chip}`}>
          {icon}
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 sm:px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800 border border-amber-500/25 shadow-xs truncate">
              <Sparkles size={10} className="text-amber-600 shrink-0" />
              <span>{badge}</span>
            </span>
          ) : (
            <span className={`inline-flex items-center rounded-full px-2 sm:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border shadow-xs truncate ${tagBadge}`}>
              {tag}
            </span>
          )}

          <span className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-suka-brown/10 bg-white/90 text-suka-brown/50 shadow-xs transition-all duration-300 group-hover:border-transparent group-hover:text-white shrink-0 ${accentBg}`}>
            <ArrowUpRight size={14} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>

      {/* Body: Title & Description */}
      <div className="relative z-10 mt-3 sm:mt-4 flex-1">
        <h3 className={`text-sm sm:text-base font-extrabold tracking-tight text-suka-ink transition-colors duration-200 ${accentText}`}>
          {label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-suka-gray-500 font-medium line-clamp-2 min-h-[2rem]">
          {desc}
        </p>
      </div>

      {/* Footer: Action button with animated affordance */}
      <div className={`relative z-10 mt-3 sm:mt-4 flex items-center justify-between border-t border-suka-brown/[0.06] pt-2.5 sm:pt-3 text-[10px] font-black uppercase tracking-widest text-suka-brown/70 transition-colors duration-200 ${accentText}`}>
        <span className="inline-flex items-center gap-1.5">
          <span>Buka Modul</span>
          <span className="h-px w-3 bg-current opacity-40 transition-all duration-300 group-hover:w-6 group-hover:opacity-100" />
        </span>
        <span className="text-[10px] font-black opacity-60 sm:opacity-0 transition-all duration-300 sm:-translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0">
          Akses →
        </span>
      </div>
    </a>
  )
}
