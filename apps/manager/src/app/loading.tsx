export default function DashboardLoading() {
  return (
    <div className="space-y-6 w-full pb-10 animate-pulse">
      {/* 🌟 Header & Filter Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-suka-brown/10 shadow-[0_4px_24px_rgba(44,24,16,0.03)]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-48 bg-suka-brown/10 rounded-xl" />
            <div className="h-5 w-28 bg-suka-orange/20 rounded-full" />
          </div>
          <div className="h-4 w-72 bg-suka-brown/5 rounded-lg" />
        </div>
        <div className="h-10 w-80 bg-suka-brown/5 rounded-2xl" />
      </div>

      {/* 📊 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-3xl border border-suka-brown/10 shadow-[0_4px_24px_rgba(44,24,16,0.03)] space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-suka-brown/10 rounded-md" />
              <div className="h-8 w-8 bg-suka-brown/10 rounded-xl" />
            </div>
            <div className="h-8 w-36 bg-suka-brown/15 rounded-lg" />
            <div className="h-3 w-28 bg-suka-brown/5 rounded-md" />
          </div>
        ))}
      </div>

      {/* 📋 Content Grid Skeleton (Ranking + Status Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking List Skeleton */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-suka-brown/10 shadow-[0_4px_24px_rgba(44,24,16,0.03)] lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-suka-brown/10">
            <div className="h-5 w-44 bg-suka-brown/10 rounded-md" />
            <div className="h-4 w-20 bg-suka-brown/5 rounded-md" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-2.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-suka-brown/10" />
                    <div className="h-4 w-32 bg-suka-brown/15 rounded-md" />
                    <div className="h-4 w-16 bg-suka-brown/5 rounded-full" />
                  </div>
                  <div className="h-4 w-24 bg-suka-brown/15 rounded-md" />
                </div>
                <div className="w-full h-2 bg-suka-brown/5 rounded-full" />
                <div className="flex justify-between pt-1">
                  <div className="h-3 w-40 bg-suka-brown/5 rounded-md" />
                  <div className="h-3 w-20 bg-suka-brown/5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Feed Skeleton */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-suka-brown/10 shadow-[0_4px_24px_rgba(44,24,16,0.03)] lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-suka-brown/10">
            <div className="h-5 w-32 bg-suka-brown/10 rounded-md" />
            <div className="h-4 w-16 bg-suka-brown/5 rounded-md" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 bg-suka-brown/[0.02] rounded-2xl space-y-2 border border-suka-brown/5">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-suka-brown/10 rounded-md" />
                  <div className="h-4 w-12 bg-suka-orange/20 rounded-full" />
                </div>
                <div className="h-3 w-36 bg-suka-brown/5 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
