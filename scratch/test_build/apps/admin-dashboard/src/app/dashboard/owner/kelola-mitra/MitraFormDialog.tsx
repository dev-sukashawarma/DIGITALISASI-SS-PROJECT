'use client'

import { useState, useEffect } from 'react'
import { upsertMitraProfile } from './actions'

export function MitraFormDialog({ isOpen, onClose, users, outlets, initialData = null }: any) {
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [namaMitra, setNamaMitra] = useState('')
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setUserId(initialData?.user_id || '')
      setNamaMitra(initialData?.nama_mitra || '')
      setSelectedOutlets(initialData?.outlet_ids || [])
    }
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !namaMitra || selectedOutlets.length === 0) {
      alert('Mohon lengkapi semua field (User, Nama, dan minimal 1 Outlet)')
      return
    }

    setLoading(true)
    try {
      await upsertMitraProfile({
        user_id: userId,
        nama_mitra: namaMitra,
        outlet_ids: selectedOutlets,
        previous_user_id: initialData?.user_id && initialData.user_id !== userId ? initialData.user_id : undefined
      })
      onClose()
    } catch (e: any) {
      alert(e.message || 'Gagal menyimpan profil mitra')
    } finally {
      setLoading(false)
    }
  }

  const toggleOutlet = (id: string) => {
    if (selectedOutlets.includes(id)) {
      setSelectedOutlets(selectedOutlets.filter(oid => oid !== id))
    } else {
      setSelectedOutlets([...selectedOutlets, id])
    }
  }

  if (!isOpen) return null

  const isSelectedUserInList = users.some((u: any) => u.id === userId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Mitra' : 'Tambah Mitra Baru'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Akun (Staf dengan Role MITRA)</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Pilih User...</option>
              {!isSelectedUserInList && userId && (
                <option value={userId}>User ID: {userId.substring(0, 8)}...</option>
              )}
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Mitra (Tampilan)</label>
            <input
              type="text"
              value={namaMitra}
              onChange={(e) => setNamaMitra(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: Budi Santoso"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Akses Outlet</label>
            <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
              {outlets.map((o: any) => (
                <label key={o.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOutlets.includes(o.id)}
                    onChange={() => toggleOutlet(o.id)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Batal
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

