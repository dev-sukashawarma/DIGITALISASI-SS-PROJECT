import { Package, Clock, Truck, ShoppingBag, BarChart3 } from 'lucide-react'

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
        return <Package size={20} />
      case 'absensi':
        return <Clock size={20} />
      case 'distribusi':
        return <Truck size={20} />
      case 'pos kasir':
        return <ShoppingBag size={20} />
      case 'owner dashboard':
        return <BarChart3 size={20} />
      default:
        return <Package size={20} />
    }
  }

  return (
    <a
      href={url}
      className="flex items-center justify-between bg-white border border-suka-orange/15 rounded-xl p-4 shadow-sm shadow-suka-brown/5
                 transition-all duration-300 hover:border-suka-orange/45 hover:shadow-md hover:shadow-suka-brown/10
                 hover:-translate-y-0.5 group"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Left side icon in round deep brown container */}
        <div className="w-10 h-10 rounded-full bg-suka-brown text-suka-cream flex items-center justify-center flex-shrink-0
                      transition-colors duration-300 group-hover:bg-suka-orange group-hover:text-white">
          {getIcon()}
        </div>
        
        {/* Middle details */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-suka-brown group-hover:text-suka-orange transition-colors truncate">
            {label}
          </p>
          <p className="text-[11px] text-suka-gray-500 leading-normal font-medium truncate mt-0.5">
            {desc}
          </p>
        </div>
      </div>

      {/* Right Action Button */}
      <span className="ml-4 flex-shrink-0 bg-suka-orange text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors group-hover:bg-suka-orange/90 shadow-sm">
        BUKA
      </span>
    </a>
  )
}

