import { Loader2, Sparkles } from 'lucide-react'

export default function Loading() {
  return (
    <div className="w-full h-[70vh] flex flex-col items-center justify-center animate-in fade-in duration-300 font-sans">
      <div className="relative group">
        <div className="w-20 h-20 bg-suka-orange/20 rounded-full animate-ping absolute inset-0 m-auto"></div>
        <div className="w-20 h-20 bg-white/80 backdrop-blur-md border border-suka-brown/10 rounded-3xl flex items-center justify-center relative z-10 shadow-xl shadow-suka-orange/5">
          <Loader2 className="w-8 h-8 text-suka-orange animate-spin absolute" />
          <Sparkles className="w-4 h-4 text-suka-brown" />
        </div>
      </div>
      <h3 className="mt-6 font-display font-bold text-2xl text-suka-brown tracking-wide">
        Mengambil Data...
      </h3>
      <p className="text-suka-gray-500 text-sm font-medium mt-1">
        SukaFinance sedang memuat halaman
      </p>
    </div>
  )
}
