'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/** Pengganti halaman 500: dipakai bila data utama Ringkasan Bisnis gagal dimuat
 * (mis. database sedang sibuk). Menu & navigasi tetap bisa dipakai. */
export default function DashboardLoadError() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-2xl p-6 text-center shadow-2xs">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h2 className="font-bold text-suka-ink text-lg">Data Ringkasan Bisnis gagal dimuat</h2>
      <p className="text-sm text-suka-gray-600 mt-1">
        Database sedang sibuk atau koneksi terputus. Coba lagi beberapa saat.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-suka-orange text-white font-bold text-sm disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Memuat…' : 'Coba lagi'}
      </button>
      <a
        href="/dashboard/owner"
        className="inline-flex items-center px-4 py-2 rounded-xl border border-suka-gray-200 text-suka-brown font-bold text-sm hover:bg-suka-gray-50"
      >
        Lihat data kemarin
      </a>
      </div>
    </div>
  )
}
