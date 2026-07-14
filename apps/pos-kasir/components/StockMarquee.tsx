'use client'

import { AlertTriangle } from 'lucide-react'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useStockAlerts } from '@/lib/useStockAlerts'
import { getStokUrl } from '@/lib/stokUrl'

export default function StockMarquee() {
  const { outletId } = useMyOutlet()
  const { criticalItems, isLoading } = useStockAlerts(outletId)

  if (!outletId || isLoading || criticalItems.length === 0) return null

  const outOfStockNames = criticalItems.map(item => item.item_name).join(' • ')

  // Calculate dynamic duration based on text length to prevent too fast/slow movement (made slower as requested)
  const animationDuration = Math.max(25, outOfStockNames.length * 0.4) + 's'

  return (
    <div className="w-full flex flex-col items-center">
      <style>{`
        @keyframes customMarquee {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .animate-custom-marquee {
          animation: customMarquee linear infinite;
        }
      `}</style>
      
      <a 
        href={`${getStokUrl()}/dashboard`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full bg-red-600 text-white overflow-hidden relative shadow-md"
      >
        <div className="flex items-center w-full px-4 py-2 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2 pr-4 shrink-0 bg-red-600 z-10 font-bold relative">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span>STOK KRITIS/HABIS:</span>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-red-600 to-transparent pointer-events-none translate-x-[100%]"></div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div 
              className="animate-custom-marquee inline-block whitespace-nowrap"
              style={{ animationDuration }}
            >
              <span className="text-sm font-semibold tracking-wide">
                {outOfStockNames}
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  )
}
