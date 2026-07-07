'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, Plus, Edit2, Trash2, Image as ImageIcon, Save, X, BookOpen, GripVertical } from 'lucide-react'
import { useDialogStore } from '@/lib/dialogStore'

interface Guide {
  id: string
  category: string
  title: string
  content: string
  image_url: string | null
  sort_order: number
}

interface GuidesViewProps {
  initialGuides: Guide[]
}

export default function GuidesView({ initialGuides }: GuidesViewProps) {
  const router = useRouter()
  const { showConfirm, showAlert } = useDialogStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null)
  
  // Form State
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [images, setImages] = useState<{file: File | null, url: string | null, title: string}[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenModal = (guide?: Guide) => {
    if (guide) {
      setEditingGuide(guide)
      setCategory(guide.category)
      setTitle(guide.title)
      setContent(guide.content)
      setSortOrder(guide.sort_order)
      
      let parsedImages = []
      if (guide.image_url) {
        try {
          const parsed = JSON.parse(guide.image_url)
          if (Array.isArray(parsed)) {
            parsedImages = parsed.map((p: any) => ({ file: null, url: p.url, title: p.title || '' }))
          } else {
            parsedImages = [{ file: null, url: guide.image_url, title: '' }]
          }
        } catch {
          parsedImages = [{ file: null, url: guide.image_url, title: '' }]
        }
      }
      setImages(parsedImages)
    } else {
      setEditingGuide(null)
      setCategory('')
      setTitle('')
      setContent('')
      setSortOrder(0)
      setImages([])
    }
    setIsModalOpen(true)
  }

  const handleAddImage = () => {
    setImages([...images, { file: null, url: null, title: '' }])
  }

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleImageTitleChange = (index: number, title: string) => {
    const newImages = [...images]
    newImages[index].title = title
    setImages(newImages)
  }

  const handleImageFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const newImages = [...images]
      newImages[index].file = file
      const reader = new FileReader()
      reader.onloadend = () => {
        newImages[index].url = reader.result as string
        setImages([...newImages])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const supabase = createClient()
      const finalImages = []
      
      for (const img of images) {
        let imgUrl = img.url
        if (img.file) {
          const fileExt = img.file.name.split('.').pop()
          const fileName = `guide-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const { error: uploadError } = await supabase.storage
            .from('kiosk-assets')
            .upload(fileName, img.file, { upsert: true })
            
          if (uploadError) throw uploadError
          const { data: { publicUrl } } = supabase.storage.from('kiosk-assets').getPublicUrl(fileName)
          imgUrl = publicUrl
        }
        if (imgUrl) {
          finalImages.push({ url: imgUrl, title: img.title })
        }
      }
      
      const finalImageUrl = finalImages.length > 0 ? JSON.stringify(finalImages) : null

      const payload = {
        id: editingGuide?.id,
        category,
        title,
        content_html: content,
        image_url: finalImageUrl,
        sort_order: Number(sortOrder)
      }

      const res = await fetch('/api/admin/guides', {
        method: editingGuide ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Gagal menyimpan panduan')
      
      setIsModalOpen(false)
      router.refresh()
    } catch (err) {
      showAlert('Terjadi kesalahan saat menyimpan.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus panduan ini?');
    if (!confirmed) return
    try {
      const res = await fetch(`/api/admin/guides?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      router.refresh()
    } catch (e) {
      showAlert('Gagal menghapus panduan')
    }
  }

  // Grouping for display
  const groupedGuides = initialGuides.reduce((acc, guide) => {
    if (!acc[guide.category]) acc[guide.category] = []
    acc[guide.category].push(guide)
    return acc
  }, {} as Record<string, Guide[]>)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Manajemen Panduan</h1>
          <p className="text-gray-500 mt-1 font-medium">Atur konten buku panduan untuk seluruh pengguna sistem.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm shadow-amber-500/20"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Panduan</span>
        </button>
      </div>

      {initialGuides.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Belum ada panduan yang dibuat.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedGuides).map(([catName, catGuides]) => (
            <div key={catName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-lg">{catName}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {catGuides.map(guide => (
                  <div key={guide.id} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-gray-50/50 transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="font-bold text-gray-500 text-sm">{guide.sort_order}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-lg">{guide.title}</h4>
                      <p className="text-gray-500 mt-2 line-clamp-2 text-sm leading-relaxed">{guide.content}</p>
                      {guide.image_url && (
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 w-fit px-3 py-1.5 rounded-lg border border-blue-100">
                          <ImageIcon className="w-4 h-4" /> Ada Gambar Screenshot
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-2 shrink-0">
                      <button onClick={() => handleOpenModal(guide)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(guide.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingGuide ? 'Edit Panduan' : 'Tambah Panduan Baru'}</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="guide-form" onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">Kategori / Bab</label>
                    <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contoh: 1. Mulai" className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-xl px-4 py-3 outline-none transition-colors font-medium text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">Urutan Tampil (Sort Order)</label>
                    <input type="number" onWheel={(e) => e.currentTarget.blur()} required value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-xl px-4 py-3 outline-none transition-colors font-medium text-gray-900" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-900">Judul Panduan</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Cara Login ke Sistem" className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-xl px-4 py-3 outline-none transition-colors font-medium text-gray-900" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-900">Isi Konten (Teks)</label>
                  <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Jelaskan langkah-langkahnya di sini..." className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-xl px-4 py-3 outline-none transition-colors font-medium text-gray-900 resize-none" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-900">Screenshot / Gambar Pendukung (Opsional)</label>
                    <button type="button" onClick={handleAddImage} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Tambah Gambar
                    </button>
                  </div>
                  
                  {images.length === 0 ? (
                    <div className="w-full aspect-[4/1] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                      <ImageIcon className="w-8 h-8 mb-2" strokeWidth={1.5} />
                      <span className="text-xs font-semibold">Tidak ada gambar</span>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {images.map((img, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50 relative">
                          <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                            <X className="w-4 h-4" />
                          </button>
                          
                          <div className="shrink-0 space-y-2">
                            {img.url ? (
                              <div className="relative w-full sm:w-32 aspect-video rounded-lg border border-gray-200 overflow-hidden bg-white">
                                <img src={img.url} alt="Preview" className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-full sm:w-32 aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-white text-gray-400">
                                <ImageIcon className="w-6 h-6 mb-1" />
                              </div>
                            )}
                            <label className="block text-center cursor-pointer text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1.5 rounded hover:bg-blue-100">
                              Pilih File
                              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageFileChange(index, e)} className="hidden" />
                            </label>
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-gray-700">Judul Gambar (Opsional)</label>
                            <input 
                              type="text" 
                              value={img.title} 
                              onChange={(e) => handleImageTitleChange(index, e.target.value)} 
                              placeholder="Misal: Tampilan saat pesanan baru masuk" 
                              className="w-full bg-white border border-gray-200 focus:border-amber-400 rounded-lg px-3 py-2 outline-none text-sm" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/50 rounded-b-3xl">
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                Batal
              </button>
              <button type="submit" form="guide-form" disabled={isSubmitting} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-70">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
