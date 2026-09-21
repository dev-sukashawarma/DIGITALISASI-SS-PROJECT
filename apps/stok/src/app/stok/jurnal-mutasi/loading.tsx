import { Loader2 } from 'lucide-react'

export default function JurnalMutasiLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#701604] mx-auto" />
        <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">
          Memuat Laporan Jurnal & Mutasi Bahan...
        </p>
      </div>
    </div>
  )
}
