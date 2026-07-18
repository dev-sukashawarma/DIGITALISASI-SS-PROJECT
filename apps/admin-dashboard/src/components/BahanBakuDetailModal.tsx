'use client'
import React, { useRef, useState, useEffect } from 'react'
import { X, Camera, Package, Image as ImageIcon, Pencil, Check, ArrowRight, ZoomIn } from 'lucide-react'
import { Button, Badge } from '@suka/design-system'
import { rupiah } from '@/lib/format'
import { parsePriceInput } from '@/lib/bahanBaku'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'

const SATUAN_OPTIONS = [
  'Bal', 'Blok', 'Bungkus', 'Dus', 'Gram', 'Ikat', 'Kaleng', 'Karton', 'Karung', 'Kg', 'Lembar', 'Liter', 'Lusin', 'Ml', 'Pack', 'Pcs', 'Renceng', 'Roll', 'Sachet', 'Sisir', 'Toples', 'Tube'
]

interface BahanBakuDetailModalProps {
  isOpen: boolean
  onClose: () => void
  bahanBaku: BahanBakuWithHarga | null
  onUploadImage: (id: string, file: File, level: 'besar' | 'tengah' | 'kecil') => void
  uploading: boolean
  onSave: (id: string, h: number) => void
  onSaveMerek: (id: string, m: string | null) => void
  onSaveNama: (id: string, n: string) => void
  onSaveSatuan: (id: string, s: string, st: string | null, ft: number | null, sk: string | null, fk: number | null) => void
  saving: boolean
  onAddSku: (vars: { bahan_baku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number; is_default?: boolean; tingkatan_satuan?: string | null }) => void
  setSkuImage?: (sku_id: string, file: File) => void
  onUpdateSku: (vars: { sku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number }) => void
  onDeleteSku: (sku_id: string) => void
  onSetDefaultSku: (vars: { bahan_baku_id: string; sku_id: string }) => void
  skuSaving: boolean
}

export function BahanBakuDetailModal({
  isOpen, onClose, bahanBaku, onUploadImage, uploading,
  onSave, onSaveMerek, onSaveNama, onSaveSatuan, saving,
  onAddSku, onUpdateSku, onDeleteSku, onSetDefaultSku, skuSaving, setSkuImage
}: BahanBakuDetailModalProps) {
  const fileInputRefBesar = useRef<HTMLInputElement>(null)
  const fileInputRefTengah = useRef<HTMLInputElement>(null)
  const fileInputRefKecil = useRef<HTMLInputElement>(null)
  const skuFileInputRef = useRef<HTMLInputElement>(null)
  
  const [activeSkuUploadId, setActiveSkuUploadId] = useState<string | null>(null)
  const [isEditingHarga, setIsEditingHarga] = useState(false)
  const [draftHarga, setDraftHarga] = useState('')

  const [isEditingMerek, setIsEditingMerek] = useState(false)
  const [draftMerek, setDraftMerek] = useState('')
  
  const [isEditingNama, setIsEditingNama] = useState(false)
  const [draftNama, setDraftNama] = useState('')

  const [isEditingSatuan, setIsEditingSatuan] = useState(false)
  const [draftSatuan, setDraftSatuan] = useState({
    satuan: '',
    satuan_tengah: '',
    faktor_tengah: '',
    satuan_kecil: '',
    faktor_tampilan: ''
  })
  
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [showSkuSection, setShowSkuSection] = useState(false)
  
  useEffect(() => {
    if (isOpen && bahanBaku) {
      setIsEditingHarga(false)
      setDraftHarga('')
      setIsEditingMerek(false)
      setDraftMerek(bahanBaku.merek || '')
      setIsEditingNama(false)
      setDraftNama(bahanBaku.nama || '')
      setShowSkuSection(false)
      setIsEditingSatuan(false)
      setDraftSatuan({
        satuan: bahanBaku.satuan,
        satuan_tengah: bahanBaku.satuan_tengah || '',
        faktor_tengah: bahanBaku.faktor_tengah ? String(bahanBaku.faktor_tengah) : '',
        satuan_kecil: bahanBaku.satuan_kecil || '',
        faktor_tampilan: bahanBaku.faktor_tampilan ? String(bahanBaku.faktor_tampilan) : ''
      })
    }
  }, [isOpen, bahanBaku])
  
  if (!isOpen || !bahanBaku) return null

  const hargaBesar = bahanBaku.harga?.harga_beli || 0
  const hargaTengah = bahanBaku.faktor_tengah ? hargaBesar / bahanBaku.faktor_tengah : hargaBesar
  // faktor_tampilan selalu relatif terhadap satuan besar (1 blok = faktor_tampilan gram)
  const hargaKecil = bahanBaku.faktor_tampilan ? hargaBesar / bahanBaku.faktor_tampilan : hargaTengah

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, level: 'besar' | 'tengah' | 'kecil') => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadImage(bahanBaku.id, file, level)
    }
    if (e.target) e.target.value = ''
  }

  const handleSkuFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && activeSkuUploadId && setSkuImage) {
      setSkuImage(activeSkuUploadId, file)
    }
    setActiveSkuUploadId(null)
    if (e.target) e.target.value = ''
  }

  const handleSaveSatuanClick = () => {
    onSaveSatuan(
      bahanBaku.id,
      draftSatuan.satuan || 'Pcs',
      draftSatuan.satuan_tengah || null,
      draftSatuan.faktor_tengah ? Number(draftSatuan.faktor_tengah) : null,
      draftSatuan.satuan_kecil || null,
      draftSatuan.faktor_tampilan ? Number(draftSatuan.faktor_tampilan) : null
    )
    setIsEditingSatuan(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-suka-orange/10 flex items-center justify-center">
                <Package className="text-suka-orange w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-suka-brown tracking-tight">Detail Bahan Baku</h2>
                <p className="text-xs text-gray-500 font-medium">Informasi, konfigurasi satuan, dan galeri per kemasan</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Top Grid: Info & Satuan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Main Info */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Bahan Baku</label>
                    {!isEditingNama && (
                      <button 
                        onClick={() => {
                          setIsEditingNama(true)
                          setDraftNama(bahanBaku.nama || '')
                        }}
                        className="text-suka-orange hover:bg-orange-50 p-1 rounded transition-colors"
                        title="Edit Nama"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  
                  {isEditingNama ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        className="w-full rounded-lg border border-suka-gray-300 px-3 py-1.5 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-sm font-bold" 
                        value={draftNama}
                        onChange={(e) => setDraftNama(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter' && draftNama.trim()) {
                            onSaveNama(bahanBaku.id, draftNama.trim())
                            setIsEditingNama(false)
                          }
                          if (e.key === 'Escape') setIsEditingNama(false) 
                        }}
                        disabled={saving}
                      />
                      <button 
                        onClick={() => {
                          if (draftNama.trim()) {
                            onSaveNama(bahanBaku.id, draftNama.trim())
                            setIsEditingNama(false)
                          }
                        }}
                        disabled={saving || !draftNama.trim()}
                        className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setIsEditingNama(false)}
                        disabled={saving}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-lg font-bold text-suka-ink">{bahanBaku.nama}</div>
                  )}
                </div>
                
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kategori</label>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                      {bahanBaku.kategori}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Merek</label>
                    {!isEditingMerek && (
                      <button 
                        onClick={() => {
                          setIsEditingMerek(true)
                          setDraftMerek(bahanBaku.merek || '')
                        }}
                        className="text-suka-orange hover:bg-orange-50 p-1 rounded transition-colors"
                        title="Edit Merek"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  
                  {isEditingMerek ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        className="w-48 rounded-lg border border-suka-gray-300 px-3 py-1.5 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-sm font-bold" 
                        value={draftMerek}
                        onChange={(e) => setDraftMerek(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') {
                            onSaveMerek(bahanBaku.id, draftMerek.trim() || null)
                            setIsEditingMerek(false)
                          }
                          if (e.key === 'Escape') setIsEditingMerek(false) 
                        }}
                        disabled={saving}
                      />
                      <button 
                        onClick={() => {
                          onSaveMerek(bahanBaku.id, draftMerek.trim() || null)
                          setIsEditingMerek(false)
                        }}
                        disabled={saving}
                        className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setIsEditingMerek(false)}
                        disabled={saving}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm font-medium text-gray-600">
                      {bahanBaku.merek || '—'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Harga Beli</label>
                    {!isEditingHarga && (
                      <button 
                        onClick={() => {
                          setIsEditingHarga(true)
                          setDraftHarga(bahanBaku.harga ? String(bahanBaku.harga.harga_beli) : '')
                        }}
                        className="text-suka-orange hover:bg-orange-50 p-1 rounded transition-colors"
                        title="Edit Harga"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  
                  {isEditingHarga ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        className="w-32 rounded-lg border border-suka-gray-300 px-3 py-1.5 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-sm font-bold" 
                        inputMode="numeric"
                        value={draftHarga ? Number(draftHarga).toLocaleString('id-ID') : ''}
                        onChange={(e) => setDraftHarga(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') {
                            const parsed = parsePriceInput(draftHarga)
                            if (parsed !== null) onSave(bahanBaku.id, parsed)
                            setIsEditingHarga(false)
                          }
                          if (e.key === 'Escape') setIsEditingHarga(false) 
                        }}
                        disabled={saving}
                      />
                      <button 
                        onClick={() => {
                          const parsed = parsePriceInput(draftHarga)
                          if (parsed !== null) onSave(bahanBaku.id, parsed)
                          setIsEditingHarga(false)
                        }}
                        disabled={saving}
                        className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setIsEditingHarga(false)}
                        disabled={saving}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-xl font-extrabold text-suka-orange">
                      {bahanBaku.harga ? rupiah(bahanBaku.harga.harga_beli) : 'Belum diatur'}
                    </div>
                  )}
                  
                  {bahanBaku.harga?.harga_updated_at && !isEditingHarga && (
                    <p className="text-xs text-gray-400 mt-1">
                      Diperbarui: {new Date(bahanBaku.harga.harga_updated_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Satuan Bertingkat */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Konversi Satuan Bertingkat</label>
                  {!isEditingSatuan && (
                    <button 
                      onClick={() => setIsEditingSatuan(true)}
                      className="text-suka-orange flex items-center gap-1 text-xs font-semibold hover:bg-orange-50 px-2 py-1 rounded transition-colors"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  )}
                </div>
                
                {isEditingSatuan ? (
                  <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Besar (Utama)</label>
                      <select 
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
                        value={draftSatuan.satuan}
                        onChange={e => setDraftSatuan({...draftSatuan, satuan: e.target.value})}
                      >
                        {!SATUAN_OPTIONS.includes(draftSatuan.satuan) && draftSatuan.satuan && (
                          <option value={draftSatuan.satuan}>{draftSatuan.satuan}</option>
                        )}
                        {SATUAN_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Faktor (Isi)</label>
                        <input 
                          type="number"
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                          value={draftSatuan.faktor_tengah}
                          onChange={e => setDraftSatuan({...draftSatuan, faktor_tengah: e.target.value})}
                          placeholder="Contoh: 10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Tengah</label>
                        <select 
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
                          value={draftSatuan.satuan_tengah}
                          onChange={e => setDraftSatuan({...draftSatuan, satuan_tengah: e.target.value})}
                        >
                          <option value="">(Tidak Ada)</option>
                          {!SATUAN_OPTIONS.includes(draftSatuan.satuan_tengah) && draftSatuan.satuan_tengah && (
                            <option value={draftSatuan.satuan_tengah}>{draftSatuan.satuan_tengah}</option>
                          )}
                          {SATUAN_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Faktor (Isi Terkecil)</label>
                        <input 
                          type="number"
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                          value={draftSatuan.faktor_tampilan}
                          onChange={e => setDraftSatuan({...draftSatuan, faktor_tampilan: e.target.value})}
                          placeholder="Contoh: 100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Satuan Kecil</label>
                        <select 
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
                          value={draftSatuan.satuan_kecil}
                          onChange={e => setDraftSatuan({...draftSatuan, satuan_kecil: e.target.value})}
                        >
                          <option value="">(Tidak Ada)</option>
                          {!SATUAN_OPTIONS.includes(draftSatuan.satuan_kecil) && draftSatuan.satuan_kecil && (
                            <option value={draftSatuan.satuan_kecil}>{draftSatuan.satuan_kecil}</option>
                          )}
                          {SATUAN_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingSatuan(false)} disabled={saving}>Batal</Button>
                      <Button variant="primary" size="sm" onClick={handleSaveSatuanClick} disabled={saving}>Simpan Satuan</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Satuan Besar</span>
                        <span className="font-bold text-suka-ink text-lg">{bahanBaku.satuan}</span>
                      </div>
                      {bahanBaku.harga?.harga_beli && (
                        <div className="text-sm font-bold text-suka-orange bg-orange-50 px-2 py-1 rounded-md self-start border border-orange-200">
                          {rupiah(hargaBesar)} / {bahanBaku.satuan}
                        </div>
                      )}
                    </div>

                    {bahanBaku.satuan_tengah && (
                      <div className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-500">Satuan Tengah</span>
                            <span className="text-xs font-semibold text-gray-400 mt-0.5">1 {bahanBaku.satuan} = {bahanBaku.faktor_tengah} {bahanBaku.satuan_tengah}</span>
                          </div>
                          <span className="font-bold text-suka-ink text-lg">{bahanBaku.satuan_tengah}</span>
                        </div>
                        {bahanBaku.harga?.harga_beli && (
                          <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md self-start border border-emerald-200">
                            {rupiah(hargaTengah)} / {bahanBaku.satuan_tengah}
                          </div>
                        )}
                      </div>
                    )}

                    {bahanBaku.satuan_kecil && (
                      <div className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-500">Satuan Kecil</span>
                            <span className="text-xs font-semibold text-gray-400 mt-0.5">
                              {bahanBaku.satuan_tengah ? `${bahanBaku.faktor_tengah || 1} ${bahanBaku.satuan_tengah}` : `1 ${bahanBaku.satuan}`} = {bahanBaku.faktor_tampilan} {bahanBaku.satuan_kecil}
                            </span>
                            {/* Tambahkan baris normalisasi per 1 satuan tengah jika faktor_tengah > 1 */}
                            {bahanBaku.satuan_tengah && (bahanBaku.faktor_tengah || 1) > 1 && bahanBaku.faktor_tampilan && (
                              <span className="text-xs text-gray-400 mt-0.5">
                                (1 {bahanBaku.satuan_tengah} = {Math.round(bahanBaku.faktor_tampilan / (bahanBaku.faktor_tengah || 1))} {bahanBaku.satuan_kecil})
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-suka-ink text-lg">{bahanBaku.satuan_kecil}</span>
                        </div>
                        {bahanBaku.harga?.harga_beli && (
                          <div className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md self-start border border-amber-200">
                            {rupiah(hargaKecil)} / {bahanBaku.satuan_kecil}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                {bahanBaku.skus && bahanBaku.skus.length > 0 ? (
                  bahanBaku.skus.map((sku) => {
                    const hargaSatuan = sku.qty_isi > 0 ? sku.harga_beli / sku.qty_isi : 0
                    const isCheapest = Math.min(...(bahanBaku.skus?.filter(s => s.qty_isi > 0).map(s => s.harga_beli / s.qty_isi) || [0])) === hargaSatuan
                    
                    return (
                      <div key={sku.id} className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 gap-3 hover:border-gray-300 transition-colors shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <div 
                              className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center"
                              onClick={() => { setActiveSkuUploadId(sku.id); skuFileInputRef.current?.click() }}
                              title="Klik untuk ubah gambar"
                            >
                              {sku.image_url ? (
                                <img src={sku.image_url} alt={sku.nama_kemasan} className="w-full h-full object-cover" />
                              ) : (
                                <Camera size={16} className="text-gray-400" />
                              )}
                            </div>
                            <div className="flex flex-col justify-center">
                              <span className="text-sm font-bold text-suka-ink">{sku.nama_kemasan}</span>
                              <span className="text-xs font-semibold text-gray-500 mt-0.5">
                                {sku.tingkatan_satuan && (
                                  <span className={`inline-block mr-1.5 font-bold ${sku.tingkatan_satuan === 'Besar' ? 'text-blue-600' : sku.tingkatan_satuan === 'Tengah' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {sku.tingkatan_satuan}
                                  </span>
                                )}
                                {sku.tingkatan_satuan && <span className="mr-1.5">•</span>} 
                                Isi: {sku.qty_isi} {bahanBaku.satuan_kecil || bahanBaku.satuan} 
                                <span className="mx-1.5">•</span> 
                                Harga Beli: {rupiah(sku.harga_beli)}
                              </span>
                              <div className="flex gap-1.5 mt-1.5">
                                {sku.is_default && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold">DEFAULT HPP</span>}
                                {isCheapest && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-bold">TERMURAH</span>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 text-xs pt-1">
                            {!sku.is_default && (
                              <button onClick={() => onSetDefaultSku({ bahan_baku_id: bahanBaku.id, sku_id: sku.id })} disabled={skuSaving} className="font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md">Default</button>
                            )}
                            <button onClick={() => onDeleteSku(sku.id)} disabled={skuSaving} className="font-bold text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md">Hapus</button>
                          </div>
                        </div>
                        
                        <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded-md self-start border border-gray-200">
                          {rupiah(hargaSatuan)} / {bahanBaku.satuan_kecil || bahanBaku.satuan}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-4 text-center text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-lg shadow-sm">
                    Belum ada kemasan. Silakan tambah kemasan baru.
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" ref={skuFileInputRef} onChange={handleSkuFileChange} />
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
                        <option value="">(Pilih)</option>
                        <option value="Besar">Besar</option>
                        {bahanBaku.satuan_tengah && <option value="Tengah">Tengah</option>}
                        {bahanBaku.satuan_kecil && <option value="Kecil">Kecil</option>}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Total Isi ({bahanBaku.satuan_kecil || bahanBaku.satuan})</label>
                      <input type="number" id="newSkuQty" placeholder="600" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Harga Beli</label>
                      <input type="number" id="newSkuHarga" placeholder="15000" className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white focus:border-suka-orange outline-none" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button 
                      type="button"
                      onClick={() => setShowSkuSection(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                    <Button 
                      variant="primary" 
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      disabled={skuSaving}
                      onClick={() => {
                        const nama = (document.getElementById('newSkuNama') as HTMLInputElement).value
                        const tingkatan = (document.getElementById('newSkuTingkatan') as HTMLSelectElement).value
                        const qty = Number((document.getElementById('newSkuQty') as HTMLInputElement).value)
                        const harga = Number((document.getElementById('newSkuHarga') as HTMLInputElement).value)
                        
                        if (!nama || qty <= 0 || harga <= 0) {
                          alert('Mohon isi semua data kemasan dengan benar')
                          return
                        }
                        
                        onAddSku({
                          bahan_baku_id: bahanBaku.id,
                          nama_kemasan: nama,
                          qty_isi: qty,
                          harga_beli: harga,
                          is_default: !bahanBaku.skus || bahanBaku.skus.length === 0,
                          tingkatan_satuan: tingkatan || null
                        })
                        
                        // reset form & hide
                        ;(document.getElementById('newSkuNama') as HTMLInputElement).value = '';
                        ;(document.getElementById('newSkuTingkatan') as HTMLSelectElement).value = '';
                        ;(document.getElementById('newSkuQty') as HTMLInputElement).value = '';
                        ;(document.getElementById('newSkuHarga') as HTMLInputElement).value = '';
                        setShowSkuSection(false);
                      }}
                    >
                      Simpan Kemasan
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Photo Slots Per Level */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div>
                <label className="text-sm font-bold text-suka-ink flex items-center gap-2">
                  <ImageIcon size={18} className="text-gray-400" />
                  Foto Masing-Masing Kemasan
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Unggah foto spesifik untuk setiap tingkatan satuan.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                
                {/* Besar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">{bahanBaku.satuan}</span>
                  </div>
                  <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center">
                    {bahanBaku.image_url ? (
                      <>
                        <img src={bahanBaku.image_url} alt={bahanBaku.satuan} className="w-full h-full object-cover" onClick={() => setLightboxImg(bahanBaku.image_url!)} />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setLightboxImg(bahanBaku.image_url!)} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Perbesar"><ZoomIn size={14} /></button>
                          <button onClick={() => fileInputRefBesar.current?.click()} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Ubah Foto"><Pencil size={14} /></button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4" onClick={() => fileInputRefBesar.current?.click()}>
                        <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                        <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{bahanBaku.satuan}</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRefBesar} onChange={(e) => handleFileChange(e, 'besar')} />
                  </div>
                </div>

                {/* Tengah */}
                {bahanBaku.satuan_tengah && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">{bahanBaku.satuan_tengah}</span>
                    </div>
                    <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center">
                      {bahanBaku.image_url_tengah ? (
                        <>
                          <img src={bahanBaku.image_url_tengah} alt={bahanBaku.satuan_tengah} className="w-full h-full object-cover" onClick={() => setLightboxImg(bahanBaku.image_url_tengah!)} />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setLightboxImg(bahanBaku.image_url_tengah!)} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Perbesar"><ZoomIn size={14} /></button>
                            <button onClick={() => fileInputRefTengah.current?.click()} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Ubah Foto"><Pencil size={14} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4" onClick={() => fileInputRefTengah.current?.click()}>
                          <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{bahanBaku.satuan_tengah}</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRefTengah} onChange={(e) => handleFileChange(e, 'tengah')} />
                    </div>
                  </div>
                )}

                {/* Kecil */}
                {bahanBaku.satuan_kecil && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">{bahanBaku.satuan_kecil}</span>
                    </div>
                    <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative group bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center">
                      {bahanBaku.image_url_kecil ? (
                        <>
                          <img src={bahanBaku.image_url_kecil} alt={bahanBaku.satuan_kecil} className="w-full h-full object-cover" onClick={() => setLightboxImg(bahanBaku.image_url_kecil!)} />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setLightboxImg(bahanBaku.image_url_kecil!)} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Perbesar"><ZoomIn size={14} /></button>
                            <button onClick={() => fileInputRefKecil.current?.click()} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black/80" title="Ubah Foto"><Pencil size={14} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4" onClick={() => fileInputRefKecil.current?.click()}>
                          <Camera size={24} className="mx-auto text-gray-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Unggah Foto<br/>{bahanBaku.satuan_kecil}</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRefKecil} onChange={(e) => handleFileChange(e, 'kecil')} />
                    </div>
                  </div>
                )}

              </div>
              
              {uploading && (
                <div className="flex items-center gap-2 text-suka-orange text-sm font-medium mt-2">
                  <div className="w-4 h-4 border-2 border-suka-orange border-t-transparent rounded-full animate-spin" />
                  Sedang mengunggah foto...
                </div>
              )}
            </div>
            
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setLightboxImg(null)}>
          <button 
            className="absolute top-4 right-4 p-2 bg-white/10 text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxImg} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
