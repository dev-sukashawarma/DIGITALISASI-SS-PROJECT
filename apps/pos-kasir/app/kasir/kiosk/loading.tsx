export default function KasirKioskLoading() {
  return (
    <div className="animate-pulse space-y-6 relative min-h-[60vh] p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-8 w-72 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-48 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-12 w-28 bg-gray-200 rounded-2xl hidden sm:block"></div>
          <div className="h-12 w-48 bg-gray-200 rounded-2xl hidden sm:block"></div>
          <div className="h-12 w-56 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>

      {/* Guide / Tip Skeleton */}
      <div className="h-24 w-full bg-amber-50 rounded-2xl border border-amber-100"></div>

      {/* List Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0"></div>
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-gray-200 rounded"></div>
                  <div className="h-3 w-16 bg-gray-100 rounded"></div>
                </div>
              </div>
              <div className="h-10 w-24 bg-gray-200 rounded-xl shrink-0"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
