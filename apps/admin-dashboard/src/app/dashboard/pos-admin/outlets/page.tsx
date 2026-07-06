'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Store, Plus, X, Loader2, Search } from 'lucide-react'
import type { Outlet } from '@/pos-types'
import { useDialogStore } from '@/lib/dialogStore'

export default function AdminOutletsPage() {
  const { showConfirm, showAlert } = useDialogStore()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form state
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('owned')
  const [openHour, setOpenHour] = useState('13:00')
  const [closeHour, setCloseHour] = useState('22:00')
  const [isActive, setIsActive] = useState(true)
  const [inactiveReason, setInactiveReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const filteredOutlets = outlets.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  useEffect(() => {
    fetchOutlets()
  }, [])

  async function fetchOutlets() {
    setLoading(true)
    const { data } = await supabase.from('outlets').select('*').order('created_at', { ascending: true })
    if (data) setOutlets(data)
    setLoading(false)
  }

  function openModal(outlet?: Outlet) {
    if (outlet) {
      setEditingOutlet(outlet)
      setName(outlet.name)
      setAddress(outlet.address || '')
      setPhone(outlet.phone || '')
      setType(outlet.type || 'owned')
      setOpenHour(outlet.open_hour ? outlet.open_hour.substring(0, 5) : '13:00')
      setCloseHour(outlet.close_hour ? outlet.close_hour.substring(0, 5) : '22:00')
      setIsActive(outlet.is_active)
      setInactiveReason(outlet.inactive_reason || '')
    } else {
      setEditingOutlet(null)
      setName('')
      setAddress('')
      setPhone('')
      setType('owned')
      setOpenHour('13:00')
      setCloseHour('22:00')
      setIsActive(true)
      setInactiveReason('')
    }
    setIsModalOpen(true)
  }

  async function handleSaveOutlet(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    
    if (editingOutlet) {
      const { data, error } = await supabase.from('outlets').update({
        name,
        address,
        phone,
        type,
        open_hour: openHour + ':00',
        close_hour: closeHour + ':00',
        is_active: isActive,
        inactive_reason: !isActive ? inactiveReason : null
      }).eq('id', editingOutlet.id).select().single()

      if (!error && data) {
        setOutlets(outlets.map(o => o.id === editingOutlet.id ? data : o))
        setIsModalOpen(false)
        fetch('/api/admin/outlets/sync-to-online', { method: 'POST', body: JSON.stringify({ action: 'upsert', outlet: data }) }).catch(console.error)
      } else {
        console.error('Update outlet error:', error)
        showAlert('Gagal mengupdate cabang: ' + (error?.message || 'Unknown error'))
      }
    } else {
      const { data, error } = await supabase.from('outlets').insert({
        name,
        address,
        phone,
        type,
        open_hour: openHour + ':00',
        close_hour: closeHour + ':00',
        is_active: isActive,
        inactive_reason: !isActive ? inactiveReason : null
      }).select().single()

      if (!error && data) {
        setOutlets([...outlets, data])
        setIsModalOpen(false)
        fetch('/api/admin/outlets/sync-to-online', { method: 'POST', body: JSON.stringify({ action: 'upsert', outlet: data }) }).catch(console.error)
      } else {
        console.error('Insert outlet error:', error)
        showAlert('Gagal menambahkan cabang: ' + (error?.message || 'Unknown error'))
      }
    }
    
    setIsSubmitting(false)
  }

  async function handleDeleteOutlet(id: string) {
    const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus cabang ini? Semua data pesanan yang terkait juga akan ikut terhapus!');
    if (!confirmed) return
    
    const { error } = await supabase.from('outlets').delete().eq('id', id)
    if (!error) {
      setOutlets(outlets.filter(o => o.id !== id))
      fetch('/api/admin/outlets/sync-to-online', { method: 'POST', body: JSON.stringify({ action: 'delete', outlet: { id } }) }).catch(console.error)
    } else {
      console.error('Delete outlet error:', error)
      showAlert('Gagal menghapus cabang: ' + (error?.message || 'Unknown error'))
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Manajemen Cabang</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium">Kelola data outlet Shawarma. Total: <span className="font-bold text-gray-900">{outlets.length}</span> cabang.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full sm:w-64 pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm font-medium"
              placeholder="Cari cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Tambah Cabang</span>
          </button>
        </div>
      </div>

      {/* Modal Tambah Cabang */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Store className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-900 leading-none">{editingOutlet ? 'Edit Cabang' : 'Tambah Cabang Baru'}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {editingOutlet ? `Perbarui data ${editingOutlet.name}` : 'Daftarkan cabang baru'}
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
            <form id="outlet-form" onSubmit={handleSaveOutlet} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Cabang</label>
                <input 
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  placeholder="Misal: Cabang Sudirman"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Alamat</label>
                <textarea 
                  value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  placeholder="Alamat lengkap" rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Telepon</label>
                <input 
                  type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  placeholder="0812xxxxxx"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tipe Cabang</label>
                  <select 
                    value={type} onChange={(e) => setType(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium appearance-none"
                  >
                    <option value="owned">Milik Sendiri</option>
                    <option value="mitra">Mitra / Franchise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Jam Buka</label>
                  <input 
                    type="time" value={openHour} onChange={(e) => setOpenHour(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Jam Tutup</label>
                  <input 
                    type="time" value={closeHour} onChange={(e) => setCloseHour(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-xl px-4 py-3 outline-none transition-colors font-medium"
                  />
                </div>
              </div>
              {editingOutlet && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status Cabang</label>
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
                        placeholder="Berikan alasan mengapa cabang dinonaktifkan..." rows={2}
                      />
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}
                className="flex-1 py-3 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit" form="outlet-form" disabled={isSubmitting}
                className="flex-[2] bg-gray-900 text-white rounded-xl py-3 font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Cabang'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        {loading ? (
          <p className="text-gray-500 font-medium flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Memuat data cabang...
          </p>
        ) : outlets.length === 0 ? (
           <p className="text-gray-500 font-medium">Belum ada cabang.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold text-sm">
                  <th className="py-3 px-4 min-w-[200px]">Nama Cabang</th>
                  <th className="py-3 px-4 min-w-[200px]">Alamat</th>
                  <th className="py-3 px-4 min-w-[120px]">Tipe & Jam</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutlets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 font-medium">Data cabang tidak ditemukan.</td>
                  </tr>
                ) : (
                  filteredOutlets.map((outlet) => (
                  <tr key={outlet.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-amber-500" />
                      </div>
                      {outlet.name}
                    </td>
                    <td className="py-4 px-4 text-gray-600 font-medium text-sm">
                      <div>{outlet.address || '-'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{outlet.phone || '-'}</div>
                    </td>
                    <td className="py-4 px-4 font-medium text-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        {outlet.type === 'mitra' ? (
                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Mitra</span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Owned</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {outlet.open_hour?.substring(0,5) || '13:00'} - {outlet.close_hour?.substring(0,5) || '22:00'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {outlet.is_active ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openModal(outlet)}
                          className="text-sm font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteOutlet(outlet.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
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
