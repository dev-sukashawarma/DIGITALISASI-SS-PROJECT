'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  Plus, Trash2, X, Loader2, Copy,
  AlertCircle, UploadCloud, Sandwich,
  Search, ChevronRight, Store, Sparkles, Globe, Tag, Smartphone,
  BookOpen, Package
} from 'lucide-react'
import { CurrencyInput } from '@suka/design-system'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category, Outlet } from '@/pos-types'
import { MenuPicker } from './MenuPicker'

export type ModalTab = 'basic' | 'channels' | 'composition'

export interface MenuFormState {
  id: string | null
  name: string
  description: string
  price: string
  strike_price: string
  campaign_price: string
  is_campaign_active: boolean
  base_price: string
  channel_prices: Record<string, string>
  category_id: string
  is_available: boolean
  is_hidden_pos: boolean
  is_available_online: boolean
  is_published_order_online: boolean
  tampil_di_app: boolean
  available_online_channels: string[] | null
  image_url: string | null
  is_package: boolean
  package_items: { menu_item_id: string; or_menu_item_id?: string | null; quantity: number; temp_id: string }[]
  outlet_ids: string[] | null
}

export interface MenuRecipeRow {
  temp_id: string
  bahan_baku_id: string
  qty_per_porsi: number | string
  satuan: string
}

interface BahanOption {
  id: string
  nama: string
  satuan: string
  satuan_kecil?: string
}

interface HppSummary {
  totalHpp: number
  marginPct: number | null
  lines: Array<{ bahan_baku_id: string; subtotal: number }>
}

interface MenuFormModalProps {
  open: boolean
  form: MenuFormState
  setForm: React.Dispatch<React.SetStateAction<MenuFormState>>
  modalTab: ModalTab
  setModalTab: (tab: ModalTab) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
  uploading: boolean
  error: string
  copyNotice: string | null
  onDismissCopyNotice: () => void
  displayImage: string | null
  preview: string | null
  resetImage: () => void
  fileRef: React.RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  initialItems: MenuItem[]
  initialCategories: Category[]
  initialOutlets: Outlet[]
  onCopyFrom: (sourceId: string) => void
  slugAplikasi: string
  outletSearch: string
  setOutletSearch: (val: string) => void
  activeChannelCount: number
  recipeItems: MenuRecipeRow[]
  bahanList: BahanOption[]
  hppResult: HppSummary
  onAddRecipeItem: () => void
  onRemoveRecipeItem: (idx: number) => void
  onRecipeBahanChange: (idx: number, bahanId: string) => void
  onRecipeQtyChange: (idx: number, val: string) => void
  onOpenQuickBahan: () => void
  renderChannelIcon: (channelKey: string) => React.ReactNode
}

function ToggleSwitch({
  checked,
  activeColor = 'bg-emerald-500',
}: {
  checked: boolean
  activeColor?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 inline-block ${
        checked ? activeColor : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-xs transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </span>
  )
}

export function MenuFormModal({
  open,
  form,
  setForm,
  modalTab,
  setModalTab,
  onClose,
  onSubmit,
  saving,
  uploading,
  error,
  copyNotice,
  onDismissCopyNotice,
  displayImage,
  preview,
  resetImage,
  fileRef,
  onFileChange,
  initialItems,
  initialCategories,
  initialOutlets,
  onCopyFrom,
  slugAplikasi,
  outletSearch,
  setOutletSearch,
  activeChannelCount,
  recipeItems,
  bahanList,
  hppResult,
  onAddRecipeItem,
  onRemoveRecipeItem,
  onRecipeBahanChange,
  onRecipeQtyChange,
  onOpenQuickBahan,
  renderChannelIcon,
}: MenuFormModalProps) {
  if (!open) return null

  const DELIVERY_APP_SLUGS = ['gofood', 'grabfood', 'shopeefood']
  const normChannels = Array.isArray(form.available_online_channels)
    ? form.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
    : null

  const isWalkinEnabled =
    normChannels === null ||
    (normChannels.length === 0 && !form.is_available_online) ||
    normChannels.includes('pos_kasir')

  const isDeliveryEnabled =
    form.is_available_online &&
    (normChannels === null || normChannels.some(c => DELIVERY_APP_SLUGS.includes(c)))

  const isTiktokEnabled =
    form.is_available_online &&
    (normChannels === null || normChannels.includes('tiktokgo') || normChannels.includes('tiktok_go'))

  const buildChannelState = (walkin: boolean, deliveryOn: boolean, tiktokOn: boolean) => {
    const anyOnline = deliveryOn || tiktokOn
    let channels: string[] | null
    if (!anyOnline) {
      channels = walkin ? ['pos_kasir'] : []
    } else if (walkin && deliveryOn && tiktokOn) {
      channels = null
    } else {
      channels = [
        ...(walkin ? ['pos_kasir'] : []),
        ...(deliveryOn ? DELIVERY_APP_SLUGS : []),
        ...(tiktokOn ? ['tiktokgo'] : []),
      ]
    }
    return {
      is_available_online: anyOnline,
      available_online_channels: channels,
    }
  }

  const deliveryUnifiedValue =
    form.channel_prices['gofood'] ||
    form.channel_prices['grabfood'] ||
    form.channel_prices['shopeefood'] ||
    form.channel_prices['all_food_apps'] ||
    form.price

  const tiktokPriceValue =
    form.channel_prices['tiktokgo'] ||
    form.channel_prices['tiktok_go'] ||
    form.price

  const parsedPrice = parseFloat(form.price)
  const hasValidPrice = form.price !== '' && !isNaN(parsedPrice) && parsedPrice >= 0
  const compositionCount = form.is_package ? form.package_items.length : recipeItems.length

  const recalculatePackagePrice = (items: MenuFormState['package_items']) => {
    let total = 0
    items.forEach(item => {
      const m = initialItems.find(x => x.id === item.menu_item_id)
      if (m) total += m.price * item.quantity
    })
    return String(total)
  }

  const outletSummary =
    form.outlet_ids === null
      ? 'Semua Outlet'
      : form.outlet_ids.length === 0
        ? 'Belum pilih outlet'
        : `${form.outlet_ids.length} Outlet`

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4 lg:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-form-modal-title"
        className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[88vh] animate-scale-in overflow-hidden border border-slate-200/80"
      >
        {/* ── STICKY HEADER + TAB NAVIGATION ── */}
        <div className="px-5 pt-4 sm:px-7 sm:pt-5 border-b border-slate-200/80 shrink-0 bg-white z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200/70 shrink-0">
                <Sandwich className="w-5 h-5 text-amber-500" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h2
                  id="menu-form-modal-title"
                  className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight truncate"
                >
                  {form.id ? 'Edit Menu' : 'Tambah Menu Baru'}
                </h2>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {form.id
                    ? 'Perbarui detail, harga channel, dan komposisi menu'
                    : 'Isi info dasar untuk simpan cepat, atau atur channel & resep'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Quiet secondary action: Copy from existing menu */}
              {initialItems.length > 0 && (
                <div className="relative hidden sm:flex items-center">
                  <Copy className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <select
                    aria-label="Salin data dari menu lain"
                    defaultValue=""
                    onChange={(e) => {
                      const sourceId = e.target.value
                      if (sourceId) {
                        onCopyFrom(sourceId)
                        e.target.value = ''
                      }
                    }}
                    className="w-40 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>Salin dari menu...</option>
                    {initialItems
                      .filter(i => i.id !== form.id)
                      .map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({formatRupiah(item.price)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup modal"
                className="w-9 h-9 bg-slate-50 hover:bg-slate-100 hover:text-slate-700 rounded-xl flex items-center justify-center text-slate-400 transition-colors border border-slate-200/70 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Mobile compact copy selector */}
          {initialItems.length > 0 && (
            <div className="relative flex sm:hidden items-center mt-3">
              <Copy className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                aria-label="Salin data dari menu lain"
                defaultValue=""
                onChange={(e) => {
                  const sourceId = e.target.value
                  if (sourceId) {
                    onCopyFrom(sourceId)
                    e.target.value = ''
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                <option value="" disabled>Salin harga &amp; resep dari menu lain...</option>
                {initialItems
                  .filter(i => i.id !== form.id)
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatRupiah(item.price)})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Underline Tab Bar */}
          <div role="tablist" aria-label="Bagian formulir menu" className="flex items-center gap-1 sm:gap-2 mt-4 -mb-px overflow-x-auto no-scrollbar">
            <button
              type="button"
              role="tab"
              aria-selected={modalTab === 'basic'}
              onClick={() => setModalTab('basic')}
              className={`px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'basic'
                  ? 'border-amber-500 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Info Dasar</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={modalTab === 'channels'}
              onClick={() => setModalTab('channels')}
              className={`px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'channels'
                  ? 'border-amber-500 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Channel &amp; Outlet</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  modalTab === 'channels'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {activeChannelCount} aktif
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={modalTab === 'composition'}
              onClick={() => setModalTab('composition')}
              className={`px-3 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'composition'
                  ? 'border-amber-500 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{form.is_package ? 'Isi Paket' : 'Resep & HPP'}</span>
              {compositionCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    modalTab === 'composition'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {compositionCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── FORM BODY + STICKY FOOTER ── */}
        <form onSubmit={onSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="overflow-y-auto flex-1 min-h-0 px-5 py-5 sm:px-7 sm:py-6 bg-white space-y-5">
            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-red-700 text-xs sm:text-sm"
              >
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Copy Notice */}
            {copyNotice && (
              <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200/80 rounded-xl px-3.5 py-2.5 text-blue-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold truncate">{copyNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={onDismissCopyNotice}
                  aria-label="Tutup notifikasi"
                  className="text-blue-500 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: INFO DASAR                                               */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {modalTab === 'basic' && (
              <div role="tabpanel" className="space-y-5 animate-in fade-in duration-150">
                {/* Foto Compact + Nama Menu & Kategori */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
                  {/* Compact Photo Uploader */}
                  <div className="flex sm:flex-col items-center gap-3 sm:gap-1.5 shrink-0 w-full sm:w-28">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          fileRef.current?.click()
                        }
                      }}
                      className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed transition-all group cursor-pointer overflow-hidden flex flex-col items-center justify-center shrink-0 ${
                        displayImage
                          ? 'border-slate-200 bg-slate-900'
                          : 'border-slate-300 bg-slate-50/70 hover:bg-amber-50/50 hover:border-amber-400'
                      }`}
                    >
                      {displayImage ? (
                        <>
                          <Image
                            src={displayImage}
                            alt="Preview foto menu"
                            fill
                            className="object-cover group-hover:opacity-50 transition-opacity"
                            unoptimized={true}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <UploadCloud className="w-5 h-5 text-white drop-shadow" />
                            <span className="text-[10px] font-bold text-white mt-0.5 drop-shadow">Ganti</span>
                          </div>
                          {preview && (
                            <span className="absolute bottom-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md z-10">
                              BARU
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label="Hapus foto"
                            onClick={(e) => {
                              e.stopPropagation()
                              preview ? resetImage() : setForm(p => ({ ...p, image_url: null }))
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-red-600 text-white flex items-center justify-center z-20 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2">
                          <UploadCloud className="w-5 h-5 text-amber-500 mb-1 group-hover:scale-105 transition-transform" />
                          <span className="text-[11px] font-bold text-slate-600 group-hover:text-amber-700 leading-tight">
                            Upload Foto
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 sm:text-center leading-tight">
                      JPG, PNG, WebP<br className="hidden sm:inline" /> (maks. 5MB)
                    </p>
                  </div>

                  {/* Nama Menu & Kategori */}
                  <div className="flex-1 min-w-0 w-full space-y-3.5">
                    <div>
                      <label htmlFor="menu-name-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nama Menu <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="menu-name-input"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        maxLength={100}
                        className="input bg-white border-slate-200 focus:border-amber-500 text-sm sm:text-base font-semibold py-2.5"
                        placeholder="Cth: Spesial Suka Lovers"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label htmlFor="menu-category-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Kategori Menu
                      </label>
                      <select
                        id="menu-category-select"
                        value={form.category_id}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                        className="input bg-white border-slate-200 focus:border-amber-500 text-sm py-2.5 font-medium text-slate-800"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {initialCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Harga Offline & Harga Coret */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Harga Offline (POS) <span className="text-red-500">*</span>
                      </label>
                      {hasValidPrice && parsedPrice === 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          GRATIS / Rp 0
                        </span>
                      )}
                    </div>
                    <CurrencyInput
                      value={form.price}
                      onChange={(v) => {
                        const valStr = String(v)
                        setForm(prev => ({
                          ...prev,
                          price: valStr,
                          channel_prices: {
                            ...prev.channel_prices,
                            pos_kasir: valStr,
                          },
                        }))
                      }}
                      className="input bg-white border-slate-200 focus:border-amber-500 font-bold text-slate-900 text-sm py-2.5"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Harga Coret <span className="text-slate-400 font-normal">(opsional)</span>
                    </label>
                    <CurrencyInput
                      value={form.strike_price}
                      onChange={(v) => setForm({ ...form, strike_price: String(v) })}
                      className="input bg-white border-slate-200 focus:border-amber-500 text-slate-900 text-sm py-2.5"
                    />
                  </div>
                </div>

                {/* Tipe Menu */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-700 block">Tipe Menu</label>
                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_package: false })}
                      className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                        !form.is_package
                          ? 'bg-white shadow-xs text-slate-900'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Satuan
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_package: true })}
                      className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                        form.is_package
                          ? 'bg-white shadow-xs text-slate-900'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Paket (Combo)
                    </button>
                  </div>

                  {form.is_package && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-medium text-amber-900 truncate">
                          {form.package_items.length > 0
                            ? `${form.package_items.length} item sudah diatur dalam paket ini.`
                            : 'Belum ada item di dalam paket combo ini.'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalTab('composition')}
                        className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 shrink-0 cursor-pointer"
                      >
                        Atur Isi Paket
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Deskripsi */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="menu-desc-input" className="text-xs font-bold text-slate-700">
                      Deskripsi <span className="text-slate-400 font-normal">(opsional)</span>
                    </label>
                    {form.description.length > 0 && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        {form.description.length}/300
                      </span>
                    )}
                  </div>
                  <textarea
                    id="menu-desc-input"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={300}
                    rows={2}
                    className="input resize-none bg-white border-slate-200 focus:border-amber-500 text-xs sm:text-sm py-2 font-normal"
                    placeholder="Deskripsi singkat yang menggugah selera..."
                  />
                </div>

                {/* Status Cepat (2 inti saja) */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_available}
                      onClick={() => setForm({ ...form, is_available: !form.is_available })}
                      className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        form.is_available
                          ? 'border-emerald-200/80 bg-emerald-50/35 hover:bg-emerald-50/60'
                          : 'border-rose-200/80 bg-rose-50/35 hover:bg-rose-50/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {form.is_available ? 'Stok Tersedia' : 'Stok Habis'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {form.is_available ? 'Siap dipesan pelanggan' : 'Nonaktif sementara'}
                        </p>
                      </div>
                      <ToggleSwitch checked={form.is_available} activeColor="bg-emerald-500" />
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={!form.is_hidden_pos}
                      onClick={() => setForm({ ...form, is_hidden_pos: !form.is_hidden_pos })}
                      className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        !form.is_hidden_pos
                          ? 'border-slate-200 bg-white hover:bg-slate-50'
                          : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">
                          {form.is_hidden_pos ? 'Tersembunyi di POS' : 'Tampil di POS Kasir'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {form.is_hidden_pos ? 'Disembunyikan dari katalog kasir' : 'Muncul di kasir & kiosk'}
                        </p>
                      </div>
                      <ToggleSwitch checked={!form.is_hidden_pos} activeColor="bg-emerald-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: CHANNEL & OUTLET (Toggle + Harga menyatu!)               */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {modalTab === 'channels' && (
              <div role="tabpanel" className="space-y-5 animate-in fade-in duration-150">
                {/* Section 1: Cakupan Outlet */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-amber-500" />
                      Cakupan Outlet
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih apakah menu ini berlaku otomatis di semua cabang atau hanya cabang tertentu.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, outlet_ids: null })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        form.outlet_ids === null
                          ? 'bg-white shadow-xs text-slate-900'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Semua Outlet (Global)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (form.outlet_ids === null) {
                          setForm({ ...form, outlet_ids: [] })
                        }
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        form.outlet_ids !== null
                          ? 'bg-white shadow-xs text-slate-900'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Outlet Pilihan</span>
                      {form.outlet_ids !== null && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                          {form.outlet_ids.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {form.outlet_ids !== null && initialOutlets.length > 0 && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 animate-in fade-in duration-150">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Cari nama outlet..."
                          value={outletSearch}
                          onChange={e => setOutletSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                      </div>

                      {form.outlet_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {form.outlet_ids.map(id => {
                            const out = initialOutlets.find(o => o.id === id)
                            if (!out) return null
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 text-[11px] font-semibold rounded-md border border-amber-200"
                              >
                                {out.name}
                                <button
                                  type="button"
                                  aria-label={`Hapus ${out.name}`}
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      outlet_ids: form.outlet_ids!.filter(oid => oid !== id),
                                    })
                                  }
                                  className="hover:text-red-500 rounded p-0.5 transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                        {initialOutlets
                          .filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
                          .map(o => {
                            const isChecked = form.outlet_ids!.includes(o.id)
                            return (
                              <label
                                key={o.id}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors border text-xs font-medium select-none ${
                                  isChecked
                                    ? 'bg-white border-amber-300 text-slate-900 font-semibold'
                                    : 'bg-white/70 border-slate-200/70 text-slate-700 hover:bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const curr = form.outlet_ids || []
                                    setForm({
                                      ...form,
                                      outlet_ids: e.target.checked
                                        ? [...curr, o.id]
                                        : curr.filter(id => id !== o.id),
                                    })
                                  }}
                                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="truncate">{o.name}</span>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Saluran Penjualan & Harga (Unified List) */}
                <div className="space-y-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-500" />
                      Saluran Penjualan &amp; Harga Channel
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aktifkan saluran untuk mengatur harga khusus per platform.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden bg-white">
                    {/* 1. Kasir Toko (Walk-in / Offline) */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isWalkinEnabled}
                      onClick={() => {
                        const nextWalkin = !isWalkinEnabled
                        setForm({
                          ...form,
                          ...buildChannelState(nextWalkin, isDeliveryEnabled, isTiktokEnabled),
                        })
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isWalkinEnabled
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">
                            Kasir Toko (Walk-in / Offline)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isWalkinEnabled
                              ? 'Bisa dipesan langsung di kasir (Walk-in)'
                              : 'Khusus Online — tidak muncul di order Walk-in'}
                          </p>
                        </div>
                      </div>
                      <ToggleSwitch checked={isWalkinEnabled} activeColor="bg-amber-500" />
                    </button>

                    {/* 2. Food Apps (GoFood, GrabFood & ShopeeFood) — 1 toggle, 1 harga */}
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isDeliveryEnabled}
                        onClick={() => {
                          const nextDelivery = !isDeliveryEnabled
                          setForm(prev => {
                            const nextState = buildChannelState(isWalkinEnabled, nextDelivery, isTiktokEnabled)
                            const nextPrices = { ...prev.channel_prices }
                            if (nextDelivery) {
                              const syncPrice = deliveryUnifiedValue || prev.price
                              if (syncPrice !== '') {
                                DELIVERY_APP_SLUGS.forEach(s => { nextPrices[s] = syncPrice })
                                nextPrices['all_food_apps'] = syncPrice
                                nextPrices['online'] = syncPrice
                              }
                            }
                            return {
                              ...prev,
                              ...nextState,
                              channel_prices: nextPrices,
                            }
                          })
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isDeliveryEnabled
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Globe className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs sm:text-sm font-bold text-slate-900">
                                Food Apps (GoFood, Grab &amp; Shopee)
                              </p>
                              <span className="flex items-center -space-x-1">
                                {DELIVERY_APP_SLUGS.map(slug => (
                                  <span key={slug} className="ring-1 ring-white rounded-md">
                                    {renderChannelIcon(slug)}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {isDeliveryEnabled
                                ? 'Aktif seragam di GoFood, GrabFood & ShopeeFood'
                                : 'Tidak aktif di GoFood, GrabFood & ShopeeFood'}
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch checked={isDeliveryEnabled} activeColor="bg-indigo-600" />
                      </button>

                      {isDeliveryEnabled && (
                        <div className="px-4 py-3.5 bg-slate-50/80 border-t border-slate-100 space-y-1.5 animate-in fade-in duration-150">
                          <label className="text-xs font-bold text-slate-800 block">
                            Harga Food Apps
                          </label>
                          <CurrencyInput
                            value={deliveryUnifiedValue}
                            onChange={(v) => {
                              const valStr = String(v)
                              setForm(prev => {
                                const newPrices = { ...prev.channel_prices }
                                DELIVERY_APP_SLUGS.forEach(s => { newPrices[s] = valStr })
                                newPrices['all_food_apps'] = valStr
                                newPrices['online'] = valStr
                                return { ...prev, channel_prices: newPrices }
                              })
                            }}
                            placeholder={form.price || '0'}
                            className="input bg-white font-bold text-slate-900 text-sm py-2"
                          />
                          <p className="text-[11px] text-slate-500">
                            Berlaku seragam untuk GoFood, GrabFood, dan ShopeeFood.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 3. TikTok Go — toggle tersendiri + Harga TikTok Go & Harga Campaign */}
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isTiktokEnabled}
                        onClick={() => {
                          const nextTiktok = !isTiktokEnabled
                          setForm(prev => ({
                            ...prev,
                            ...buildChannelState(isWalkinEnabled, isDeliveryEnabled, nextTiktok),
                            is_campaign_active: nextTiktok ? prev.is_campaign_active : false,
                          }))
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isTiktokEnabled
                                ? 'bg-white border-slate-300 shadow-2xs'
                                : 'bg-slate-100 border-transparent opacity-60'
                            }`}
                          >
                            {renderChannelIcon('tiktokgo')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900">
                              TikTok Go
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {isTiktokEnabled
                                ? form.is_campaign_active
                                  ? 'Aktif di TikTok Go • Harga Campaign menyala'
                                  : 'Aktif dijual di TikTok Go'
                                : 'Tidak tampil di TikTok Go'}
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch checked={isTiktokEnabled} activeColor="bg-slate-900" />
                      </button>

                      {isTiktokEnabled && (
                        <div className="px-4 py-3.5 bg-slate-50/80 border-t border-slate-100 space-y-3.5 animate-in fade-in duration-150">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-800 block">
                              Harga TikTok Go
                            </label>
                            <CurrencyInput
                              value={tiktokPriceValue}
                              onChange={(v) => {
                                const valStr = String(v)
                                setForm(prev => ({
                                  ...prev,
                                  channel_prices: {
                                    ...prev.channel_prices,
                                    tiktokgo: valStr,
                                    tiktok_go: valStr,
                                  },
                                }))
                              }}
                              placeholder={form.price || '0'}
                              className="input bg-white font-bold text-slate-900 text-sm py-2"
                            />
                          </div>

                          {/* Sub-opsi Harga Campaign di dalam TikTok Go */}
                          <div className="pt-3 border-t border-slate-200/70 space-y-2.5">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={form.is_campaign_active}
                                onChange={(e) =>
                                  setForm({ ...form, is_campaign_active: e.target.checked })
                                }
                                className="w-4 h-4 mt-0.5 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                                  Aktifkan Harga Campaign
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  Kasir dapat memilih harga normal vs harga campaign saat transaksi.
                                </span>
                              </div>
                            </label>

                            {form.is_campaign_active && (
                              <div className="pl-6 space-y-1.5 animate-in fade-in duration-150">
                                <label className="block text-xs font-bold text-slate-800">
                                  Nominal Harga Campaign <span className="text-red-500">*</span>
                                </label>
                                <CurrencyInput
                                  value={form.campaign_price}
                                  onChange={(v) => setForm({ ...form, campaign_price: String(v) })}
                                  placeholder="0"
                                  className="input bg-white font-bold text-slate-900 text-sm py-2"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. SukaShawarma APP + Harga di Aplikasi */}
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.tampil_di_app}
                        onClick={() => setForm({ ...form, tampil_di_app: !form.tampil_di_app })}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              form.tampil_di_app
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900">
                              SukaShawarma APP
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {form.tampil_di_app
                                ? 'Pelanggan bisa memesan menu ini dari aplikasi'
                                : 'Tidak muncul di aplikasi pelanggan'}
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch checked={form.tampil_di_app} activeColor="bg-amber-500" />
                      </button>

                      {form.tampil_di_app && (
                        <div className="px-4 py-3.5 bg-amber-50/35 border-t border-amber-100 space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800">
                              Harga di Aplikasi <span className="text-slate-400 font-normal">(opsional)</span>
                            </label>
                            {form.channel_prices[slugAplikasi] === '0' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                GRATIS / Rp 0
                              </span>
                            )}
                          </div>
                          <CurrencyInput
                            value={form.channel_prices[slugAplikasi] || ''}
                            onChange={(v) => {
                              const valStr = String(v)
                              setForm(prev => ({
                                ...prev,
                                channel_prices: { ...prev.channel_prices, [slugAplikasi]: valStr },
                              }))
                            }}
                            placeholder={form.price || '0'}
                            className="input bg-white font-bold text-slate-900 text-sm py-2"
                          />
                          <p className="text-[11px] text-slate-500">
                            Kosongkan untuk memakai harga kasir. Terpisah dari pengaturan harga Food Apps.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 5. Website Order-Online */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_published_order_online}
                      onClick={() =>
                        setForm({ ...form, is_published_order_online: !form.is_published_order_online })
                      }
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            form.is_published_order_online
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">
                            Website Order-Online
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {form.is_published_order_online
                              ? 'Menu disinkronkan ke katalog website publik'
                              : 'Hanya tersimpan di internal Admin & POS'}
                          </p>
                        </div>
                      </div>
                      <ToggleSwitch checked={form.is_published_order_online} activeColor="bg-emerald-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: RESEP & HPP (Satuan) ATAU ISI PAKET (Combo)              */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {modalTab === 'composition' && (
              <div role="tabpanel" className="space-y-4 animate-in fade-in duration-150">
                {form.is_package ? (
                  /* ── PACKAGE BUILDER ── */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Komposisi Paket Combo</h3>
                        <p className="text-xs text-slate-500">
                          Harga offline otomatis menyesuaikan total item paket (tetap bisa diedit di Info Dasar).
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                        {form.package_items.length} item
                      </span>
                    </div>

                    {form.package_items.length === 0 ? (
                      <div className="text-center py-9 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm font-bold text-slate-700">Belum ada item di dalam paket</p>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-sm mx-auto">
                          Tambahkan menu satuan yang termasuk dalam paket combo ini.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              package_items: [
                                ...form.package_items,
                                { menu_item_id: '', quantity: 1, temp_id: Math.random().toString() },
                              ],
                            })
                          }
                          className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Item Pertama
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {form.package_items.map((pi, idx) => (
                          <div
                            key={pi.temp_id}
                            className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <MenuPicker
                                  value={pi.menu_item_id}
                                  items={initialItems.filter(i => !i.is_package && i.id !== form.id)}
                                  onChange={(val) => {
                                    const newItems = [...form.package_items]
                                    newItems[idx].menu_item_id = val
                                    setForm({
                                      ...form,
                                      package_items: newItems,
                                      price: recalculatePackagePrice(newItems),
                                    })
                                  }}
                                />
                              </div>
                              <div className="w-16 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  aria-label="Jumlah item paket"
                                  className="input text-center px-1 bg-white py-2 text-xs font-bold"
                                  value={pi.quantity}
                                  onChange={(e) => {
                                    const qty = parseInt(e.target.value) || 1
                                    const newItems = [...form.package_items]
                                    newItems[idx].quantity = qty
                                    setForm({
                                      ...form,
                                      package_items: newItems,
                                      price: recalculatePackagePrice(newItems),
                                    })
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                aria-label="Hapus item paket"
                                onClick={() => {
                                  const newItems = form.package_items.filter((_, i) => i !== idx)
                                  setForm({
                                    ...form,
                                    package_items: newItems,
                                    price: recalculatePackagePrice(newItems),
                                  })
                                }}
                                className="w-8 h-8 shrink-0 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {pi.or_menu_item_id !== undefined && pi.or_menu_item_id !== null ? (
                              <div className="flex items-center gap-2 pl-3 border-l-2 border-amber-300">
                                <span className="text-[10px] font-extrabold text-amber-600 uppercase shrink-0">
                                  ATAU
                                </span>
                                <div className="flex-1 min-w-0">
                                  <MenuPicker
                                    value={pi.or_menu_item_id || ''}
                                    items={initialItems.filter(i => !i.is_package && i.id !== form.id)}
                                    onChange={(val) => {
                                      const newItems = [...form.package_items]
                                      newItems[idx].or_menu_item_id = val
                                      setForm({ ...form, package_items: newItems })
                                    }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  aria-label="Hapus opsi alternatif"
                                  onClick={() => {
                                    const newItems = [...form.package_items]
                                    newItems[idx].or_menu_item_id = null
                                    setForm({ ...form, package_items: newItems })
                                  }}
                                  className="w-7 h-7 shrink-0 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = [...form.package_items]
                                  newItems[idx].or_menu_item_id = ''
                                  setForm({ ...form, package_items: newItems })
                                }}
                                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 pl-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Tambah Opsi Alternatif (Atau)
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              package_items: [
                                ...form.package_items,
                                { menu_item_id: '', quantity: 1, temp_id: Math.random().toString() },
                              ],
                            })
                          }
                          className="w-full py-2.5 text-xs font-bold text-amber-700 bg-amber-50/70 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-amber-200 border-dashed cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Item Paket
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── RESEP & HPP (BOM) ── */
                  <div className="space-y-4">
                    {/* Live HPP Metrics Bar */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Harga Jual
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {hasValidPrice ? formatRupiah(parsedPrice) : '—'}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Total HPP
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatRupiah(hppResult.totalHpp)}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Margin
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                            {hppResult.marginPct !== null ? `${hppResult.marginPct.toFixed(1)}%` : '—'}
                          </span>
                          {hppResult.marginPct !== null && (
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                hppResult.marginPct >= 35
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : hppResult.marginPct >= 20
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {hppResult.marginPct >= 35
                                ? 'SEHAT'
                                : hppResult.marginPct >= 20
                                  ? 'SEDANG'
                                  : 'TIPIS'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {recipeItems.length === 0 ? (
                      <div className="text-center py-9 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm font-bold text-slate-700">
                          Belum ada bahan baku pada resep menu ini
                        </p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto mt-0.5">
                          Opsional — tambahkan bahan baku agar stok otomatis terpotong saat menu terjual di POS.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={onAddRecipeItem}
                            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Tambah Bahan
                          </button>
                          <button
                            type="button"
                            onClick={onOpenQuickBahan}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Buat Bahan Baru
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3">Bahan Baku</th>
                                <th className="py-2.5 px-2.5 w-24">Qty</th>
                                <th className="py-2.5 px-2.5 w-20">Satuan</th>
                                <th className="py-2.5 px-3 w-24 text-right">Subtotal</th>
                                <th className="py-2.5 px-2 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {recipeItems.map((item, idx) => {
                                const lineHpp = hppResult.lines.find(l => l.bahan_baku_id === item.bahan_baku_id)
                                return (
                                  <tr key={item.temp_id} className="hover:bg-slate-50/50">
                                    <td className="py-2 px-3">
                                      <select
                                        value={item.bahan_baku_id}
                                        onChange={(e) => onRecipeBahanChange(idx, e.target.value)}
                                        className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                      >
                                        <option value="">-- Pilih Bahan Baku --</option>
                                        {bahanList.map((bb) => (
                                          <option key={bb.id} value={bb.id}>
                                            {bb.nama} ({bb.satuan_kecil || bb.satuan})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-2 px-2.5">
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={item.qty_per_porsi}
                                        onChange={(e) => onRecipeQtyChange(idx, e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                      />
                                    </td>
                                    <td className="py-2 px-2.5">
                                      <span className="inline-block px-2 py-1 bg-slate-100 rounded-md text-[11px] font-semibold text-slate-600">
                                        {item.satuan || '—'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                                      {lineHpp ? formatRupiah(lineHpp.subtotal) : 'Rp 0'}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => onRemoveRecipeItem(idx)}
                                        aria-label="Hapus bahan"
                                        className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors mx-auto cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={onAddRecipeItem}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Tambah Bahan
                            </button>
                            <button
                              type="button"
                              onClick={onOpenQuickBahan}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              Buat Bahan Baru
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Satuan otomatis mengikuti bahan baku.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── STICKY FOOTER ── */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-7 sm:py-4 border-t border-slate-200/80 shrink-0 bg-slate-50/70 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {/* Live summary (helps confidence when submitting from any tab) */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <span className="font-bold text-slate-800 shrink-0">
                {hasValidPrice ? formatRupiah(parsedPrice) : 'Harga belum diisi'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="truncate">{outletSummary}</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-100 transition-colors text-xs sm:text-sm border border-slate-200 shrink-0 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="btn-primary flex-1 sm:flex-none sm:min-w-[170px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.99] transition-all cursor-pointer"
              >
                {saving || uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploading ? 'Mengupload...' : 'Menyimpan...'}</span>
                  </span>
                ) : form.id ? (
                  'Simpan Perubahan'
                ) : (
                  'Tambah Menu Baru'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
