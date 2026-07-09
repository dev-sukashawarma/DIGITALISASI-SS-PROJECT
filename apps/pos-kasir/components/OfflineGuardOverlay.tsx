'use client'

import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/lib/useNetworkStatus'

/**
 * Overlay untuk fitur yang MUSTAHIL jalan offline (realtime presence, upload
 * gambar). Halaman tetap kebuka & bisa dilihat, tapi ditutup overlay ini saat
 * offline supaya user tak melakukan aksi yang pasti gagal.
 */
export default function OfflineGuardOverlay({
  title = 'Fitur ini butuh internet',
  message = 'Sambungkan perangkat ke internet untuk memakai fitur ini. Halaman lain (Order, Petty Cash, Histori) tetap bisa dipakai offline.',
}: {
  title?: string
  message?: string
}) {
  const isOnline = useNetworkStatus()
  if (isOnline) return null

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#fff8f1]/85 backdrop-blur-sm text-center p-6">
      <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mb-4">
        <WifiOff size={32} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1.5">{title}</h2>
      <p className="text-sm text-gray-600 max-w-sm">{message}</p>
    </div>
  )
}
