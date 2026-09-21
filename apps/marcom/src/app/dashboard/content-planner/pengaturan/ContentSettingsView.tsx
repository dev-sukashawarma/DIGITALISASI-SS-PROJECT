'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  Settings2,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Clapperboard,
  Hash,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import {
  SerializedContentType,
  createContentType,
  updateContentType,
  deleteContentType,
} from '@/app/actions/content'

interface ContentSettingsViewProps {
  initialTypes: SerializedContentType[]
  totalContents: number
  userRole: string
}

export default function ContentSettingsView({
  initialTypes,
  totalContents,
  userRole,
}: ContentSettingsViewProps) {
  const [types, setTypes] = useState<SerializedContentType[]>(initialTypes)
  const [search, setSearch] = useState('')
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [editingType, setEditingType] = useState<SerializedContentType | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SerializedContentType | null>(null)

  // Filtered types
  const filteredTypes = useMemo(() => {
    return types.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase().trim())
    )
  }, [types, search])

  // Stats calculation
  const mostUsedType = useMemo(() => {
    if (types.length === 0) return null
    return [...types].sort((a, b) => (b.contentCount || 0) - (a.contentCount || 0))[0]
  }, [types])

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    setErrorMessage(null)
    startTransition(async () => {
      const res = await createContentType(newTypeName.trim())
      if (res?.error) {
        setErrorMessage(res.error)
      } else if (res?.data) {
        setTypes((prev) => [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)))
        setNewTypeName('')
        setIsCreateOpen(false)
        setStatusNotice(`Tipe konten "${res.data.name}" berhasil ditambahkan!`)
        setTimeout(() => setStatusNotice(null), 3500)
      }
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingType || !editTypeName.trim()) return

    setErrorMessage(null)
    startTransition(async () => {
      const res = await updateContentType(editingType.id, editTypeName.trim())
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setTypes((prev) =>
          prev
            .map((t) => (t.id === editingType.id ? { ...t, name: editTypeName.trim() } : t))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        setEditingType(null)
        setEditTypeName('')
        setStatusNotice('Tipe konten berhasil diperbarui!')
        setTimeout(() => setStatusNotice(null), 3500)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setErrorMessage(null)
    startTransition(async () => {
      const res = await deleteContentType(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
        setDeleteTarget(null)
      } else {
        setTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id))
        setStatusNotice(`Tipe konten "${deleteTarget.name}" berhasil dihapus!`)
        setDeleteTarget(null)
        setTimeout(() => setStatusNotice(null), 3500)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#D9480F] uppercase tracking-wider bg-[#FFF4ED] px-2.5 py-0.5 rounded-full border border-[#D9480F]/20">
              Master Data Taksonomi
            </span>
            <span className="text-xs text-stone-500">• Konten Editorial</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1715] mt-1 tracking-tight">
            Pengaturan & Tipe Konten
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Kelola klasifikasi tipe konten internal yang dapat dipilih tim Marcom saat merencanakan dan menganalisis video.
          </p>
        </div>

        <button
          onClick={() => {
            setNewTypeName('')
            setErrorMessage(null)
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Tipe Konten</span>
        </button>
      </div>

      {/* Top Tab Switcher (4 Sub-Tabs) */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap">
        <Link
          href="/dashboard/content-planner"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <CalendarDays className="w-4 h-4 text-stone-400" />
          <span>Rencana Konten</span>
        </Link>

        <Link
          href="/dashboard/content-planner/metrik-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <BarChart3 className="w-4 h-4 text-stone-400" />
          <span>Metrik Data</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono">
            {totalContents}
          </span>
        </Link>

        <Link
          href="/dashboard/content-planner/referensi-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60 cursor-pointer"
        >
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span>Referensi Data</span>
        </Link>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <Settings2 className="w-4 h-4" />
          <span>Pengaturan Konten</span>
        </div>
      </div>

      {/* Feedback Alerts */}
      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{statusNotice}</span>
          </div>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Executive Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Tipe Konten */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Master Tipe
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#1A1715]">
              {types.length}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">Klasifikasi konten terdaftar</p>
          </div>
        </div>

        {/* Total Konten Terhubung */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Konten Aktif
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clapperboard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#1A1715]">
              {totalContents}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">Video & postingan dipublikasikan</p>
          </div>
        </div>

        {/* Tipe Paling Aktif */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Tipe Terbanyak Dipakai
            </span>
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-black text-[#1A1715] truncate">
              {mostUsedType?.name || '-'}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {mostUsedType ? `${mostUsedType.contentCount || 0} konten menggunakan tipe ini` : 'Belum ada konten'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Bento Container */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-[#EFE8DE] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari tipe konten..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
              />
            </div>
            <span className="text-xs text-stone-500 font-medium whitespace-nowrap">
              {filteredTypes.length} dari {types.length} tipe
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] text-stone-500">
              Sinkron otomatis dengan dropdown saat input konten
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#EFE8DE] text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Nama Tipe Konten</th>
                <th className="py-3 px-4 text-center">Jumlah Konten</th>
                <th className="py-3 px-4">Tanggal Dibuat</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE] text-xs sm:text-sm">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-8 h-8 stroke-[1.5] text-stone-300" />
                      <p className="font-bold text-stone-600">Tidak ada tipe konten yang ditemukan</p>
                      <p className="text-xs text-stone-400 max-w-sm">
                        Coba gunakan kata kunci pencarian lain atau tambahkan tipe konten baru.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTypes.map((t, idx) => {
                  const hasUsage = (t.contentCount || 0) > 0
                  return (
                    <tr key={t.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-stone-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/20">
                            {t.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            hasUsage
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Clapperboard className="w-3 h-3" />
                          <span>{t.contentCount || 0} Konten</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-500 font-mono">
                        {new Date(t.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingType(t)
                              setEditTypeName(t.name)
                              setErrorMessage(null)
                            }}
                            title="Ubah Nama"
                            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setDeleteTarget(t)
                              setErrorMessage(null)
                            }}
                            title={hasUsage ? 'Masih digunakan oleh konten' : 'Hapus'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasUsage
                                ? 'text-stone-300 hover:text-red-400 hover:bg-red-50/50'
                                : 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden">
            <div className="p-6 border-b border-[#EFE8DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#D9480F] uppercase tracking-wider">
                  Master Data
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] mt-0.5">
                  Tambah Tipe Konten Baru
                </h2>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">
                  Nama Tipe Konten <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Contoh: Behind The Scene, Food Challenge, dsb"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
                <p className="text-[11px] text-stone-500 mt-1.5">
                  Tipe ini akan langsung muncul di pilihan dropdown modal Tambah Konten.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTypeName.trim()}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Tipe Konten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden">
            <div className="p-6 border-b border-[#EFE8DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#D9480F] uppercase tracking-wider">
                  Edit Master Data
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] mt-0.5">
                  Ubah Nama Tipe Konten
                </h2>
              </div>
              <button
                onClick={() => setEditingType(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">
                  Nama Tipe Konten <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editTypeName}
                  onChange={(e) => setEditTypeName(e.target.value)}
                  placeholder="Nama tipe baru..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
                <p className="text-[11px] text-stone-500 mt-1.5">
                  Mengubah nama tipe ini juga akan memperbarui secara otomatis semua konten internal yang menggunakan nama lama.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingType(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editTypeName.trim() || editTypeName.trim() === editingType.name}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Nama'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#1A1715]">
                Hapus Tipe Konten "{deleteTarget.name}"?
              </h3>
              {(deleteTarget.contentCount || 0) > 0 ? (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    Peringatan: Masih Terpakai
                  </p>
                  <p>
                    Tipe ini sedang digunakan oleh <strong>{deleteTarget.contentCount} konten</strong>. Anda harus mengubah atau mengosongkan tipe konten tersebut sebelum menghapus tipe ini dari sistem.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-stone-500 mt-1">
                  Tipe konten ini belum digunakan oleh konten manapun. Apakah Anda yakin ingin menghapusnya secara permanen?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending || (deleteTarget.contentCount || 0) > 0}
                onClick={handleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus Tipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
