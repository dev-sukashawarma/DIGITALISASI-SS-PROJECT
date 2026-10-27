'use client'

import { useState } from 'react'
import { useJejakPerjalanan, useRiwayatPerjalanan } from '@/hooks/usePelacakanDriver'
import { masihAdaJejak } from '@/lib/pelacakan/jejak'
import { PanelPerjalanan } from './PanelPerjalanan'
import type { ComponentType } from 'react'
import type { PerjalananTampil, TitikJejak } from '@/lib/pelacakan/types'

const hariIniWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

const formatDurasi = (detik: number | null) => {
  if (detik == null) return null
  const j = Math.floor(detik / 3600)
  const m = Math.floor((detik % 3600) / 60)
  return j > 0 ? `${j} jam ${m} mnt` : `${m} mnt`
}

type PetaProps = { perjalanan: PerjalananTampil[]; jejak: TitikJejak[]; dipilihId: string | null }

export function RiwayatPerjalanan({ Peta }: { Peta: ComponentType<PetaProps> }) {
  const [tanggal, setTanggal] = useState(hariIniWib)
  const [dipilihId, setDipilihId] = useState<string | null>(null)
  const { perjalanan, loading } = useRiwayatPerjalanan(tanggal)
  const dipilih = perjalanan.find((p) => p.id === dipilihId) ?? null
  const bolehRute = !!dipilih && masihAdaJejak(dipilih.berangkat_at)
  const { jejak } = useJejakPerjalanan(bolehRute ? dipilihId : null)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="h-[420px] lg:h-[calc(100vh-220px)]">
        {dipilih ? (
          bolehRute ? (
            <Peta perjalanan={[dipilih]} jejak={jejak} dipilihId={dipilih.id} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-suka-brown/20 bg-white p-6 text-center text-xs font-bold text-suka-gray-500">
              Rute perjalanan ini sudah dihapus (disimpan 60 hari). Ringkasan tetap ada di panel.
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-suka-brown/20 bg-white p-6 text-center text-xs font-bold text-suka-gray-500">
            Pilih perjalanan untuk melihat rutenya.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-[11px] font-black uppercase tracking-wider text-suka-brown">
          Tanggal
          <input
            type="date"
            value={tanggal}
            max={hariIniWib()}
            onChange={(e) => {
              setTanggal(e.target.value)
              setDipilihId(null)
            }}
            className="mt-1 block w-full rounded-xl border border-suka-brown/20 bg-white px-3 py-2 text-sm font-bold text-suka-ink"
          />
        </label>

        {loading ? (
          <p className="text-xs font-bold text-suka-gray-500">Memuat…</p>
        ) : perjalanan.length === 0 ? (
          <p className="text-xs font-bold text-suka-gray-500">Tidak ada perjalanan pada tanggal ini.</p>
        ) : (
          perjalanan.map((p) => (
            <div key={p.id}>
              <PanelPerjalanan p={p} jejak={p.id === dipilihId ? jejak : []} dipilih={p.id === dipilihId} onPilih={() => setDipilihId(p.id)} />
              {p.durasi_detik != null && (
                <p className="mt-1 px-2 text-[10px] font-bold text-suka-gray-500">Durasi {formatDurasi(p.durasi_detik)}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
