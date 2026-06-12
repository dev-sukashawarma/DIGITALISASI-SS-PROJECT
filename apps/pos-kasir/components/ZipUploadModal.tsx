'use client'

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileArchive, Sparkles,
  Check, AlertCircle, Package, ImageIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'

const BUCKET = 'menu-images'

interface ProductResult {
  filename: string
  name: string
  price: number
  description: string
  mimeType: string
  imageBase64: string
}

interface ImportedItem {
  name: string
  price: number
  success: boolean
  error?: string
}

interface ZipUploadModalProps {
  categories: Category[]
  onClose: () => void
  onComplete: () => void
}

type Step = 'upload' | 'processing' | 'done'

export default function ZipUploadModal({ categories, onClose, onComplete }: ZipUploadModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [progress, setProgress] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [importedItems, setImportedItems] = useState<ImportedItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── Full process: Upload ZIP → AI Analyze → Auto Import ───
  const processAndImport = useCallback(async (file: File) => {
    setError('')

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Hanya file .zip yang didukung')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Ukuran file ZIP maksimal 50 MB')
      return
    }

    setStep('processing')
    setStatusText('Mengupload dan menganalisis gambar dengan AI...')
    setProgress(0)

    try {
      // ── Step 1: Send ZIP to API for AI analysis ──
      const formData = new FormData()
      formData.append('zipFile', file)

      setProgress(5)
      setStatusText('Mengirim file ke server...')

      const res = await fetch('/api/zip-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal memproses ZIP')
        setStep('upload')
        return
      }

      const products: ProductResult[] = data.products
      
      if (!products || products.length === 0) {
        setError('Tidak ada produk yang berhasil dikenali AI')
        setStep('upload')
        return
      }

      setTotalItems(products.length)
      setProgress(40)
      setStatusText(`${products.length} produk dikenali AI — mulai import...`)

      // ── Step 2: Auto-import all products ──
      const supabase = createClient()
      const defaultCategoryId = categories[0]?.id ?? null
      const results: ImportedItem[] = []

      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        const progressPercent = 40 + Math.round(((i + 1) / products.length) * 55)
        
        setStatusText(`Mengimport ${i + 1}/${products.length}: ${product.name}`)
        setProgress(progressPercent)

        try {
          // 2a. Upload image to Supabase Storage
          let imageUrl: string | null = null

          if (product.imageBase64) {
            const imgRes = await fetch(product.imageBase64)
            const blob = await imgRes.blob()
            const ext = product.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : product.mimeType.split('/')[1]
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

            const { error: uploadErr } = await supabase.storage
              .from(BUCKET)
              .upload(fileName, blob, { contentType: product.mimeType })

            if (uploadErr) {
              console.error(`Upload failed for ${product.name}:`, uploadErr.message)
            } else {
              imageUrl = supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl
            }
          }

          // 2b. Insert menu item into database
          const { error: insertErr } = await supabase.from('menu_items').insert({
            name: product.name,
            description: product.description || null,
            price: product.price,
            category_id: defaultCategoryId,
            image_url: imageUrl,
            is_available: true,
            sort_order: 0,
          })

          if (insertErr) {
            console.error(`Insert failed for ${product.name}:`, insertErr.message)
            results.push({ name: product.name, price: product.price, success: false, error: insertErr.message })
          } else {
            results.push({ name: product.name, price: product.price, success: true })
          }
        } catch (err) {
          console.error('Import error for:', product.name, err)
          results.push({ name: product.name, price: product.price, success: false, error: 'Unexpected error' })
        }

        // Small delay to prevent overwhelming Supabase
        await new Promise(r => setTimeout(r, 200))
      }

      setImportedItems(results)
      setProgress(100)
      setStep('done')
    } catch (err) {
      console.error('Process error:', err)
      setError('Gagal memproses file. Coba lagi.')
      setStep('upload')
    }
  }, [categories])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processAndImport(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processAndImport(file)
  }

  function handleDone() {
    onComplete()
    onClose()
  }

  const successCount = importedItems.filter(i => i.success).length
  const failCount = importedItems.filter(i => !i.success).length

  // ─── Render ────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'processing') onClose() }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] animate-scale-in overflow-hidden">

        {/* ── Header ──────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
              <FileArchive className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-gray-900 leading-none">
                Import Produk dari ZIP
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'upload' && 'Upload file ZIP → AI analisis → otomatis import'}
                {step === 'processing' && statusText}
                {step === 'done' && `${successCount} produk berhasil diimport!`}
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              onClick={step === 'done' ? handleDone : onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP: UPLOAD ───────────────────────── */}
          {step === 'upload' && (
            <div className="p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center 
                  text-center cursor-pointer transition-all duration-300 group
                  ${dragOver
                    ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                    : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30'
                  }`}
              >
                <div className={`absolute inset-0 rounded-3xl transition-opacity duration-500
                  bg-gradient-to-br from-violet-100/50 to-indigo-100/50
                  ${dragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />

                <div className="relative z-10">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 transition-all duration-300
                    ${dragOver
                      ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-200 scale-110'
                      : 'bg-gradient-to-br from-gray-100 to-gray-50 group-hover:from-violet-100 group-hover:to-indigo-100'
                    }`}>
                    <Upload className={`w-9 h-9 transition-colors duration-300
                      ${dragOver ? 'text-white' : 'text-gray-300 group-hover:text-violet-400'}`} strokeWidth={1.5} />
                  </div>

                  <p className="font-bold text-gray-800 text-lg mb-1">
                    {dragOver ? 'Lepaskan file di sini' : 'Drop file ZIP atau klik untuk pilih'}
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    File ZIP berisi gambar produk (JPG, PNG, WebP) — maks 50 MB
                  </p>

                  <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Maks 30 gambar
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI baca nama & harga otomatis
                    </span>
                  </div>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileSelect}
              />

              {error && (
                <div className="mt-4 flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tips */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: '📦', title: 'Siapkan ZIP', desc: 'Kumpulkan foto produk dalam satu file ZIP' },
                  { icon: '🤖', title: 'AI Analisis', desc: 'AI membaca nama & harga dari gambar' },
                  { icon: '⚡', title: 'Auto Import', desc: 'Langsung masuk ke database otomatis' },
                ].map((tip) => (
                  <div key={tip.title} className="bg-gray-50 rounded-2xl p-4 text-center">
                    <span className="text-2xl mb-2 block">{tip.icon}</span>
                    <p className="font-bold text-gray-800 text-sm">{tip.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP: PROCESSING (AI + Import) ────── */}
          {step === 'processing' && (
            <div className="p-12 flex flex-col items-center text-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>

              <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                {progress < 40 ? 'AI Sedang Menganalisis' : 'Mengimport Produk'}
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">
                {statusText}
              </p>

              <div className="w-full max-w-xs">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2.5">{progress}% — Mohon tunggu...</p>
                {totalItems > 0 && (
                  <p className="text-xs font-semibold text-violet-600 mt-1">
                    {totalItems} produk dikenali
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP: DONE ─────────────────────────── */}
          {step === 'done' && (
            <div className="p-8 flex flex-col items-center text-center">
              {/* Success animation */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-5 shadow-xl shadow-emerald-200 animate-scale-in">
                <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>

              <h3 className="text-2xl font-extrabold text-gray-900 mb-2">
                Import Berhasil! 🎉
              </h3>
              <p className="text-gray-400 text-sm mb-1">
                <span className="font-bold text-emerald-600">{successCount}</span> dari{' '}
                <span className="font-bold">{totalItems}</span> produk berhasil diimport
              </p>
              {failCount > 0 && (
                <p className="text-xs text-amber-500 mb-3">
                  {failCount} produk gagal (mungkin duplikat atau error)
                </p>
              )}

              {/* Imported items list */}
              <div className="w-full mt-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {importedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm
                        ${item.success ? 'bg-emerald-50' : 'bg-red-50'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.success ? (
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`font-semibold ${item.success ? 'text-emerald-700' : 'text-red-600'}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`font-bold text-xs ${item.success ? 'text-emerald-600' : 'text-red-500'}`}>
                        Rp {item.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────── */}
        {step === 'done' && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <button
              onClick={handleDone}
              className="btn-primary flex-1 py-3 text-sm"
              style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}
            >
              <Check className="w-4 h-4" />
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
