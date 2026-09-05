'use client'

import { useState, useTransition } from 'react'
import {
  ShieldCheck,
  Plus,
  Search,
  Trash2,
  X,
  AlertCircle,
  Mail,
  User as UserIcon,
} from 'lucide-react'
import { createUser, updateUserRole, deleteUser } from '@/app/actions/users'

export interface SerializedUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

interface UserListProps {
  initialUsers: SerializedUser[]
  currentUserId: string
}

export default function UserList({ initialUsers, currentUserId }: UserListProps) {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SerializedUser | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = initialUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createUser({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
      }
    })
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    startTransition(async () => {
      const res = await updateUserRole(userId, newRole)
      if (res?.error) {
        setErrorMessage(res.error)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteUser(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-orange-500" />
            Manajemen Pengguna & Role
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur hak akses staf internal ke sistem Marcom (ADMIN vs MARCOM).
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
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {errorMessage && !isCreateOpen && !deleteTarget && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama atau email user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total: <span className="font-bold text-slate-800">{filtered.length}</span> user terdaftar
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">User / Nama</th>
              <th className="px-6 py-3.5">Email</th>
              <th className="px-6 py-3.5">Role Saat Ini</th>
              <th className="px-6 py-3.5">Terdaftar</th>
              <th className="px-6 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((u) => {
              const isSelf = u.id === currentUserId

              return (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div>{u.name || '-'}</div>
                      {isSelf && (
                        <span className="text-[10px] text-orange-600 font-bold">(Akun Anda)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-700">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none ${
                        u.role === 'ADMIN'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MARCOM">MARCOM</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isSelf && (
                      <button
                        onClick={() => {
                          setErrorMessage('')
                          setDeleteTarget(u)
                        }}
                        className="inline-flex items-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Hapus user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah User */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-orange-500" />
                Tambah Pengguna Baru
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
                  Email Staf (Wajib Sesuai Akun Login) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="nama@sukashawarma.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder="Contoh: Ahmad Fadilah"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role / Hak Akses
                </label>
                <select
                  name="role"
                  defaultValue="MARCOM"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="MARCOM">MARCOM (Kelola data kampanye & iklan)</option>
                  <option value="ADMIN">ADMIN (Akses penuh & kelola user)</option>
                </select>
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
                  {isPending ? 'Menyimpan...' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus User */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-lg">Hapus Pengguna?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus hak akses untuk{' '}
                <span className="font-bold text-slate-800">{deleteTarget.email}</span>?
              </p>
            </div>

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
