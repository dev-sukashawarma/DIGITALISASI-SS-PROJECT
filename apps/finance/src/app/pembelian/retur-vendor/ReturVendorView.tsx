'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PackageX, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useDaftarReturVendor, type ReturVendor } from '@/hooks/useReturVendor'
import { bolehAjukanRetur, LABEL_ALASAN, LABEL_CARA, LABEL_STATUS, type StatusRetur } from '@/lib/returVendor/aturan'
import { rupiah, tanggalWaktu } from '@/lib/format'

type Tab = 'menunggu' | 'penyelesaian' | 'selesai' | 'semua'

const STATUS_TAB: Record<Tab, StatusRetur[] | undefined> = {
  menunggu: ['diajukan', 'disetujui'],
  penyelesaian: ['diserahkan'],
  selesai: ['selesai', 'ditolak', 'dibatalkan'],
  semua: undefined,
}

const LABEL_TAB: Record<Tab, string> = {
  menunggu: 'Menunggu persetujuan & serah',
  penyelesaian: 'Menunggu penyelesaian vendor',
  selesai: 'Selesai',
  semua: 'Semua',
}

const WARNA_STATUS: Record<StatusRetur, string> = {
  diajukan: 'bg-amber-50 text-amber-800 border-amber-200',
  disetujui: 'bg-blue-50 text-blue-800 border-blue-200',
  ditolak: 'bg-red-50 text-red-700 border-red-200',
  dibatalkan: 'bg-suka-gray-100 text-suka-gray-600 border-suka-gray-200',
  diserahkan: 'bg-orange-50 text-orange-800 border-orange-200',
  selesai: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export function ReturVendorView() {
  const { role } = useFinanceRole()
  const [tab, setTab] = useState<Tab>('menunggu')
  const { data = [], isLoading, error } = useDaftarReturVendor({ status: STATUS_TAB[tab] })

  const urut = useMemo(() => {
    const d = [...data]
    // Tab yang menunggu: paling lama di atas; selesai & semua: terbaru di atas.
    if (tab === 'selesai' || tab === 'semua') d.reverse()
    return d
  }, [data, tab])

  return (
    <div className="space-y-5 pb-12 font-sans">
      <PageHeader
        title="Retur Vendor"
        icon={PackageX}
        description="Pengembalian bahan baku dari Gudang Pusat ke vendor, dari pengajuan sampai penyelesaian."
      >
        {role && bolehAjukanRetur(role) && (
          <Link
            href="/pembelian/retur-vendor/baru"
            className="inline-flex items-center gap-2 rounded-xl bg-suka-brown px-4 py-2 text-sm font-semibold text-white hover:bg-suka-ink"
          >
            <Plus size={16} /> Ajukan retur
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-1 border-b border-suka-brown/10">
        {(Object.keys(LABEL_TAB) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'border-suka-orange text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-ink'
            }`}
          >
            {LABEL_TAB[t]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Gagal memuat retur: {error instanceof Error ? error.message : 'galat tidak dikenal'}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-suka-gray-500">Memuat…</p>
      ) : urut.length === 0 ? (
        <p className="rounded-2xl border border-suka-gray-100 bg-white p-6 text-center text-sm text-suka-gray-500">
          Belum ada retur di sini.
        </p>
      ) : (
        <ul className="divide-y divide-suka-gray-100 overflow-hidden rounded-2xl border border-suka-gray-100 bg-white">
          {urut.map((r) => (
            <BarisRetur key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BarisRetur({ r }: { r: ReturVendor }) {
  return (
    <li>
      <Link href={`/pembelian/retur-vendor/${r.id}`} className="grid gap-1 px-4 py-3 hover:bg-suka-cream/40 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-suka-gray-500">{r.nomor}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${WARNA_STATUS[r.status]}`}>
              {LABEL_STATUS[r.status]}
            </span>
            {r.cara_penyelesaian && (
              <span className="text-[11px] font-medium text-suka-gray-500">{LABEL_CARA[r.cara_penyelesaian]}</span>
            )}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-suka-ink">{r.supplier_nama}</div>
          <div className="truncate text-xs text-suka-gray-500">
            {LABEL_ALASAN[r.alasan]} · {r.items.map((i) => i.bahan_nama).join(', ')} · diajukan {tanggalWaktu(r.diajukan_at)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-suka-ink">{rupiah(r.total)}</div>
          {r.nilai_tidak_dikompensasi > 0 && (
            <div className="text-[11px] text-red-600">tak dikompensasi {rupiah(r.nilai_tidak_dikompensasi)}</div>
          )}
        </div>
      </Link>
    </li>
  )
}
