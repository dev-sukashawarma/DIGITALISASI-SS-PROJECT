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
  MessageCircle,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            <span>Master Data Influencer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Database KOL & Content Creator
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Database lengkap 89+ kreator video kuliner, tautan profil TikTok/IG, kontak WhatsApp, dan rekening bank.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage('')
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah KOL Baru</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingKol && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, no HP, rekening..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
          />
        </div>
        <div className="text-xs text-stone-500 font-medium">
          Menampilkan <span className="font-bold text-[#1A1715]">{filteredKols.length}</span> dari{' '}
          <span className="font-bold text-[#1A1715]">{initialKols.length}</span> profil KOL
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-stone-600">
            <thead className="bg-[#FAF8F5] border-b border-[#EFE8DE] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nama Akun / Creator</th>
                <th className="px-6 py-4">Tautan Media Sosial</th>
                <th className="px-6 py-4">Kontak WhatsApp</th>
                <th className="px-6 py-4">Rekening Transfer</th>
                <th className="px-6 py-4 text-center">Riwayat</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filteredKols.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-stone-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-700">Data KOL tidak ditemukan.</p>
                    <p className="text-xs mt-1">Coba kata kunci lain atau daftarkan kreator baru.</p>
                  </td>
                </tr>
              ) : (
                filteredKols.map((kol) => (
                  <tr key={kol.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center font-extrabold text-xs">
                          {kol.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#1A1715] text-sm">{kol.name}</div>
                          <div className="text-[11px] text-stone-400 font-mono">ID #{kol.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 text-xs">
                        {kol.tiktokUrl && kol.tiktokUrl !== 'nan' ? (
                          <a
                            href={kol.tiktokUrl.startsWith('http') ? kol.tiktokUrl : `https://${kol.tiktokUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-stone-800 hover:text-[#D9480F] font-semibold truncate max-w-[200px]"
                          >
                            <span className="w-4 h-4 flex items-center justify-center rounded bg-black text-white text-[9px] font-black flex-shrink-0">
                              TT
                            </span>
                            <span className="truncate">{kol.tiktokUrl.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '@')}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400 flex-shrink-0" />
                          </a>
                        ) : null}

                        {kol.instagramUrl && kol.instagramUrl !== 'nan' ? (
                          <a
                            href={kol.instagramUrl.startsWith('http') ? kol.instagramUrl : `https://${kol.instagramUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-rose-700 hover:text-rose-800 font-semibold truncate max-w-[200px]"
                          >
                            <span className="w-4 h-4 flex items-center justify-center rounded bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 text-white text-[9px] font-black flex-shrink-0">
                              IG
                            </span>
                            <span className="truncate">{kol.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400 flex-shrink-0" />
                          </a>
                        ) : null}

                        {!kol.tiktokUrl && !kol.instagramUrl && (
                          <span className="text-xs text-stone-400 italic">Belum ada sosmed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {kol.phoneNumber ? (
                        <div className="flex items-center gap-1.5 text-xs text-stone-800 font-medium">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="font-mono">{kol.phoneNumber}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {kol.bankAccount ? (
                        <div className="flex items-center gap-1.5 text-xs text-stone-800">
                          <CreditCard className="w-3.5 h-3.5 text-[#D9480F] flex-shrink-0" />
                          <span className="font-mono text-xs font-semibold">{kol.bankAccount}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/20">
                        {kol._count.endorsements} visit
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setErrorMessage('')
                          setEditingKol(kol)
                        }}
                        className="inline-flex items-center p-2 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer"
                        title="Edit profil KOL"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setDeleteTarget(kol)
                          }}
                          className="inline-flex items-center p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D9480F]" />
                Tambah Profil KOL Baru
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nama Akun / Creator *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: @kulinerbogor atau Budi Santoso"
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Link Profil TikTok
                  </label>
                  <input
                    name="tiktokUrl"
                    type="text"
                    placeholder="https://tiktok.com/@..."
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Link Profil Instagram
                  </label>
                  <input
                    name="instagramUrl"
                    type="text"
                    placeholder="https://instagram.com/..."
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    No WhatsApp / HP
                  </label>
                  <input
                    name="phoneNumber"
                    type="text"
                    placeholder="08123456789"
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Rekening Pembayaran
                  </label>
                  <input
                    name="bankAccount"
                    type="text"
                    placeholder="BCA 123456 a/n Nama"
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit KOL */}
      {editingKol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#D9480F]" />
                Edit Data KOL
              </h3>
              <button
                onClick={() => setEditingKol(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nama Akun / Creator *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingKol.name}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Link TikTok
                  </label>
                  <input
                    name="tiktokUrl"
                    type="text"
                    defaultValue={editingKol.tiktokUrl || ''}
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Link Instagram
                  </label>
                  <input
                    name="instagramUrl"
                    type="text"
                    defaultValue={editingKol.instagramUrl || ''}
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    No WhatsApp / HP
                  </label>
                  <input
                    name="phoneNumber"
                    type="text"
                    defaultValue={editingKol.phoneNumber || ''}
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Rekening Pembayaran
                  </label>
                  <input
                    name="bankAccount"
                    type="text"
                    defaultValue={editingKol.bankAccount || ''}
                    className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingKol(null)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#1A1715] text-lg">Hapus Profil KOL?</h3>
              <p className="text-xs text-stone-500 mt-1.5">
                Apakah Anda yakin ingin menghapus data KOL{' '}
                <span className="font-bold text-[#1A1715]">&quot;{deleteTarget.name}&quot;</span>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
