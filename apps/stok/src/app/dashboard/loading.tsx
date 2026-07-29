import { Card } from '@suka/design-system/src/components/Card'
import { PackageSearch, Loader2 } from 'lucide-react'

export default function StokDashboardLoading() {
  return (
    <div className="flex flex-col h-full bg-suka-cream p-4 sm:p-6 gap-6 animate-in fade-in duration-500 overflow-hidden">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="h-8 w-48 bg-suka-gray-200 rounded-lg animate-pulse mb-2 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
          <div className="h-4 w-64 bg-suka-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-suka-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 rounded-3xl border-suka-orange/10 bg-white relative overflow-hidden">
             <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent z-10 pointer-events-none" />
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-suka-gray-100 animate-pulse shrink-0" />
               <div className="flex-1">
                 <div className="h-3 w-1/2 bg-suka-gray-100 rounded animate-pulse mb-2" />
                 <div className="h-6 w-3/4 bg-suka-gray-200 rounded animate-pulse" />
               </div>
             </div>
          </Card>
        ))}
      </div>

      {/* Main Table Skeleton */}
      <Card className="flex-1 rounded-3xl border-suka-orange/10 bg-white overflow-hidden flex flex-col relative">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10 pointer-events-none" />
        
        {/* Table Toolbar */}
        <div className="p-5 border-b border-suka-orange/5 flex gap-4">
           <div className="h-10 flex-1 bg-suka-gray-100 rounded-xl animate-pulse" />
           <div className="h-10 w-32 bg-suka-gray-100 rounded-xl animate-pulse" />
        </div>

        {/* Table Rows */}
        <div className="flex-1 p-5 space-y-4">
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <div key={i} className="flex items-center gap-4 py-2 border-b border-suka-gray-50 pb-4">
                <div className="w-10 h-10 rounded-lg bg-suka-gray-100 animate-pulse shrink-0 flex items-center justify-center">
                   <PackageSearch className="w-5 h-5 text-suka-gray-300" />
                </div>
                <div className="flex-1">
                  <div className="h-4 w-1/3 bg-suka-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-1/4 bg-suka-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-suka-orange/10 rounded-full animate-pulse" />
                <div className="h-8 w-24 bg-suka-gray-100 rounded-lg animate-pulse" />
             </div>
           ))}
        </div>
        
        {/* Loading Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-suka-orange/20 z-20">
           <Loader2 className="w-4 h-4 text-suka-orange animate-spin" />
           <span className="text-xs font-bold text-suka-brown uppercase tracking-wider">Memuat Data Stok...</span>
        </div>
      </Card>
    </div>
  )
}
