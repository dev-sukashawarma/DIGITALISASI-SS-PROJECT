import { Card } from '@suka/design-system'
import { LayoutGrid, Loader2 } from 'lucide-react'

export default function CashierLoading() {
  return (
    <div className="flex h-screen bg-suka-cream p-4 gap-4 animate-in fade-in duration-500 overflow-hidden">
      {/* Left side: Menu Categories & Items (Shimmer Skeleton) */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Categories Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i} 
              className="h-12 min-w-[120px] rounded-2xl bg-suka-gray-200 animate-pulse border border-suka-orange/10 flex items-center justify-center relative overflow-hidden"
            >
              {/* Shimmer effect overlay */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
          ))}
        </div>

        {/* Menu Grid Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <Card key={i} className="flex flex-col h-56 rounded-3xl overflow-hidden border-suka-orange/5 bg-white relative">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
                <div className="h-32 bg-suka-gray-200 animate-pulse w-full" />
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="h-4 bg-suka-gray-200 rounded animate-pulse w-3/4 mb-2" />
                    <div className="h-3 bg-suka-gray-100 rounded animate-pulse w-1/2" />
                  </div>
                  <div className="h-5 bg-suka-gray-200 rounded animate-pulse w-1/3 mt-2" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right side: Cart Skeleton */}
      <Card className="w-96 flex flex-col bg-white rounded-3xl border-suka-orange/10 shadow-sm relative overflow-hidden hidden lg:flex">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-suka-cream/50 to-transparent z-10 pointer-events-none" />
        
        {/* Header */}
        <div className="p-5 border-b border-suka-orange/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-suka-orange/10 flex items-center justify-center animate-pulse">
                <LayoutGrid className="w-5 h-5 text-suka-orange/40" />
              </div>
              <div>
                <div className="h-5 w-24 bg-suka-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-16 bg-suka-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 p-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-16 h-16 rounded-2xl bg-suka-gray-200 animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-suka-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-1/2 bg-suka-gray-100 rounded animate-pulse mb-2" />
                <div className="h-4 w-1/4 bg-suka-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 bg-suka-gray-50 border-t border-suka-orange/10">
          <div className="flex justify-between mb-4">
            <div className="h-4 w-16 bg-suka-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-suka-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-14 w-full bg-suka-orange/20 rounded-2xl animate-pulse flex items-center justify-center">
             <Loader2 className="w-6 h-6 animate-spin text-suka-orange" />
          </div>
        </div>
      </Card>
    </div>
  )
}
