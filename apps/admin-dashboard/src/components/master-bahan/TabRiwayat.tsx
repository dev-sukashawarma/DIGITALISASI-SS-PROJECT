'use client'
import { useMemo, useState } from 'react'
import { Spinner } from '@suka/design-system'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useRiwayatMasterBahan, type FilterRiwayat } from '@/hooks/masterBahan/useRiwayatMasterBahan'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { ringkasRiwayat } from '@/lib/masterBahan/riwayat'
import { BarisKosong, BarisTabel, KepalaTabel, Kosong, LebarKolom, Lencana, Tabel, Td, Th } from './Tabel'

const JENIS: { id: FilterRiwayat['jenis']; label: string }[] = [
  { id: 'semua', label: 'Semua' }, { id: 'data', label: 'Data' },
  { id: 'harga_master', label: 'Harga master' }, { id: 'harga_vendor', label: 'Harga vendor' },
]

const LENCANA_JENIS = {
  data: { label: 'Data', nada: 'netral' },
  harga_master: { label: 'Harga master', nada: 'oranye' },
  harga_vendor: { label: 'Harga vendor', nada: 'biru' },
} as const

export function TabRiwayat() {
  const { data: bahan = [] } = useDaftarBahan()
  const { data: suppliers = [] } = useSuppliers()
  const [bahanId, setBahanId] = useState<string | null>(null)
  const [jenis, setJenis] = useState<FilterRiwayat['jenis']>('semua')
  const { rows, namaPelaku, loading, error } = useRiwayatMasterBahan({ bahanId, jenis })
  const namaBahan = useMemo(() => new Map(bahan.map((b) => [b.id, b.nama])), [bahan])
  const namaSupplier = useMemo(() => new Map(suppliers.map((s) => [s.id, s.nama])), [suppliers])

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={bahanId ?? ''}
          onChange={(e) => setBahanId(e.target.value || null)}
          aria-label="Saring bahan"
          className="min-w-[220px] rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:bg-white"
        >
          <option value="">Semua bahan</option>
          {bahan.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
        <div role="group" aria-label="Jenis perubahan" className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
          {JENIS.map((j) => (
            <button
              key={j.id}
              onClick={() => setJenis(j.id)}
              aria-pressed={jenis === j.id}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                jenis === j.id ? 'bg-white text-suka-orange shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      {error != null && <p className="text-sm text-red-600">Gagal memuat riwayat: {String((error as Error).message ?? error)}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          <p className="text-xs text-stone-500">
            {rows.length === 200 ? '200 perubahan terbaru — saring per bahan untuk melihat lebih jauh.' : `${rows.length} perubahan`}
          </p>
          <Tabel lebarMin={900}>
            <LebarKolom lebar={['13%', '20%', '37%', '12%', '18%']} />
            <KepalaTabel>
              <Th>Waktu</Th>
              <Th>Bahan</Th>
              <Th>Perubahan</Th>
              <Th>Oleh</Th>
              <Th>Alasan</Th>
            </KepalaTabel>
            <tbody>
              {rows.map((r, i) => {
                const waktu = new Date(r.changed_at)
                const lj = LENCANA_JENIS[r.jenis]
                return (
                  <BarisTabel key={`${r.changed_at}-${i}`}>
                    <Td className="align-top tabular-nums">
                      <p className="text-stone-800">{waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs text-stone-500">{waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                    </Td>
                    <Td className="align-top">
                      <p className="font-semibold text-suka-brown">
                        {r.bahan_baku_id ? namaBahan.get(r.bahan_baku_id) ?? '(bahan terhapus)' : '—'}
                      </p>
                      {r.supplier_id && (
                        <p className="truncate text-xs text-stone-500">{namaSupplier.get(r.supplier_id) ?? 'vendor'}</p>
                      )}
                      <div className="mt-1"><Lencana nada={lj.nada}>{lj.label}</Lencana></div>
                    </Td>
                    <Td className="align-top">
                      <ul className="space-y-0.5 text-stone-700">
                        {ringkasRiwayat(r).map((t, j) => <li key={j} className="break-words">{t}</li>)}
                      </ul>
                    </Td>
                    <Td className="align-top text-stone-700">
                      {r.changed_by ? namaPelaku.get(r.changed_by) ?? 'pengguna' : <span className="text-stone-500">sistem</span>}
                    </Td>
                    <Td className="align-top">
                      {r.alasan ? <p className="break-words text-stone-600">{r.alasan}</p> : <Kosong />}
                    </Td>
                  </BarisTabel>
                )
              })}
              {rows.length === 0 && <BarisKosong kolom={5} pesan="Belum ada riwayat." />}
            </tbody>
          </Tabel>
        </>
      )}
    </div>
  )
}
