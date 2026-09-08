'use client'

import { useState, useTransition } from 'react'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Phone,
  CreditCard,
  AlertCircle,
  X,
} from 'lucide-react'
import { createKol, updateKol, deleteKol } from '@/app/actions/kols'

export interface SerializedKol {
  id: string
  name: string
  tiktokUrl: string | null
  instagramUrl: string | null
  phoneNumber: string | null
  bankAccount: string | null
  createdAt: string
  _count: {
    endorsements: number
  }
}

interface KolListProps {
  initialKols: SerializedKol[]
  userRole: string
}

export default function KolList({ initialKols, userRole }: KolListProps) {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingKol, setEditingKol] = useState<SerializedKol | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedKol | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Filter KOLs by name, phone, or bank
  const filteredKols = initialKols.filter(
    (kol) =>
      kol.name.toLowerCase().includes(search.toLowerCase()) ||
      (kol.phoneNumber && kol.phoneNumber.includes(search)) ||
      (kol.bankAccount && kol.bankAccount.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createKol({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
      }
    })
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingKol) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateKol(editingKol.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingKol(null)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteKol(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-orange-500" />
            Master Data KOL / Influencer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Database profil influencer, tautan sosial media, kontak, dan rekening pembayaran.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage('')
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah KOL Baru</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingKol && !deleteTarget && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, no telp, atau rekening..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Menampilkan <span className="font-bold text-slate-800">{filteredKols.length}</span> dari{' '}
          <span className="font-bold text-slate-800">{initialKols.length}</span> total KOL
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">KOL / Nama</th>
                <th className="px-6 py-3.5">Sosial Media</th>
                <th className="px-6 py-3.5">Kontak</th>
                <th className="px-6 py-3.5">Rekening Bank</th>
                <th className="px-6 py-3.5 text-center">Campaign</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKols.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">Belum ada data KOL ditemukan.</p>
                    <p className="text-xs mt-1">Klik &apos;Tambah KOL Baru&apos; untuk mulai mencatat influencer.</p>
                  </td>
                </tr>
              ) : (
                filteredKols.map((kol) => (
                  <tr key={kol.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{kol.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">ID #{kol.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        {kol.tiktokUrl ? (
                          <a
                            href={kol.tiktokUrl.startsWith('http') ? kol.tiktokUrl : `https://${kol.tiktokUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-orange-600 font-medium truncate max-w-[180px]"
                          >
                            <span className="w-3.5 h-3.5 flex items-center justify-center rounded bg-black text-white text-[9px] font-black">
                              TT
                            </span>
                            <span className="truncate">{kol.tiktokUrl.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '@')}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : null}

                        {kol.instagramUrl ? (
                          <a
                            href={kol.instagramUrl.startsWith('http') ? kol.instagramUrl : `https://${kol.instagramUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 font-medium truncate max-w-[180px]"
                          >
                            <span className="w-3.5 h-3.5 flex items-center justify-center rounded bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white text-[9px] font-bold">
                              IG
                            </span>
                            <span className="truncate">{kol.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : null}

                        {!kol.tiktokUrl && !kol.instagramUrl && (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {kol.phoneNumber ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{kol.phoneNumber}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {kol.bankAccount ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-mono">{kol.bankAccount}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        {kol._count.endorsements} endorse
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setErrorMessage('')
                          setEditingKol(kol)
                        }}
                        className="inline-flex items-center p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                        title="Edit data KOL"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setDeleteTarget(kol)
                          }}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Hapus KOL"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah KOL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Tambah Profil KOL Baru
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama KOL / Akun *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: @kulinerjakarta / Budi Santoso"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link TikTok
                  </label>
                  <input
                    name="tiktokUrl"
                    type="text"
                    placeholder="tiktok.com/@username"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link Instagram
                  </label>
                  <input
                    name="instagramUrl"
                    type="text"
                    placeholder="instagram.com/username"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    No Telepon / WhatsApp
                  </label>
                  <input
                    name="phoneNumber"
                    type="text"
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rekening Pembayaran
                  </label>
                  <input
                    name="bankAccount"
                    type="text"
                    placeholder="BCA 1234567890 a/n Budi"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan KOL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit KOL */}
      {editingKol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-500" />
                Edit Data KOL
              </h3>
              <button
                onClick={() => setEditingKol(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama KOL / Akun *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingKol.name}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link TikTok
                  </label>
                  <input
                    name="tiktokUrl"
                    type="text"
                    defaultValue={editingKol.tiktokUrl || ''}
                    placeholder="tiktok.com/@username"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link Instagram
                  </label>
                  <input
                    name="instagramUrl"
                    type="text"
                    defaultValue={editingKol.instagramUrl || ''}
                    placeholder="instagram.com/username"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    No Telepon / WhatsApp
                  </label>
                  <input
                    name="phoneNumber"
                    type="text"
                    defaultValue={editingKol.phoneNumber || ''}
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rekening Pembayaran
                  </label>
                  <input
                    name="bankAccount"
                    type="text"
                    defaultValue={editingKol.bankAccount || ''}
                    placeholder="BCA 1234567890 a/n Budi"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingKol(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui KOL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-lg">Hapus Profil KOL?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus data KOL{' '}
                <span className="font-bold text-slate-800">&quot;{deleteTarget.name}&quot;</span>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
