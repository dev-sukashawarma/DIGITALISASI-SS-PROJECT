export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs animate-pulse">
          Memuat Persetujuan...
        </p>
      </div>
    </div>
  )
}
