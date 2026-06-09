export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-suka-cream">
      <div className="text-center">
        <div className="inline-block border-4 border-suka-gray-300 border-t-suka-orange rounded-full w-12 h-12 animate-spin"></div>
        <p className="mt-4 text-suka-brown font-medium">Memuat...</p>
      </div>
    </div>
  )
}
