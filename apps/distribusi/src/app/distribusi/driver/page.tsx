'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { PanelPerjalanan } from '@/components/pelacakan/PanelPerjalanan'
import { RiwayatPerjalanan } from '@/components/pelacakan/RiwayatPerjalanan'
import { useJejakPerjalanan, usePelacakanRealtime, usePerjalananAktif } from '@/hooks/usePelacakanDriver'
import { bisaLacakDriver } from '@/lib/peran'

// Leaflet menyentuh window → tanpa SSR.
const PetaDriver = dynamic(() => import('@/components/pelacakan/PetaDriver'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-suka-brown/5" />,
})

export default function PelacakanDriverPage() {
  const { outletStaff, loading: authLoading } = useAuth()
  const boleh = bisaLacakDriver(outletStaff?.role)
  const [tab, setTab] = useState<'live' | 'riwayat'>('live')
  const [dipilihId, setDipilihId] = useState<string | null>(null)

  usePelacakanRealtime(boleh)
  const { perjalanan, loading } = usePerjalananAktif(boleh)
  const { jejak } = useJejakPerjalanan(tab === 'live' ? dipilihId : null)

  // Satu driver berjalan → langsung dipilih agar rutenya tampil.
  useEffect(() => {
    if (!dipilihId && perjalanan.length === 1) setDipilihId(perjalanan[0].id)
    if (dipilihId && perjalanan.length > 0 && !perjalanan.some((p) => p.id === dipilihId)) setDipilihId(null)
  }, [perjalanan, dipilihId])

  if (authLoading) return null
  if (!boleh) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fff8f1] px-6 text-center">
        <p className="text-sm font-bold text-suka-brown">Halaman ini hanya untuk tim pusat.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-xl border border-suka-brown/15 bg-white p-2 text-suka-brown" aria-label="Kembali">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-black text-suka-ink">Pelacakan Driver</h1>
            <p className="text-[11px] font-bold text-suka-gray-500">Posisi driver selama mengantar & status tiba tiap surat jalan</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-suka-brown/15 bg-white p-1">
          {(['live', 'riwayat'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wider ${
                tab === t ? 'bg-suka-orange text-white' : 'text-suka-brown'
              }`}
            >
              {t === 'live' ? 'Live' : 'Riwayat'}
            </button>
          ))}
        </div>
      </header>

      {tab === 'riwayat' ? (
        <RiwayatPerjalanan Peta={PetaDriver} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[420px] lg:h-[calc(100vh-140px)]">
            <PetaDriver perjalanan={perjalanan} jejak={jejak} dipilihId={dipilihId} />
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-xs font-bold text-suka-gray-500">Memuat…</p>
            ) : perjalanan.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-suka-brown/20 bg-white p-6 text-center text-xs font-bold text-suka-gray-500">
                Tidak ada driver yang sedang mengantar.
              </div>
            ) : (
              perjalanan.map((p) => (
                <PanelPerjalanan
                  key={p.id}
                  p={p}
                  jejak={p.id === dipilihId ? jejak : []}
                  dipilih={p.id === dipilihId}
                  onPilih={() => setDipilihId(p.id === dipilihId ? null : p.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
