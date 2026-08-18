'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Plus, Package } from 'lucide-react'
import { Spinner } from '@suka/design-system'

interface BahanBakuAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (vars: { nama: string; kategori: string; satuan: string; harga_beli?: number }) => void
  isSaving: boolean
}

// Rekomendasi kategori umum
const KATEGORI_OPTIONS = [
  'Sayur',
  'Daging',
  'Ayam',
  'Bumbu',
  'Saus',
  'Bahan Kering',
  'Packaging',
  'Minuman',
  'Lain-lain'
]

export function BahanBakuAddModal({ isOpen, onClose, onAdd, isSaving }: BahanBakuAddModalProps) {
  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('Sayur')
  const [kategoriCustom, setKategoriCustom] = useState('')
  const [satuan, setSatuan] = useState('')
  const [harga, setHarga] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalKategori = kategori === 'custom' ? kategoriCustom : kategori
    if (!nama.trim() || !finalKategori.trim() || !satuan.trim()) {
      alert('Nama, kategori, dan satuan wajib diisi.')
      return
    }

    onAdd({
      nama: nama.trim(),
      kategori: finalKategori.trim(),
      satuan: satuan.trim(),
      harga_beli: harga ? Number(harga) : undefined
    })
  }

  // Reset form when opened/closed if needed, but since it's remounted usually, we don't strictly need it.
  // Actually it's good practice to reset
  const handleClose = () => {
    if (isSaving) return
    setNama('')
    setKategori('Sayur')
    setKategoriCustom('')
    setSatuan('')
    setHarga('')
    onClose()
  }

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
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

                  <div>
                    <label className="block text-sm font-bold text-suka-ink mb-1.5">
                      Satuan Dasar (Kemasan Besar) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={satuan}
                      onChange={(e) => setSatuan(e.target.value)}
                      disabled={isSaving}
                      placeholder="Contoh: Kg, Liter, Karung, Ball"
                      className="w-full rounded-xl border border-suka-gray-300 px-3 py-2 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange disabled:bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Satuan ini akan menjadi SKU default. Satuan bertingkat lainnya dapat ditambahkan nanti.
                    </p>
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
