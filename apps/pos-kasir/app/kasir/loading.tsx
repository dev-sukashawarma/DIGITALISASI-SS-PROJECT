import { Loader2 } from 'lucide-react'

export default function KasirOrdersLoading() {
  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-3">
          <div className="h-8 w-64 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-40 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-24 bg-gray-200 rounded-xl"></div>
          <div className="h-11 w-32 bg-gray-200 rounded-xl"></div>
        </div>
      </div>

      {/* Board Skeleton */}
      <div className="flex-1 flex overflow-hidden gap-4 pb-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="w-[320px] shrink-0 flex flex-col bg-gray-50/50 rounded-2xl border border-gray-100 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-24 bg-gray-200 rounded-lg"></div>
              <div className="h-6 w-8 bg-gray-200 rounded-full"></div>
            </div>
            
            <div className="space-y-3">
              {[1, 2].map((card) => (
                <div key={card} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="h-5 w-16 bg-gray-200 rounded"></div>
                    <div className="h-5 w-20 bg-gray-100 rounded"></div>
                  </div>
                  <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
                  <div className="pt-3 flex justify-between items-center border-t border-gray-50 mt-2">
                    <div className="h-4 w-12 bg-gray-200 rounded"></div>
                    <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
