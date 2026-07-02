import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-orange-50 p-8 flex justify-center border-b border-orange-100">
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center animate-bounce shadow-inner">
            <FileQuestion className="w-12 h-12 text-orange-600" />
          </div>
        </div>
        <div className="p-8 text-center">
          <h1 className="text-6xl font-black text-gray-900 mb-2">404</h1>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Halaman Tidak Ditemukan</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Maaf, halaman atau rute yang Anda tuju tidak tersedia, telah dipindahkan, atau Anda tidak memiliki akses ke halaman tersebut.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <Home className="w-5 h-5" />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
