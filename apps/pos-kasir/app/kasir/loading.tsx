import { Card } from '@suka/design-system'
import { LayoutGrid } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'

export default function CashierLoading() {
  return (
    <div className="flex h-screen bg-suka-cream p-4 gap-4 animate-in fade-in duration-500 overflow-hidden">
      {/* Left side: Menu Categories & Items */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Categories Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 min-w-[120px] rounded-full border border-suka-orange/10" />
          ))}
        </div>

        {/* Menu Grid Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <Card key={i} className="flex flex-col h-56 rounded-3xl overflow-hidden border-suka-orange/5 bg-white">
                <Skeleton className="h-32 w-full rounded-none" />
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <Skeleton className="h-4 w-3/4 rounded-full mb-3" />
                    <Skeleton className="h-3 w-1/2 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-1/3 rounded-full mt-2" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right side: Cart Skeleton */}
      <Card className="w-96 flex flex-col bg-white rounded-3xl border-suka-orange/10 shadow-sm overflow-hidden hidden lg:flex">
        {/* Header */}
        <div className="p-5 border-b border-suka-orange/10">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-24 rounded-full mb-2" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 p-5 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 items-center">
              <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 rounded-full mb-2.5" />
                <Skeleton className="h-3 w-1/2 rounded-full mb-2.5" />
                <Skeleton className="h-4 w-1/4 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 bg-suka-gray-50 border-t border-suka-orange/10">
          <div className="flex justify-between mb-4">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </Card>
    </div>
  )
}
