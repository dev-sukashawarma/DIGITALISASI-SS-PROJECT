'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { submitBahanBaku, getBahanBakuList, addBahanBakuSku, deleteBahanBakuSku, setDefaultBahanBakuSku, createBahanBaku } from './actions'
import { Camera, Package, CheckCircle2, AlertCircle, Search, ImageIcon, Pencil } from 'lucide-react'

const SATUAN_OPTIONS = [
  'Bal', 'Blok', 'Bungkus', 'Dus', 'Gram', 'Ikat', 'Kaleng', 'Karton', 'Karung', 'Kg', 'Lembar', 'Liter', 'Lusin', 'Ml', 'Pack', 'Pcs', 'Renceng', 'Roll', 'Sachet', 'Sisir', 'Toples', 'Tube'
]

type BahanBaku = {
  id: string
  nama: string
  kategori: string
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  image_url: string | null
  image_url_tengah: string | null
  image_url_kecil: string | null
  is_fisik_checked: boolean | null
  bahan_baku_sku?: {
    id: string
    nama_kemasan: string
    qty_isi: number
    harga_beli: number
    is_default: boolean
  }[]
}

export default function FormBahanBakuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FormBahanBakuContent />
    </Suspense>
  )
}

function FormBahanBakuContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [bahanBakuList, setBahanBakuList] = useState<BahanBaku[]>([])
  const [filteredList, setFilteredList] = useState<BahanBaku[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<BahanBaku | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewUrlTengah, setPreviewUrlTengah] = useState<string | null>(null)
  const [previewUrlKecil, setPreviewUrlKecil] = useState<string | null>(null)
  const [showSkuSection, setShowSkuSection] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newBahanNama, setNewBahanNama] = useState('')
  const [newBahanSatuan, setNewBahanSatuan] = useState('Kg')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRefTengah = useRef<HTMLInputElement>(null)
  const fileInputRefKecil = useRef<HTMLInputElement>(null)

  // Draft state untuk form
  const [satuanBesar, setSatuanBesar] = useState('')
  const [satuanTengah, setSatuanTengah] = useState('')
  const [satuanKecil, setSatuanKecil] = useState('')
  const [faktorTengah, setFaktorTengah] = useState('')
  const [faktorTampilan, setFaktorTampilan] = useState('')

  useEffect(() => {
    if (token) {
      getBahanBakuList(token).then((res) => {
        if (res.success && res.data) {
          setBahanBakuList(res.data)
          setFilteredList(res.data)
        } else {
          setErrorMsg(res.error || 'Gagal mengambil data master bahan baku')
        }
        setIsLoading(false)
      }).catch(() => {
        setErrorMsg('Gagal mengambil data master bahan baku')
        setIsLoading(false)
      })
    }
  }, [token])

  useEffect(() => {
    if (searchQuery) {
      setFilteredList(bahanBakuList.filter(b => b.nama.toLowerCase().includes(searchQuery.toLowerCase())))
    } else {
      setFilteredList(bahanBakuList)
    }
  }, [searchQuery, bahanBakuList])

  // Block rendering if no token
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Akses Ditolak</h2>
          <p className="text-gray-500">Tautan tidak valid. Harap gunakan Magic Link yang diberikan oleh Admin.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-emerald-100 p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Berhasil!</h2>
          <p className="text-gray-500">Data fisik Bahan Baku berhasil diperbarui ke dalam sistem.</p>
          <button 
            onClick={() => { 
              setSuccess(false)
              setSelectedItem(null)
              setSearchQuery('') 
              setPreviewUrl(null)
              setPreviewUrlTengah(null)
              setPreviewUrlKecil(null)
              setShowSkuSection(false)
              window.location.reload()
            }}
            className="mt-4 w-full py-3 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors"
          >
            Input Barang Lain
          </button>
        </div>
      </div>
    )
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, level: 'besar' | 'tengah' | 'kecil') {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      if (level === 'besar') setPreviewUrl(url)
      if (level === 'tengah') setPreviewUrlTengah(url)
      if (level === 'kecil') setPreviewUrlKecil(url)
    }
  }

  function handleSelect(item: BahanBaku) {
    setSelectedItem(item)
    setPreviewUrl(item.image_url)
    setPreviewUrlTengah(item.image_url_tengah)
    setPreviewUrlKecil(item.image_url_kecil)
    
    setSatuanBesar(item.satuan)
    setSatuanTengah(item.satuan_tengah || '')
    setSatuanKecil(item.satuan_kecil || '')
    setFaktorTengah(item.faktor_tengah ? String(item.faktor_tengah) : '')
    setFaktorTampilan(item.faktor_tampilan ? String(item.faktor_tampilan) : '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedItem) {
      setErrorMsg('Pilih bahan baku terlebih dahulu')
      return
    }
    
    setIsSubmitting(true)
    setErrorMsg('')
    
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('token', token!)
      formData.append('id', selectedItem.id)
      
      const res = await submitBahanBaku(formData)
      if (res.success) {
        setSuccess(true)
      } else {
        setErrorMsg(res.error || 'Terjadi kesalahan')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-suka-orange/10 text-suka-orange rounded-full flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Input Data Fisik Bahan Baku</h1>
          <p className="text-gray-500 text-sm">Pilih barang dari master data dan lengkapi rincian serta fotonya</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {!selectedItem && !isCreatingNew ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 space-y-4 max-w-xl mx-auto">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Cari nama bahan baku..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none bg-gray-50"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="px-4 py-3 bg-suka-orange text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors whitespace-nowrap"
              >
                + Bahan Baru
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {filteredList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Tidak ada barang yang cocok</div>
              ) : (
                filteredList.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-suka-orange hover:bg-orange-50 transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.nama} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:text-suka-orange group-hover:bg-white">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-suka-orange">{item.nama}</h3>
                        <p className="text-xs text-gray-500 capitalize">{item.satuan}</p>
                      </div>
                    </div>
                    {item.is_fisik_checked && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-semibold">Selesai</span>
                        </div>
                        {!item.image_url && (
                          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            Tanpa Foto
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : isCreatingNew && !selectedItem ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 space-y-4 max-w-xl mx-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tambah Bahan Baku Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nama Bahan Baku</label>
                <input
                  type="text"
                  value={newBahanNama}
                  onChange={(e) => setNewBahanNama(e.target.value)}
                  placeholder="Contoh: Bawang Putih Bubuk"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-suka-orange outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Besar (Utama)</label>
                <select
                  value={newBahanSatuan}
                  onChange={(e) => setNewBahanSatuan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-suka-orange outline-none bg-white"
                >
                  {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !newBahanNama.trim()}
                  onClick={async () => {
                    if (!token) return
                    setIsSubmitting(true)
                    const res = await createBahanBaku(token, newBahanNama, newBahanSatuan)
                    if (res.success && res.data) {
                      setBahanBakuList([...bahanBakuList, res.data])
                      handleSelect(res.data)
                      setIsCreatingNew(false)
                      setNewBahanNama('')
                    } else {
                      setErrorMsg(res.error || 'Gagal membuat bahan baku')
                    }
                    setIsSubmitting(false)
                  }}
                  className="flex-1 py-3 bg-suka-orange text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Lanjut & Lengkapi'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedItem ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Bahan Baku</label>
                <h2 className="text-xl font-bold text-suka-ink uppercase mt-1">{selectedItem.nama}</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedItem(null)}
                className="text-sm text-suka-orange font-semibold bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
              >
                Ganti Barang
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              
              {/* Konversi Satuan Bertingkat */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Konversi Satuan Bertingkat</label>
                </div>
                
                <div className="space-y-4">
                  {/* Besar */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Besar (Utama)</label>
                    <select 
                      name="satuan"
                      required
                      value={satuanBesar}
                      onChange={e => setSatuanBesar(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-suka-orange outline-none"
                    >
                      {!SATUAN_OPTIONS.includes(satuanBesar) && satuanBesar && <option value={satuanBesar}>{satuanBesar}</option>}
                      {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  
                  {/* Tengah */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Faktor (Isi)</label>
                      <input 
                        name="faktor_tengah" 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={faktorTengah}
                        onChange={e => setFaktorTengah(e.target.value)}
                        placeholder="Contoh: 10" 
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-suka-orange outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Tengah</label>
                      <select 
                        name="satuan_tengah"
                        value={satuanTengah}
                        onChange={e => setSatuanTengah(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-suka-orange outline-none"
                      >
                        <option value="">(Tidak Ada)</option>
                        {!SATUAN_OPTIONS.includes(satuanTengah) && satuanTengah && <option value={satuanTengah}>{satuanTengah}</option>}
                        {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Kecil */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Faktor (Isi Terkecil)</label>
                      <input 
                        name="faktor_tampilan" 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={faktorTampilan}
                        onChange={e => setFaktorTampilan(e.target.value)}
                        placeholder="Contoh: 100" 
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-suka-orange outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Kecil</label>
                      <select 
                        name="satuan_kecil"
                        value={satuanKecil}
                        onChange={e => setSatuanKecil(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:border-suka-orange outline-none"
                      >
                        <option value="">(Tidak Ada)</option>
                        {!SATUAN_OPTIONS.includes(satuanKecil) && satuanKecil && <option value={satuanKecil}>{satuanKecil}</option>}
                        {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

                {/* SKU / Variasi Kemasan */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variasi Kemasan (SKU)</label>
                    <p className="text-[11px] text-gray-500 mt-0.5">Harga HPP otomatis dari SKU paling efisien (termurah per satuan kecil).</p>
                  </div>
                  {!showSkuSection && (
                    <button 
                      type="button"
                      onClick={() => setShowSkuSection(true)}
                      className="text-suka-orange flex items-center gap-1 text-xs font-semibold hover:bg-orange-50 px-2 py-1 rounded transition-colors whitespace-nowrap"
                    >
                      + Tambah
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-3">
                  {selectedItem.bahan_baku_sku && selectedItem.bahan_baku_sku.length > 0 ? (
                    selectedItem.bahan_baku_sku.map((sku) => {
                      const hargaSatuan = sku.qty_isi > 0 ? sku.harga_beli / sku.qty_isi : 0
                      const isCheapest = Math.min(...(selectedItem.bahan_baku_sku?.filter(s => s.qty_isi > 0).map(s => s.harga_beli / s.qty_isi) || [0])) === hargaSatuan
                      
                      return (
                        <div key={sku.id} className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 gap-3 hover:border-gray-300 transition-colors shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col justify-center">
                              <span className="text-sm font-bold text-suka-ink">{sku.nama_kemasan}</span>
                              <span className="text-xs font-semibold text-gray-500 mt-0.5">
                                Isi: {sku.qty_isi} {selectedItem.satuan_kecil || selectedItem.satuan} 
                                <span className="mx-1.5">•</span> 
                                Harga Beli: Rp {sku.harga_beli.toLocaleString('id-ID')}
                              </span>
                              <div className="flex gap-1.5 mt-1.5">
                                {sku.is_default && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold">DEFAULT HPP</span>}
                                {isCheapest && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-bold">TERMURAH</span>}
                              </div>
                            </div>
                            
                            <div className="flex gap-2 text-xs pt-1">
                              {!sku.is_default && (
                                <button 
                                  type="button"
                                  onClick={async () => {
                                    if (!token) return
                                    setIsSubmitting(true)
                                    const res = await setDefaultBahanBakuSku(token, selectedItem.id, sku.id)
                                    if (res.success) {
                                      const refreshed = await getBahanBakuList(token)
                                      if (refreshed.success && refreshed.data) {
                                        setBahanBakuList(refreshed.data)
                                        const updatedItem = refreshed.data.find(b => b.id === selectedItem.id)
                                        if (updatedItem) setSelectedItem(updatedItem)
                                      }
                                    } else {
                                      setErrorMsg(res.error || 'Gagal jadikan default')
                                    }
                                    setIsSubmitting(false)
                                  }}
                                  disabled={isSubmitting} 
                                  className="font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md" 
                                  title="Jadikan Default HPP"
                                >
                                  Default
                                </button>
                              )}
                              <button 
                                type="button"
                                onClick={async () => {
                                  if (!token) return
                                  if (confirm('Hapus kemasan ini?')) {
                                    setIsSubmitting(true)
                                    const res = await deleteBahanBakuSku(token, sku.id)
                                    if (res.success) {
                                      const refreshed = await getBahanBakuList(token)
                                      if (refreshed.success && refreshed.data) {
                                        setBahanBakuList(refreshed.data)
                                        const updatedItem = refreshed.data.find(b => b.id === selectedItem.id)
                                        if (updatedItem) setSelectedItem(updatedItem)
                                      }
                                    } else {
                                      setErrorMsg(res.error || 'Gagal hapus SKU')
                                    }
                                    setIsSubmitting(false)
                                  }
                                }}
                                disabled={isSubmitting} 
                                className="font-bold text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded-md self-start border border-gray-200">
                            Rp {hargaSatuan.toLocaleString('id-ID')} / {selectedItem.satuan_kecil || selectedItem.satuan}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-4 text-center text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-lg shadow-sm">
                      Belum ada kemasan. Silakan tambah kemasan baru.
                    </div>
                  )}
                </div>

                {/* Form Tambah SKU */}
                {showSkuSection && (
                  <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-2">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                      <label className="text-xs font-semibold text-gray-500 block">Tambah Kemasan Baru</label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Nama Kemasan</label>
                        <input type="text" id="newSkuNama" placeholder="Contoh: Botol 600ml" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Tingkatan</label>
                        <select id="newSkuTingkatan" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none">
                          <option value="">(Pilih Tingkatan)</option>
                          <option value="Besar">Besar</option>
                          <option value="Tengah">Tengah</option>
                          <option value="Kecil">Kecil</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Total Isi ({selectedItem.satuan_kecil || selectedItem.satuan})</label>
                        <input type="number" id="newSkuQty" placeholder="600" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Harga Beli</label>
                        <input type="number" id="newSkuHarga" placeholder="15000" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none" />
                      </div>
                      <div className="flex items-end gap-2">
                        <button 
                          type="button"
                          onClick={() => setShowSkuSection(false)}
                          className="w-full py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Batal
                        </button>
                        <button 
                          type="button"
                          className="w-full py-2 bg-suka-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                          disabled={isSubmitting}
                          onClick={async () => {
                            if (!token) return
                            const nama = (document.getElementById('newSkuNama') as HTMLInputElement).value
                            const tingkatan = (document.getElementById('newSkuTingkatan') as HTMLSelectElement).value
                            const qty = Number((document.getElementById('newSkuQty') as HTMLInputElement).value)
                            const harga = Number((document.getElementById('newSkuHarga') as HTMLInputElement).value)
                            
                            if (!nama || qty <= 0 || harga <= 0) {
                              alert('Mohon isi semua data kemasan dengan benar')
                              return
                            }
                            
                            setIsSubmitting(true)
                            const res = await addBahanBakuSku(token, {
                              bahan_baku_id: selectedItem.id,
                              nama_kemasan: nama,
                              qty_isi: qty,
                              harga_beli: harga,
                              is_default: !selectedItem.bahan_baku_sku || selectedItem.bahan_baku_sku.length === 0,
                              tingkatan_satuan: tingkatan || null
                            })
                            
                            if (res.success) {
                              const refreshed = await getBahanBakuList(token)
                              if (refreshed.success && refreshed.data) {
                                setBahanBakuList(refreshed.data)
                                const updatedItem = refreshed.data.find(b => b.id === selectedItem.id)
                                if (updatedItem) setSelectedItem(updatedItem)
                              }
                              
                              // reset form
                              ;(document.getElementById('newSkuNama') as HTMLInputElement).value = '';
                              ;(document.getElementById('newSkuTingkatan') as HTMLSelectElement).value = '';
                              ;(document.getElementById('newSkuQty') as HTMLInputElement).value = '';
                              ;(document.getElementById('newSkuHarga') as HTMLInputElement).value = '';
                              setShowSkuSection(false);
                            } else {
                              setErrorMsg(res.error || 'Gagal tambah kemasan')
                            }
                            setIsSubmitting(false)
                          }}
                        >
                          Simpan Kemasan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto Masing-masing Kemasan */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-suka-ink flex items-center gap-2">
                    <ImageIcon size={18} className="text-gray-400" />
                    Foto Masing-Masing Kemasan
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">Unggah foto spesifik untuk setiap tingkatan satuan yang ada.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  
                  {/* Slot Besar */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                        {satuanBesar || 'Besar'}
                      </span>
                    </div>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      {previewUrl ? (
                        <>
                          <img src={previewUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <p className="text-white font-medium flex items-center gap-2"><Pencil size={18} /> Ubah</p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{satuanBesar}</span>
                        </div>
                      )}
                      <input type="file" name="image" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={e => handleImageChange(e, 'besar')} />
                    </div>
                  </div>

                  {/* Slot Tengah */}
                  {satuanTengah && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                          {satuanTengah}
                        </span>
                      </div>
                      <div 
                        onClick={() => fileInputRefTengah.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        {previewUrlTengah ? (
                          <>
                            <img src={previewUrlTengah} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <p className="text-white font-medium flex items-center gap-2"><Pencil size={18} /> Ubah</p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                            <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{satuanTengah}</span>
                          </div>
                        )}
                        <input type="file" name="image_tengah" accept="image/*" capture="environment" className="hidden" ref={fileInputRefTengah} onChange={e => handleImageChange(e, 'tengah')} />
                      </div>
                    </div>
                  )}

          {/* Slot Kecil */}
                  {satuanKecil && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                          {satuanKecil}
                        </span>
                      </div>
                      <div 
                        onClick={() => fileInputRefKecil.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        {previewUrlKecil ? (
                          <>
                            <img src={previewUrlKecil} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <p className="text-white font-medium flex items-center gap-2"><Pencil size={18} /> Ubah</p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                            <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{satuanKecil}</span>
                          </div>
                        )}
                        <input type="file" name="image_kecil" accept="image/*" capture="environment" className="hidden" ref={fileInputRefKecil} onChange={e => handleImageChange(e, 'kecil')} />
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 mt-2">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-4 bg-suka-orange text-white font-bold rounded-xl shadow-sm hover:bg-orange-600 focus:ring-4 focus:ring-orange-100 transition-all disabled:opacity-50 flex items-center justify-center text-lg"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Simpan Data'
                )}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
