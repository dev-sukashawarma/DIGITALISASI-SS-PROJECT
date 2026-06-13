'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, X, Loader2, Store, Search, ChevronDown, Check } from 'lucide-react'
import type { Outlet } from '@/types'

interface UserProfile {
  id: string
  role: string
  username: string
  outlet_id: string | null
  outlets?: { name: string }
  is_active?: boolean
  inactive_reason?: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownSearch, setDropdownSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('kasir')
  const [outletId, setOutletId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [inactiveReason, setInactiveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.outlets?.name && u.outlets.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    fetchData()
    
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function fetchData() {
    setLoading(true)
    const [profilesRes, outletsRes] = await Promise.all([
      supabase.from('profiles').select('*, outlets(name)').order('created_at', { ascending: false }),
      supabase.from('outlets').select('*').eq('is_active', true).order('name', { ascending: true })
    ])
    
    if (profilesRes.data) setUsers(profilesRes.data)
    if (outletsRes.data) setOutlets(outletsRes.data)
    
    // Set default outlet id for form
    if (outletsRes.data && outletsRes.data.length > 0) {
      setOutletId(outletsRes.data[0].id)
    }
    
    setLoading(false)
  }

  function openModal(user?: UserProfile) {
    if (user) {
      setEditingUser(user)
      setUsername(user.username)
      setPassword('') // Password kosongkan saat edit
      setRole(user.role)
      setOutletId(user.outlet_id || '')
      setIsActive(user.is_active ?? true)
      setInactiveReason(user.inactive_reason || '')
    } else {
      setEditingUser(null)
      setUsername('')
      setPassword('')
      setRole('kasir')
      if (outlets.length > 0) setOutletId(outlets[0].id)
      setIsActive(true)
      setInactiveReason('')
    }
    setError('')
    setIsModalOpen(true)
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: password || undefined,
          role,
          outlet_id: outletId,
          is_active: role === 'kiosk' ? true : isActive,
          inactive_reason: role === 'kiosk' ? null : (!isActive ? inactiveReason : null)
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan')
      } else {
        // Success
        setIsModalOpen(false)
        setUsername('')
        setPassword('')
        fetchData() // Refresh list
      }
    } catch (err) {
      setError('Gagal menghubungi server')
    }
    
    setIsSubmitting(false)
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus akun pengguna ini?')) return
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus pengguna')
      } else {
        fetchData()
      }
    } catch (err) {
      alert('Gagal menghubungi server')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Manajemen Pengguna</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">Kelola akun Kasir dan Kiosk cabang. Total: <span className="font-bold text-gray-900">{users.length}</span> pengguna.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full sm:w-64 pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm font-medium"
              placeholder="Cari username / cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Modal Tambah User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-8 relative animate-fade-up max-h-[95vh] overflow-y-auto">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-6">{editingUser ? 'Edit Akun Cabang' : 'Tambah Akun Cabang'}</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl font-medium">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Cabang / Outlet</label>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-gray-50 border-2 border-transparent focus-within:border-amber-400 focus-within:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium flex items-center justify-between cursor-pointer"
                >
                  <span className={outletId ? 'text-gray-900' : 'text-gray-400 truncate pr-4'}>
                    {outlets.find(o => o.id === outletId)?.name || 'Pilih Cabang...'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                    <div className="p-2 border-b border-gray-50">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Cari cabang..."
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 relative z-50 bg-white">
                      {outlets.filter(o => o.name.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center font-medium">Cabang tidak ditemukan</div>
                      ) : (
                        outlets.filter(o => o.name.toLowerCase().includes(dropdownSearch.toLowerCase())).map(o => (
                          <div
                            key={o.id}
                            onClick={() => {
                              setOutletId(o.id)
                              setIsDropdownOpen(false)
                              setDropdownSearch('')
                            }}
                            className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center justify-between ${outletId === o.id ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            {o.name}
                            {outletId === o.id && <Check className="w-4 h-4 text-amber-600 shrink-0 ml-2" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Peran (Role)</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center gap-2 p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                    <input type="radio" name="role" value="kasir" checked={role === 'kasir'} onChange={(e) => setRole(e.target.value)} className="w-4 h-4 accent-amber-600" />
                    <span className="font-bold text-gray-700 text-sm">Akun Kasir</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                    <input type="radio" name="role" value="kiosk" checked={role === 'kiosk'} onChange={(e) => setRole(e.target.value)} className="w-4 h-4 accent-amber-600" />
                    <span className="font-bold text-gray-700 text-sm">Mesin Kiosk</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Username Login</label>
                <input 
                  type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  placeholder={role === 'kasir' ? "Misal: kasir_sudirman" : "Misal: kiosk_sudirman1"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                <input 
                  type="password" required={!editingUser} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  placeholder={editingUser ? "Kosongkan jika tidak ingin mengubah" : "Minimal 6 karakter"}
                />
              </div>
              
              {editingUser && role !== 'kiosk' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status Akun</label>
                    <select 
                      value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium appearance-none"
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                  {!isActive && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-bold text-gray-700 mb-1">Alasan Penonaktifan</label>
                      <textarea 
                        required value={inactiveReason} onChange={(e) => setInactiveReason(e.target.value)}
                        className="w-full bg-red-50 text-red-900 border-2 border-transparent focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium placeholder-red-300"
                        placeholder="Berikan alasan mengapa akun dinonaktifkan..." rows={2}
                      />
                    </div>
                  )}
                </div>
              )}
              
              <button 
                type="submit" disabled={isSubmitting || !outletId}
                className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold hover:bg-gray-800 transition-colors mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingUser ? 'Simpan Perubahan' : 'Buat Akun'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        {loading ? (
          <p className="text-gray-500 font-medium flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Memuat data pengguna...
          </p>
        ) : users.length === 0 ? (
           <p className="text-gray-500 font-medium">Belum ada data pengguna.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold text-sm">
                  <th className="py-3 px-4 min-w-[200px]">Username</th>
                  <th className="py-3 px-4 min-w-[150px]">Peran (Role)</th>
                  <th className="py-3 px-4 min-w-[200px]">Cabang Terhubung</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 font-medium">Data pengguna tidak ditemukan.</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-blue-500" />
                      </div>
                      {u.username || 'Tidak ada'}
                    </td>
                    <td className="py-4 px-4">
                      {u.role === 'admin' ? (
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">Admin</span>
                      ) : u.role === 'kasir' ? (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">Kasir</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">Kiosk</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-600 font-medium text-sm flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <span className="text-gray-400 italic">Semua Cabang</span>
                      ) : (
                        <>
                          <Store className="w-4 h-4 text-gray-400" />
                          {u.outlets?.name || <span className="text-red-400 italic">Cabang tidak ditemukan</span>}
                        </>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {u.role === 'admin' ? (
                        <span className="text-gray-400">-</span>
                      ) : u.is_active !== false ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {u.role !== 'admin' && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openModal(u)}
                            className="text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
