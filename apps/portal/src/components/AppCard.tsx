import { Package, Clock, Truck, ShoppingBag, BarChart3, ArrowRight } from 'lucide-react'

interface Props {
  label: string
  url:   string
  desc:  string
}

export default function AppCard({ label, url, desc }: Props) {
  // Map labels to Lucide icons
  const getIcon = () => {
    switch (label.toLowerCase()) {
      case 'stok':
        return <Package size={24} />
      case 'absensi':
        return <Clock size={24} />
      case 'distribusi':
        return <Truck size={24} />
      case 'pos kasir':
        return <ShoppingBag size={24} />
      case 'owner dashboard':
        return <BarChart3 size={24} />
      default:
        return <Package size={24} />
    }
  }

  return (
    <a
      href={url}
      className="block bg-white border border-suka-orange/15 rounded-2xl p-6 shadow-md shadow-suka-brown/5
                 transition-all duration-300 hover:border-suka-orange/40 hover:shadow-xl hover:shadow-suka-brown/10
                 hover:-translate-y-1 group"
    >
      <div className="flex justify-between items-start">
        <div className="w-12 h-12 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center
                      transition-colors duration-300 group-hover:bg-suka-orange group-hover:text-white">
          {getIcon()}
        </div>
        <span className="text-suka-gray-300 group-hover:text-suka-orange transition-colors">
          <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
        </span>
      </div>

      <div className="mt-4">
        <p className="font-bold text-lg text-suka-brown group-hover:text-suka-orange transition-colors">{label}</p>
        <p className="mt-1 text-xs text-suka-gray-600 leading-relaxed font-medium">{desc}</p>
      </div>

      <div className="mt-6 pt-3 border-t border-suka-cream/50 flex items-center text-[10px] font-bold text-suka-orange tracking-wider uppercase">
        Buka Aplikasi
      </div>
    </a>
  )
}
