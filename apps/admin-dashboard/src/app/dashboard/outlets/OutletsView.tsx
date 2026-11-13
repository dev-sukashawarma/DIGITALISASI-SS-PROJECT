'use client'

import { useMemo, useState, useEffect, useCallback, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  X,
  Store,
  Users,
  Clock,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useManagedOutlets } from '@/hooks/useManagedOutlets'
import { useOutletMutations } from '@/hooks/useOutletMutations'
import { filterOutlets } from '@/lib/filterOutlets'
import { MANAGED_OUTLETS_KEY, withPinned } from '@/lib/managedOutlets'
import { OutletFilters } from '@/components/OutletFilters'
import { OutletTabs } from '@/components/outlet/OutletTabs'
import { OutletTable } from '@/components/OutletTable'
import { OutletForm } from '@/components/OutletForm'
import { DeleteOutletDialog } from '@/components/DeleteOutletDialog'
import { DialogTutupOutlet } from '@/components/penutupan-outlet/DialogTutupOutlet'
import type { Outlet, OutletFilterValues, OutletFormValues } from '@/lib/types'

const EMPTY_FILTER: OutletFilterValues = { search: '', status: '', type: 'internal' }
const NO_PIN: ReadonlySet<string> = new Set()

function toFormValues(o: Outlet): OutletFormValues {
  return {
    name: o.name,
    slug: o.slug,
    address: o.address ?? '',
    lat: o.lat,
    lng: o.lng,
    type: o.type,
    status: o.status ?? (o.is_active ? 'active' : 'inactive'),
    is_active: o.is_active,
    marquee_warning_threshold: o.marquee_warning_threshold,
    open_hour: o.open_hour ? o.open_hour.slice(0, 5) : '14:00',
    close_hour: o.close_hour ? o.close_hour.slice(0, 5) : '22:00',
    phone: o.phone ?? '',
    region: o.region ?? '',
    bank_name: o.bank_name ?? '',
    bank_account_number: o.bank_account_number ?? '',
    bank_account_name: o.bank_account_name ?? '',
    requires_korlap_review: o.requires_korlap_review ?? true,
  }
}

export default function OutletsPage() {
  const router = useRouter()
  const { data: outlets = [], isLoading } = useManagedOutlets()
  const { create, update, softDelete, hardDelete, countRefs } = useOutletMutations()
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  // Tanggal penjualan pertama per outlet — cadangan "mulai operasi" untuk outlet
  // yang belum punya tanggal grand opening / go-live.
  const { data: tanggalPenjualan } = useQuery({
    queryKey: ['outlet-tanggal-penjualan', outlets.map((o) => o.id).join(',')],
    enabled: outlets.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const hasil: { pertama: Record<string, string>; terakhir: Record<string, string> } = {
        pertama: {},
        terakhir: {},
      }
      // Penjualan terakhir hanya dicari untuk outlet nonaktif (penanda tanggal nonaktif).
      await Promise.all(
        outlets
          .filter((o) => (o.type === 'internal' || o.type === 'mitra') && (o.status === 'inactive' || (!o.status && !o.is_active)))
          .map(async (o) => {
            const { data } = await supabase
              .from('orders')
              .select('created_at')
              .eq('outlet_id', o.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (data?.created_at) hasil.terakhir[o.id] = data.created_at
          })
      )
      await Promise.all(
        outlets
          .filter((o) => (o.type === 'internal' || o.type === 'mitra') && o.status !== 'pending')
          .map(async (o) => {
            const { data } = await supabase
              .from('orders')
              .select('created_at')
              .eq('outlet_id', o.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle()
            if (data?.created_at) hasil.pertama[o.id] = data.created_at
          })
      )
      return hasil
    },
  })

  const [mounted, setMounted] = useState(false)
  const [filter, setFilterState] = useState<OutletFilterValues>(EMPTY_FILTER)
  // Outlet yang baru diubah/dibuat tetap tampil di filter saat ini walau statusnya
  // tak lagi cocok (mis. diaktifkan dari tab Pending) — tidak ada baris yang
  // "lenyap" dan tab tidak dipindah paksa. Pin lepas saat admin mengganti filter.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(NO_PIN)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [deleting, setDeleting] = useState<Outlet | null>(null)
  const [menutup, setMenutup] = useState<Outlet | null>(null)

  const setFilter = useCallback((next: SetStateAction<OutletFilterValues>) => {
    setPinned(NO_PIN)
    setFilterState(next)
  }, [])
  const pin = (id: string) => setPinned((prev) => new Set(prev).add(id))

  useEffect(() => {
    setMounted(true)
  }, [])

  // Perubahan dari tab/admin lain: cukup tandai basi, React Query yang refetch
  // (sekali) — jangan invalidate + refetch ganda.
  useEffect(() => {
    const channel = supabase
      .channel('realtime_admin_outlets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlets' }, () => {
        qc.invalidateQueries({ queryKey: MANAGED_OUTLETS_KEY })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, qc])

  const rows = useMemo(
    () => withPinned(filterOutlets(outlets, filter), outlets, pinned),
    [outlets, filter, pinned]
  )

  // Lokasi Sistem (gudang, kantor, marketplace, sistem, tes) bukan outlet:
  // dan outlet nonaktif tidak ikut hitungan kartu.
  const stats = useMemo(() => {
    const nonaktif = (o: Outlet) => o.status === 'inactive' || (!o.status && !o.is_active)
    const ops = outlets.filter((o) => (o.type === 'internal' || o.type === 'mitra') && !nonaktif(o))
    const isActive = (o: Outlet) => o.status === 'active' || (!o.status && o.is_active)
    const grup = (tipe: 'internal' | 'mitra') => {
      const g = ops.filter((o) => o.type === tipe)
      return {
        total: g.length,
        active: g.filter(isActive).length,
        pending: g.filter((o) => o.status === 'pending').length,
      }
    }
    return {
      total: ops.length,
      active: ops.filter(isActive).length,
      pending: ops.filter((o) => o.status === 'pending').length,
      internal: grup('internal'),
      mitra: grup('mitra'),
      sistem: outlets.filter((o) => o.type !== 'internal' && o.type !== 'mitra').length,
      penutupan: outlets.filter((o) => nonaktif(o) && o.alasan_tutup && !o.penutupan_selesai_at).length,
    }
  }, [outlets])

  function handleCreate(values: OutletFormValues) {
    create.mutate(values, {
      onSuccess: (created) => {
        toast.success(`Outlet ${values.name} berhasil dibuat`)
        setShowForm(false)
        if (created) pin(created.id)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: OutletFormValues) {
    if (!editing) return
    pin(editing.id)
    update.mutate(
      { id: editing.id, ...values },
      {
        onSuccess: () => {
          toast.success('Perubahan disimpan')
          setEditing(null)
        },
        onError: (e: any) => toast.error(e.message),
      }
    )
  }

  function handleToggleActive(o: Outlet) {
    // Outlet internal/mitra ditutup lewat wizard (tanggal + alasan, papan Penutupan).
    // Yang nonaktif tidak sampai ke sini: tabel menautkannya ke papan Penutupan.
    if (o.type === 'internal' || o.type === 'mitra') {
      setMenutup(o)
      return
    }
    // Lokasi lain: Nonaktif/Aktifkan hanya mengubah status — tetap ada di daftar.
    // Menghapus (menyembunyikan) outlet hanya lewat tombol Hapus.
    pin(o.id)
    const aktifkan = !o.is_active
    update.mutate(
      { id: o.id, ...toFormValues(o), status: aktifkan ? 'active' : 'inactive', is_active: aktifkan },
      {
        onSuccess: () => toast.success(`${o.name} ${aktifkan ? 'diaktifkan' : 'dinonaktifkan'}`),
        onError: (e: any) => toast.error(e.message),
      }
    )
  }

  function handleSoftDelete() {
    if (!deleting) return
    softDelete.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} dihapus — data masa lalunya tetap tersimpan`)
        setDeleting(null)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleHardDelete() {
    if (!deleting) return
    hardDelete.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} dihapus — data masa lalunya tetap tersimpan`)
        setDeleting(null)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-suka-gray-500">
        <Spinner />
        <p className="mt-3 text-xs font-medium">Memuat data outlet...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-suka-orange flex items-center justify-center text-white shadow-sm shadow-orange-500/20 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-suka-ink tracking-tight">Outlet</h1>
            <p className="text-xs sm:text-sm text-suka-gray-500">
              Kelola cabang, koordinat GPS presensi, dan jam operasional outlet
            </p>
          </div>
        </div>

        <Button
          // Outlet baru selalu lewat Wizard Pembukaan Outlet (status Persiapan,
          // checklist, Go-Live). Form di halaman ini hanya untuk mengubah outlet.
          onClick={() => router.push('/dashboard/pembukaan-outlet/baru')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-suka-orange hover:bg-orange-600 text-white font-bold px-4 py-2.5 shadow-sm shadow-orange-500/20 transition-all min-h-[44px]"
        >
          <Plus size={18} /> Tambah Outlet
        </Button>
      </div>

      <OutletTabs aktif="semua" jumlahPersiapan={stats.pending} jumlahPenutupan={stats.penutupan} />

      {/* ── KPI Stat Cards (hanya outlet internal & mitra; Sistem tidak dihitung) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            key: 'all', label: 'Total Outlet', Icon: Store, value: stats.total, unit: 'cabang',
            note: `${stats.active} aktif • ${stats.pending} persiapan`,
            on: filter.type === 'all' && !filter.status,
            go: () => setFilter((p) => ({ ...p, status: '', type: 'all' })),
            ring: 'bg-orange-50/60 border-suka-orange ring-2 ring-suka-orange/20',
            icon: 'bg-orange-100/70 text-suka-orange', num: 'text-suka-ink', noteCls: 'text-suka-gray-500',
          },
          {
            key: 'internal', label: 'Outlet Internal', Icon: Store, value: stats.internal.total, unit: 'cabang',
            note: `${stats.internal.active} aktif • ${stats.internal.pending} persiapan`,
            on: filter.type === 'internal' && !filter.status,
            go: () => setFilter((p) => ({ ...p, status: '', type: 'internal' })),
            ring: 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20',
            icon: 'bg-emerald-100/70 text-emerald-600', num: 'text-emerald-700', noteCls: 'text-emerald-600',
          },
          {
            key: 'mitra', label: 'Outlet Mitra', Icon: Users, value: stats.mitra.total, unit: 'kemitraan',
            note: `${stats.mitra.active} aktif • ${stats.mitra.pending} persiapan`,
            on: filter.type === 'mitra' && !filter.status,
            go: () => setFilter((p) => ({ ...p, status: '', type: 'mitra' })),
            ring: 'bg-cyan-50/60 border-cyan-500 ring-2 ring-cyan-500/20',
            icon: 'bg-cyan-100/70 text-cyan-600', num: 'text-cyan-800', noteCls: 'text-cyan-700',
          },
          {
            key: 'pending', label: 'Persiapan', Icon: Clock, value: stats.pending, unit: 'outlet',
            note: 'Dikecualikan dari produksi',
            on: filter.status === 'pending',
            go: () => setFilter((p) => ({ ...p, type: 'all', status: p.status === 'pending' ? '' : 'pending' })),
            ring: 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20',
            icon: 'bg-amber-100/80 text-amber-700', num: 'text-amber-700', noteCls: 'text-amber-700',
          },
        ].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.go}
            className={`text-left p-4 rounded-2xl border transition-all ${
              c.on ? c.ring : 'bg-white border-suka-gray-200/80 hover:border-suka-orange/50 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">{c.label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.icon}`}>
                <c.Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${c.num}`}>{c.value}</span>
              <span className="text-xs text-suka-gray-500 font-medium">{c.unit}</span>
            </div>
            <p className={`mt-1 text-[11px] truncate font-medium ${c.noteCls}`}>{c.note}</p>
          </button>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <OutletFilters
        value={filter}
        onChange={setFilter}
        totalCount={filter.type === 'sistem' ? stats.sistem : filter.type === 'all' ? outlets.length : stats.total}
        filteredCount={rows.length}
      />

      {/* ── Outlet Table & Mobile Cards ── */}
      <OutletTable
        rows={rows}
        onEdit={(o) => {
          setShowForm(false)
          setEditing(o)
        }}
        onToggleActive={handleToggleActive}
        onDelete={setDeleting}
        onResetFilter={() => setFilter(EMPTY_FILTER)}
        penjualanPertama={tanggalPenjualan?.pertama}
        penjualanTerakhir={tanggalPenjualan?.terakhir}
      />

      {/* ── Outlet Form Modal (Responsive Bottom Sheet on Mobile) ── */}
      {mounted && (showForm || editing) &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 lg:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowForm(false)
                setEditing(null)
              }
            }}
          >
            <div className="w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden border border-suka-gray-100 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
              {/* Grab handle indicator for mobile bottom sheet */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-suka-cream/30 shrink-0">
                <div className="w-10 h-1 bg-suka-gray-300 rounded-full" />
              </div>

              <div className="flex items-center justify-between border-b border-suka-gray-100 px-4 py-3 sm:px-6 sm:py-4 bg-suka-cream/30 shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-suka-ink">
                  {editing ? `Edit — ${editing.name}` : 'Outlet Baru'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                  }}
                  className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  aria-label="Tutup"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {editing ? (
                  <OutletForm
                    isEdit
                    submitting={update.isPending}
                    onSubmit={handleUpdate}
                    initial={toFormValues(editing)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <OutletForm
                    isEdit={false}
                    submitting={create.isPending}
                    onSubmit={handleCreate}
                    onCancel={() => setShowForm(false)}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {menutup && (
        <DialogTutupOutlet
          outlet={{ id: menutup.id, name: menutup.name, createdAt: menutup.created_at ?? new Date(0).toISOString() }}
          onTutup={() => setMenutup(null)}
        />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleting && (
        <DeleteOutletDialog
          outlet={deleting}
          countRefs={countRefs}
          onSoftDelete={handleSoftDelete}
          onHardDelete={handleHardDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
