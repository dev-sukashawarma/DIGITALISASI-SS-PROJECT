import React from 'react'
import { LucideIcon, HelpCircle } from 'lucide-react'
import { motion, HTMLMotionProps } from 'framer-motion'

type Accent = 'orange' | 'green' | 'brown' | 'red' | 'blue'

const ACCENT: Record<Accent, { icon: string; iconBg: string; sub: string }> = {
  orange: { icon: 'text-suka-orange', iconBg: 'bg-suka-orange/10', sub: 'text-suka-orange' },
  green: { icon: 'text-suka-green', iconBg: 'bg-suka-green/10', sub: 'text-suka-green' },
  brown: { icon: 'text-suka-brown', iconBg: 'bg-suka-brown/10', sub: 'text-suka-brown' },
  red: { icon: 'text-red-600', iconBg: 'bg-red-500/10', sub: 'text-red-600' },
  blue: { icon: 'text-blue-600', iconBg: 'bg-blue-500/10', sub: 'text-blue-600' },
}

/**
 * Kartu angka utama: label kecil, ANGKA BESAR, aksen warna, sub-teks opsional.
 * Batasi maksimal 3 per layar agar informasi penting menonjol.
 */
export function StatTile(props: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: LucideIcon
  accent?: Accent
  tooltip?: string
} & HTMLMotionProps<"div">) {
  const { label, value, sub, icon: Icon, accent = 'brown', tooltip, ...motionProps } = props
  const a = ACCENT[accent]

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
      }}
      className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300"
      {...motionProps}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">{label}</p>
          {tooltip && (
            <div className="group relative flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-suka-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-suka-ink text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-suka-ink"></div>
              </div>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-xl ${a.iconBg}`}>
            <Icon className={`w-5 h-5 ${a.icon}`} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-suka-brown">{value}</h3>
        {sub && <p className={`text-[10px] font-semibold mt-1 uppercase ${a.sub}`}>{sub}</p>}
      </div>
    </motion.div>
  )
}
