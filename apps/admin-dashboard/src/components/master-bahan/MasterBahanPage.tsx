'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
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

  // Kueri yang sama dipakai tab di bawahnya (cache React Query), jadi angka ini gratis.
  const { data: bahan = [] } = useDaftarBahan()
  const { data: status = [] } = useStatusHarga()
  const jumlah: Partial<Record<IdTab, { nilai: number; perhatian?: boolean }>> = {
    data: { nilai: bahan.filter((b) => b.is_active).length },
    harga: { nilai: status.filter((s) => s.status === 'belum_dikonfirmasi').length, perhatian: true },
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-suka-brown">Master Bahan Baku</h1>
          <p className="text-[13px] text-stone-500">Data bahan, harga, vendor, dan riwayat perubahannya di satu tempat.</p>
        </div>
      </div>

      <nav aria-label="Bagian master bahan" className="flex gap-0.5 overflow-x-auto border-b border-stone-200">
        {TAB.map((t) => {
          const j = jumlah[t.id]
          const dipilih = aktif === t.id
          return (
            <button
              key={t.id}
              onClick={() => router.replace(`/dashboard/bahan-baku?tab=${t.id}`)}
              aria-current={dipilih ? 'page' : undefined}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-bold transition-colors ${
                dipilih ? 'border-suka-orange text-suka-brown' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              {t.label}
              {j && j.nilai > 0 && (
                <span className={`rounded px-1.5 font-mono text-[11px] tabular-nums ${
                  j.perhatian ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>
                  {j.nilai}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {aktif === 'data' && <TabDataBahan />}
      {aktif === 'harga' && <TabHarga />}
      {aktif === 'vendor' && <TabVendor />}
      {aktif === 'riwayat' && <TabRiwayat />}
    </div>
  )
}
