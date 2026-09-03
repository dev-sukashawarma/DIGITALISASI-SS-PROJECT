'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, X, Loader2, Store, Search, ChevronDown, Check, Eye, EyeOff, Lock, User } from 'lucide-react'
import type { Outlet } from '@/pos-types'
import { useDialogStore } from '@/lib/dialogStore'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  role: string
  username: string
  outlet_id: string | null
  outlets?: { name: string }
  staff_outlets?: { outlet_id: string }[]
  is_active?: boolean
  inactive_reason?: string | null
}

interface UsersViewProps {
  initialUsers: UserProfile[]
  initialOutlets: Outlet[]
}

export default function UsersView({ initialUsers, initialOutlets }: UsersViewProps) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'kiosk'>('users')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownSearch, setDropdownSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<string>('crew')
  const [outletId, setOutletId] = useState('')
  const [outletIds, setOutletIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [inactiveReason, setInactiveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isMultiOutletRole = [
    'admin', 'owner', 'regional_manager', 'area_manager', 
    'leader', 'admin_hr', 'admin_finance', 
    'purchasing', 'mitra'
  ].includes(role)

  const tabFilteredUsers = initialUsers.filter(u => activeTab === 'kiosk' ? u.role === 'kiosk' : u.role !== 'kiosk')
  const filteredUsers = tabFilteredUsers.filter(u => 
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.outlets?.name && u.outlets.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function openModal(user?: UserProfile) {
    if (user) {
      setEditingUser(user)
      setUsername(user.username)
      setPassword('') // Password kosongkan saat edit
      setRole(user.role)
      setOutletId(user.outlet_id || '')
      setOutletIds(user.staff_outlets?.map(so => so.outlet_id) || (user.outlet_id ? [user.outlet_id] : []))
      setIsActive(user.is_active ?? true)
      setInactiveReason(user.inactive_reason || '')
    } else {
      setEditingUser(null)
      setUsername('')
      setPassword('')
      setRole(activeTab === 'kiosk' ? 'kiosk' : 'crew')
      if (initialOutlets.length > 0) {
        setOutletId(initialOutlets[0].id)
        setOutletIds([initialOutlets[0].id])
      } else {
        setOutletId('')
        setOutletIds([])
      }
      setIsActive(true)
      setInactiveReason('')
    }
    setShowPassword(false)
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
          outlet_ids: isMultiOutletRole ? outletIds : undefined,
          is_active: isActive,
          inactive_reason: !isActive ? inactiveReason : null
        })
      })
      
      // Respons bisa saja bukan JSON (mis. halaman error 500 dari Next) —
      // jangan sampai sebab aslinya hilang jadi "Gagal menghubungi server".
      const raw = await res.text()
      let data: { error?: string } = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = { error: `Server membalas respons tidak valid (HTTP ${res.status})` }
      }

      if (!res.ok) {
        setError(data.error || `Terjadi kesalahan (HTTP ${res.status})`)
        toast.error(data.error || `Terjadi kesalahan (HTTP ${res.status})`)
      } else {
        // Success
        toast.success(editingUser ? 'Pengguna berhasil diperbarui!' : 'Pengguna berhasil ditambahkan!')
        setIsModalOpen(false)
        setUsername('')
        setPassword('')
        router.refresh() // Refresh list via server components
      }
    } catch (err) {
      setError('Gagal menghubungi server')
      toast.error('Gagal menghubungi server')
    }
    
    setIsSubmitting(false)
  }

  async function handleDeleteUser(id: string) {
    const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus akun pengguna ini?');
    if (!confirmed) return
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (!res.ok) {
        toast.error(data.error || 'Gagal menghapus pengguna')
      } else {
        toast.success('Pengguna berhasil dihapus!')
        router.refresh()
      }
    } catch (err) {
      toast.error('Gagal menghubungi server')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Manajemen Pengguna</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">Kelola akun akses untuk {activeTab === 'kiosk' ? 'Mesin Kiosk' : 'Pengguna Biasa'}. Total: <span className="font-bold text-gray-900">{tabFilteredUsers.length}</span> pengguna.</p>
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
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Modal Tambah User */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false) }}
        >
          <div className="relative bg-white rounded-2xl sm:rounded-3xl w-full max-w-md sm:max-w-lg shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] my-auto overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 shrink-0 bg-white rounded-t-2xl sm:rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900 leading-none">{editingUser ? 'Edit Akun' : 'Tambah Akun'}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {editingUser ? `Perbarui akun ${editingUser.username}` : 'Buat akun akses baru'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center text-gray-400 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <form id="user-form" onSubmit={handleSaveUser} className="overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 py-4 sm:py-5 space-y-4 overscroll-contain">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}
              <div className="relative" ref={dropdownRef}>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-gray-700">Pilih Cabang / Outlet</label>
                  {isMultiOutletRole && (
                    <span className="text-xs text-amber-600 font-medium">Bisa pilih lebih dari satu</span>
                  )}
                </div>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-gray-50 border-2 border-transparent focus-within:border-amber-400 focus-within:bg-white rounded-xl pl-11 pr-4 py-2.5 sm:py-3 outline-none transition-colors font-medium flex items-center justify-between cursor-pointer relative"
                >
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className={outletId || outletIds.length > 0 ? 'text-gray-900 truncate pr-4 text-sm sm:text-base' : 'text-gray-400 truncate pr-4 text-sm sm:text-base'}>
                    {isMultiOutletRole 
                      ? (outletIds.length === initialOutlets.length ? 'Semua Cabang' : outletIds.length > 0 ? `${outletIds.length} cabang dipilih` : 'Pilih Cabang...')
                      : (initialOutlets.find(o => o.id === outletId)?.name || 'Pilih Cabang...')
                    }
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
                      {isMultiOutletRole && dropdownSearch === '' && (
                        <div 
                          className="mt-2 flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => {
                            if (outletIds.length === initialOutlets.length) {
                              setOutletIds([])
                              setOutletId('')
                            } else {
                              const allIds = initialOutlets.map(o => o.id)
                              setOutletIds(allIds)
                              setOutletId(allIds[0] || '')
                            }
                          }}
                        >
                          <input type="checkbox" checked={outletIds.length === initialOutlets.length} readOnly className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600" />
                          <span className="text-sm font-bold text-gray-900">Pilih Semua Outlet</span>
                        </div>
                      )}
                    </div>
                    <div className="max-h-52 sm:max-h-60 overflow-y-auto p-1 relative z-50 bg-white">
                      {initialOutlets.filter(o => o.name.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center font-medium">Cabang tidak ditemukan</div>
                      ) : (
                        initialOutlets.filter(o => o.name.toLowerCase().includes(dropdownSearch.toLowerCase())).map(o => {
                          const isSelected = isMultiOutletRole ? outletIds.includes(o.id) : outletId === o.id;
                          return (
                            <div
                              key={o.id}
                              onClick={() => {
                                if (isMultiOutletRole) {
                                  let newIds = [...outletIds]
                                  if (isSelected) {
                                    newIds = newIds.filter(id => id !== o.id)
                                  } else {
                                    newIds.push(o.id)
                                  }
                                  setOutletIds(newIds)
                                  if (newIds.length > 0 && !newIds.includes(outletId)) {
                                    setOutletId(newIds[0])
                                  } else if (newIds.length === 0) {
                                    setOutletId('')
                                  }
                                } else {
                                  setOutletId(o.id)
                                  setOutletIds([o.id])
                                  setIsDropdownOpen(false)
                                  setDropdownSearch('')
                                }
                              }}
                              className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center gap-3 ${isSelected && !isMultiOutletRole ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-700'}`}
                            >
                              {isMultiOutletRole && (
                                <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600" />
                              )}
                              <div className="flex-1 flex justify-between items-center">
                                {o.name}
                                {isSelected && !isMultiOutletRole && <Check className="w-4 h-4 text-amber-600 shrink-0 ml-2" />}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Peran (Role)</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {[
                    { value: 'crew', label: 'Crew' },
                    { value: 'kitchen', label: 'Kitchen' },
                    { value: 'leader', label: 'Leader' },
                    { value: 'area_manager', label: 'Area Manager' },
                    { value: 'regional_manager', label: 'Regional Manager' },
                    { value: 'admin_hr', label: 'Admin HR' },
                    { value: 'admin_finance', label: 'Admin Finance' },
                    { value: 'purchasing', label: 'Purchasing' },
                    { value: 'mitra', label: 'Mitra' },
                    { value: 'owner', label: 'Owner' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'kiosk', label: 'Mesin Kiosk' }
                  ].map(r => (
                    <label 
                      key={r.value} 
                      className="flex items-center gap-2 p-2.5 sm:p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 text-left"
                    >
                      <input 
                        type="radio" 
                        name="role" 
                        value={r.value} 
                        checked={role === r.value} 
                        onChange={(e) => {
                          setRole(e.target.value)
                          // If switching away from multi-role, reset outletIds to just outletId if valid
                          if (![
                            'admin', 'owner', 'regional_manager', 'area_manager', 
                            'leader', 'admin_hr', 'admin_finance', 
                            'purchasing', 'mitra'
                          ].includes(e.target.value)) {
                            if (outletIds.length > 1 && outletId) {
                              setOutletIds([outletId])
                            }
                          }
                        }} 
                        className="w-4 h-4 accent-amber-600 shrink-0" 
                      />
                      <span className="font-bold text-gray-700 text-xs sm:text-sm truncate">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Username Login</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl pl-11 pr-4 py-2.5 sm:py-3 outline-none transition-colors font-medium text-sm sm:text-base"
                    placeholder={"Misal: kiosk_sudirman1"}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} required={!editingUser} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl pl-11 pr-12 py-2.5 sm:py-3 outline-none transition-colors font-medium text-sm sm:text-base"
                    placeholder={editingUser ? "Kosongkan jika tidak ingin mengubah" : "Minimal 6 karakter"}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-amber-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              
              {editingUser && (
                <div className="space-y-3 sm:space-y-4">
                  <div 
                    className="bg-gray-50 p-3.5 sm:p-4 rounded-xl border border-gray-100 flex items-center justify-between cursor-pointer transition-colors hover:bg-gray-100/80" 
                    onClick={() => setIsActive(!isActive)}
                  >
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Status Akun</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{isActive ? 'Akun dapat digunakan untuk login' : 'Akun diblokir sementara'}</p>
                    </div>
                    <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  
                  {!isActive && (
                    <div className="animate-fade-in p-3.5 sm:p-4 bg-red-50/50 rounded-xl border border-red-100">
                      <label className="block text-sm font-bold text-red-900 mb-1.5 sm:mb-2">Alasan Penonaktifan</label>
                      <textarea 
                        required value={inactiveReason} onChange={(e) => setInactiveReason(e.target.value)}
                        className="w-full bg-white border-2 border-red-100 focus:border-red-400 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 outline-none transition-colors font-medium text-sm sm:text-base text-red-900 placeholder-red-300"
                        placeholder="Contoh: Karyawan resign, Cuti panjang, dll..." rows={2}
                      />
                    </div>
                  )}
                </div>
              )}
              
            </form>

            {/* Footer */}
            <div className="flex gap-2.5 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 shrink-0 bg-gray-50/95 backdrop-blur-sm rounded-b-2xl sm:rounded-b-3xl z-10">
              <button
                type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm sm:text-base active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="submit" form="user-form" disabled={isSubmitting || !outletId}
                className="flex-[2] bg-gray-900 text-white rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base shadow-sm active:scale-[0.98]"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingUser ? 'Simpan Perubahan' : 'Buat Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 sm:p-6">
        <div className="flex border-b border-gray-200 mb-6 gap-4 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'users' ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pengguna Biasa
            {activeTab === 'users' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('kiosk')}
            className={`pb-4 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'kiosk' ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Mesin Kiosk
            {activeTab === 'kiosk' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-600 rounded-t-full" />
            )}
          </button>
        </div>

        {initialUsers.length === 0 ? (
           <p className="text-gray-500 font-medium">Belum ada data pengguna.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold text-xs sm:text-sm">
                  <th className="py-3 px-3 sm:px-4 min-w-[150px] sm:min-w-[200px]">Username</th>
                  
                  <th className="py-3 px-3 sm:px-4 min-w-[150px] sm:min-w-[200px]">Cabang Terhubung</th>
                  <th className="py-3 px-3 sm:px-4">Status</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Aksi</th>
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
                    <td className="py-3.5 sm:py-4 px-3 sm:px-4">
                      <div className="font-bold text-gray-900 flex items-center gap-2.5 sm:gap-3 text-sm sm:text-base">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="truncate">{u.username || 'Tidak ada'}</span>
                      </div>
                    </td>
                    
                    <td className="py-3.5 sm:py-4 px-3 sm:px-4">
                      <div className="text-gray-600 font-medium text-xs sm:text-sm flex items-center gap-2">
                        {u.role === 'admin' || u.role === 'owner' ? (
                          <span className="text-gray-400 italic">Semua Cabang</span>
                        ) : (
                          <>
                            <Store className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate">{u.outlets?.name || <span className="text-red-400 italic">Cabang tidak ditemukan</span>}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 sm:py-4 px-3 sm:px-4">
                      {u.role === 'admin' || u.role === 'owner' ? (
                        <span className="text-gray-400 text-xs sm:text-sm">-</span>
                      ) : u.is_active !== false ? (
                        <span className="bg-green-100 text-green-700 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-3.5 sm:py-4 px-3 sm:px-4 text-right">
                      {u.role !== 'admin' && (
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          <button 
                            onClick={() => openModal(u)}
                            className="text-xs sm:text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors active:scale-95"
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
