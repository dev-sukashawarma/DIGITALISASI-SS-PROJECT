'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabDataBahan } from './TabDataBahan'
import { TabHarga } from './TabHarga'
import { TabVendor } from './TabVendor'
import { TabRiwayat } from './TabRiwayat'

const TAB = [
  { id: 'data', label: 'Data Bahan' },
  { id: 'harga', label: 'Harga' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'riwayat', label: 'Riwayat' },
] as const
type IdTab = (typeof TAB)[number]['id']

export function MasterBahanPage() {
  const router = useRouter()
  const params = useSearchParams()
  const diminta = params.get('tab')
  const aktif: IdTab = TAB.some((t) => t.id === diminta) ? (diminta as IdTab) : 'data'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Master Bahan Baku</h1>
        <p className="text-sm text-gray-500">Satu tempat untuk data bahan, harga, vendor, dan riwayat perubahannya.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TAB.map((t) => (
          <button
            key={t.id}
            onClick={() => router.replace(`/dashboard/bahan-baku?tab=${t.id}`)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-bold transition-colors ${
              aktif === t.id ? 'border-b-2 border-suka-orange text-suka-orange' : 'text-gray-500 hover:text-suka-brown'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {aktif === 'data' && <TabDataBahan />}
      {aktif === 'harga' && <TabHarga />}
      {aktif === 'vendor' && <TabVendor />}
      {aktif === 'riwayat' && <TabRiwayat />}
    </div>
  )
}
