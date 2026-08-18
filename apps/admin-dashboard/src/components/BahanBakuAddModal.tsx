'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Plus, Package } from 'lucide-react'
import { Spinner } from '@suka/design-system'

interface BahanBakuAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (vars: { 
    nama: string; 
    kategori: string; 
    satuan: string;
    satuan_tengah: string;
    faktor_tengah: number;
    satuan_kecil: string;
    faktor_tampilan: number;
    harga_beli?: number 
  }) => void
  isSaving: boolean
}

// Kategori resmi database
const KATEGORI_OPTIONS = [
  'FOOD & BEVERAGE',
  'BUMBU',
  'PACKAGING',
  'OPERASIONAL'
]

const SATUAN_OPTIONS = [
  'Bal',
  'Blok',
  'Bungkus',
  'Dus',
  'Gram',
  'Ikat',
  'Kaleng',
  'Karton',
  'Karung',
  'Kg',
  'Kompan',
  'Lembar',
  'Liter',
  'Lusin',
  'Ml',
  'Pack',
  'Pcs',
  'Renceng',
  'Roll',
  'Sachet',
  'Sisir',
  'Toples',
  'Tube'
]

export function BahanBakuAddModal({ isOpen, onClose, onAdd, isSaving }: BahanBakuAddModalProps) {
  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('FOOD & BEVERAGE')
  const [kategoriCustom, setKategoriCustom] = useState('')
  
  // Satuan Bertingkat
  const [satuanBesar, setSatuanBesar] = useState('Kg')
  const [satuanBesarCustom, setSatuanBesarCustom] = useState('')

  const [satuanTengah, setSatuanTengah] = useState('Kg')
  const [satuanTengahCustom, setSatuanTengahCustom] = useState('')
  const [faktorTengah, setFaktorTengah] = useState('1')

  const [satuanKecil, setSatuanKecil] = useState('Gram')
  const [satuanKecilCustom, setSatuanKecilCustom] = useState('')
  const [faktorTampilan, setFaktorTampilan] = useState('1000')

  const [harga, setHarga] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalKategori = kategori === 'custom' ? kategoriCustom : kategori
    const finalBesar = satuanBesar === 'custom' ? satuanBesarCustom : satuanBesar
    const finalTengah = satuanTengah === 'custom' ? satuanTengahCustom : satuanTengah
    const finalKecil = satuanKecil === 'custom' ? satuanKecilCustom : satuanKecil

    if (!nama.trim() || !finalKategori.trim() || !finalBesar.trim() || !finalTengah.trim() || !finalKecil.trim() || !faktorTengah || !faktorTampilan) {
      alert('Semua field wajib diisi (kecuali harga beli).')
      return
    }

    onAdd({
      nama: nama.trim(),
      kategori: finalKategori.trim(),
      satuan: finalBesar.trim(),
      satuan_tengah: finalTengah.trim(),
      faktor_tengah: Number(faktorTengah),
      satuan_kecil: finalKecil.trim(),
      faktor_tampilan: Number(faktorTampilan),
      harga_beli: harga ? Number(harga) : undefined
    })
  }

  const handleClose = () => {
    if (isSaving) return
    setNama('')
    setKategori('FOOD & BEVERAGE')
    setKategoriCustom('')
    setSatuanBesar('Kg')
    setSatuanBesarCustom('')
    setSatuanTengah('Kg')
    setSatuanTengahCustom('')
    setFaktorTengah('1')
    setSatuanKecil('Gram')
    setSatuanKecilCustom('')
    setFaktorTampilan('1000')
    setHarga('')
    onClose()
  }

  const effectiveBesar = satuanBesar === 'custom' ? (satuanBesarCustom || 'Besar') : satuanBesar
  const effectiveTengah = satuanTengah === 'custom' ? (satuanTengahCustom || 'Tengah') : satuanTengah
  const effectiveKecil = satuanKecil === 'custom' ? (satuanKecilCustom || 'Kecil') : satuanKecil

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-extrabold leading-6 text-suka-brown flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-suka-cream flex items-center justify-center text-suka-orange">
                      <Package size={18} />
                    </div>
                    Tambah Bahan Baku
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSaving}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-suka-ink mb-1.5">
                      Nama Bahan Baku <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      disabled={isSaving}
                      placeholder="Contoh: Bawang Putih Kating"
                      className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-suka-ink mb-1.5">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-50 mb-2"
                    >
                      {KATEGORI_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="custom">Kategori Lainnya (Tulis Manual)</option>
                    </select>

                    {kategori === 'custom' && (
                      <input
                        type="text"
                        required
                        value={kategoriCustom}
                        onChange={(e) => setKategoriCustom(e.target.value)}
                        disabled={isSaving}
                        placeholder="Ketik kategori baru..."
                        className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-50"
                      />
                    )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <h4 className="text-sm font-bold text-suka-brown mb-2 border-b pb-2">Konversi Satuan *</h4>
                    
                    <div>
                      <label className="block text-xs font-bold text-suka-ink mb-1">
                        Satuan Besar (Dasar) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={satuanBesar}
                        onChange={(e) => setSatuanBesar(e.target.value)}
                        disabled={isSaving}
                        className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                      >
                        {SATUAN_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="custom">Satuan Lainnya (Tulis Manual)</option>
                      </select>

                      {satuanBesar === 'custom' && (
                        <input
                          type="text"
                          required
                          value={satuanBesarCustom}
                          onChange={(e) => setSatuanBesarCustom(e.target.value)}
                          disabled={isSaving}
                          placeholder="Ketik satuan besar baru..."
                          className="w-full mt-1.5 rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-suka-ink mb-1">
                          Satuan Tengah <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={satuanTengah}
                          onChange={(e) => setSatuanTengah(e.target.value)}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                        >
                          {SATUAN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="custom">Satuan Lainnya (Tulis Manual)</option>
                        </select>

                        {satuanTengah === 'custom' && (
                          <input
                            type="text"
                            required
                            value={satuanTengahCustom}
                            onChange={(e) => setSatuanTengahCustom(e.target.value)}
                            disabled={isSaving}
                            placeholder="Ketik satuan tengah..."
                            className="w-full mt-1.5 rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-suka-ink mb-1">
                          1 {effectiveBesar} = ... {effectiveTengah}
                        </label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={faktorTengah}
                          onChange={(e) => setFaktorTengah(e.target.value)}
                          disabled={isSaving}
                          placeholder="Contoh: 10"
                          className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-suka-ink mb-1">
                          Satuan Kecil (Tampilan) <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={satuanKecil}
                          onChange={(e) => setSatuanKecil(e.target.value)}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                        >
                          {SATUAN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="custom">Satuan Lainnya (Tulis Manual)</option>
                        </select>

                        {satuanKecil === 'custom' && (
                          <input
                            type="text"
                            required
                            value={satuanKecilCustom}
                            onChange={(e) => setSatuanKecilCustom(e.target.value)}
                            disabled={isSaving}
                            placeholder="Ketik satuan kecil..."
                            className="w-full mt-1.5 rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-suka-ink mb-1">
                          1 {effectiveTengah} = ... {effectiveKecil}
                        </label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={faktorTampilan}
                          onChange={(e) => setFaktorTampilan(e.target.value)}
                          disabled={isSaving}
                          placeholder="Contoh: 1000"
                          className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-suka-ink mb-1.5">
                      Harga Beli Dasar (Opsional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">Rp</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={harga}
                        onChange={(e) => setHarga(e.target.value)}
                        disabled={isSaving}
                        placeholder="0"
                        className="w-full rounded-xl border border-suka-gray-300 pl-10 pr-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-suka-orange hover:bg-suka-orange/90 rounded-xl transition-colors disabled:opacity-70"
                    >
                      {isSaving ? (
                        <>
                          <Spinner className="w-4 h-4 text-white" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Tambah Bahan
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

