export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[50vh] flex-col space-y-4">
      <div className="w-12 h-12 border-4 border-suka-orange/30 border-t-suka-orange rounded-full animate-spin"></div>
      <p className="text-suka-brown font-medium animate-pulse">Memuat data...</p>
    </div>
  )
}
