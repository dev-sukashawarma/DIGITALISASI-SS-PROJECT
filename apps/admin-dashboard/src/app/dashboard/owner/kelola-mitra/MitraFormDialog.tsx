'use client'

import React, { useState, useEffect } from 'react'
import { upsertMitraProfile } from './actions'
import { Users, Store, X, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export function MitraFormDialog({ isOpen, onClose, users = [], outlets = [], initialData = null }: any) {
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
      toast.error('Mohon lengkapi Akun User, Nama Mitra, dan minimal 1 Akses Outlet')
      return
    }

    setLoading(true)
    try {
      await upsertMitraProfile({
        user_id: userId,
        nama_mitra: namaMitra.trim(),
        outlet_ids: selectedOutlets,
        previous_user_id: initialData?.user_id && initialData.user_id !== userId ? initialData.user_id : undefined
      })
      toast.success(initialData ? 'Profil mitra berhasil diperbarui' : 'Mitra baru berhasil ditambahkan')
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan profil mitra')
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

  const selectAllOutlets = () => {
    setSelectedOutlets(outlets.map((o: any) => o.id))
  }

  const clearOutlets = () => {
    setSelectedOutlets([])
  }

  if (!isOpen) return null

  const isSelectedUserInList = users.some((u: any) => u.id === userId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 leading-tight">
                {initialData ? 'Edit Profil Mitra' : 'Tambah Mitra Baru'}
              </h2>
              <p className="text-xs text-gray-500">Konfigurasi akun dan hak akses outlet</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Select */}
          <div>
            <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
              Akun Login Mitra (Role MITRA) <span className="text-rose-500">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-medium text-gray-800 transition-all"
            >
              <option value="">-- Pilih Akun Staf / User Mitra --</option>
              {!isSelectedUserInList && userId && (
                <option value={userId}>User ID: {userId.substring(0, 8)}...</option>
              )}
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </div>
          
          {/* Nama Mitra */}
          <div>
            <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
              Nama Tampilan Mitra <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={namaMitra}
              onChange={(e) => setNamaMitra(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-medium placeholder-gray-400 transition-all"
              placeholder="Contoh: Mitra Cicurug / Bpk. Hendra"
            />
          </div>
          
          {/* Akses Outlet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Akses Outlet Mitra ({selectedOutlets.length} Dipilih) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllOutlets}
                  className="text-[11px] font-bold text-amber-600 hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearOutlets}
                  className="text-[11px] font-bold text-gray-400 hover:underline"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl max-h-52 overflow-y-auto p-2.5 space-y-1.5 bg-gray-50/50">
              {outlets.map((o: any) => {
                const isSelected = selectedOutlets.includes(o.id)
                return (
                  <div
                    key={o.id}
                    onClick={() => toggleOutlet(o.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-sm' 
                        : 'bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-gray-400'}`} />
                      <span>{o.name}</span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-6 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 flex items-center"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Profil Mitra'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


