'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Save, Bold, Italic, Heading1, Heading2, List, ListOrdered, ImageIcon, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

import { savePanduan, createPanduan } from '../actions'

export default function PanduanEditorPage() {
  const router = useRouter()
  const params = useParams()
  const system_code = params.system_code as string
  const guide_id = params.guide_id as string
  const supabase = createSupabaseBrowserClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [contentHtml, setContentHtml] = useState('')
  const [images, setImages] = useState<{url: string; title: string}[]>([])
  
  const isNew = guide_id === 'new'

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }: any) => {
      setContentHtml(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none min-h-[500px] w-full p-4',
      },
    },
  })

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('system_guides')
          .select('*')
          .eq('id', guide_id)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            toast.error('Panduan tidak ditemukan')
            router.push(`/dashboard/panduan/${system_code}`)
          } else {
            console.error('Error loading guide:', error)
            toast.error('Gagal memuat panduan sistem')
          }
        } else if (data) {
          setTitle(data.title)
          setCategory(data.category || '')
          setSortOrder(data.sort_order || 0)
          let parsedImages = []
          if (data.image_url) {
            try {
              const parsed = JSON.parse(data.image_url)
              if (Array.isArray(parsed)) {
                parsedImages = parsed
              } else {
                parsedImages = [{ url: data.image_url, title: '' }]
              }
            } catch(e) {
              parsedImages = [{ url: data.image_url, title: '' }]
            }
          }
          setImages(parsedImages)
          // Handle legacy content_md just in case it wasn't migrated
          const content = data.content_html || data.content_md || '<p></p>'
          setContentHtml(content)
          editor?.commands.setContent(content)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (isNew) {
      setIsLoading(false)
    } else if (guide_id && editor) {
      loadData()
    }
  }, [guide_id, editor, isNew])

  const handleSave = async () => {
    if (!title.trim() || !contentHtml.trim()) {
      toast.error('Judul dan konten panduan tidak boleh kosong')
      return
    }

    setIsSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (!userId) {
        toast.error('Anda harus login terlebih dahulu')
        setIsSaving(false)
        return
      }

      let res;
      if (isNew) {
        res = await createPanduan({
          system_code,
          title,
          category,
          sort_order: sortOrder,
          content_html: contentHtml,
          image_url: JSON.stringify(images),
          userId,
        })
      } else {
        res = await savePanduan({
          id: guide_id,
          system_code,
          title,
          category,
          sort_order: sortOrder,
          content_html: contentHtml,
          image_url: JSON.stringify(images),
          userId,
        })
      }

      if ('error' in res) {
        toast.error(res.error || 'Gagal menyimpan panduan')
      } else if ('id' in res) {
        toast.success('Panduan berhasil disimpan!')
        router.replace(`/dashboard/panduan/${system_code}/${res.id}`)
      } else {
        toast.success('Panduan berhasil disimpan!')
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      toast.error('Terjadi kesalahan yang tidak diketahui.')
    } finally {
      setIsSaving(false)
    }
  }

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${system_code}/${fileName}`

    setIsUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from('guide-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage
        .from('guide-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('Upload Error:', err)
      toast.error('Gagal mengunggah gambar')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan')
      return
    }

    const toastId = toast.loading('Mengunggah gambar...')
    const url = await uploadImage(file)
    
    if (url) {
      setImages(prev => [...prev, { url, title: '' }])
      toast.success('Gambar berhasil ditambahkan', { id: toastId })
    } else {
      toast.dismiss(toastId)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateImageTitle = (index: number, newTitle: string) => {
    setImages(prev => prev.map((img, i) => i === index ? { ...img, title: newTitle } : img))
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-suka-orange" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold text-suka-ink">
            {isNew ? 'Buat Panduan Baru' : 'Edit Panduan Sistem'}
          </h2>
          <p className="text-sm text-gray-500 uppercase tracking-wider">{system_code}</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Panduan
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-suka-ink">Judul Panduan</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Cara Membuat Akun"
            className="w-full rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-suka-ink">Kategori / Bab (Opsional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Contoh: Bab 1: Pendahuluan"
              className="w-full rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-suka-ink">Urutan (Sort Order)</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              placeholder="1"
              className="w-full rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-suka-ink">Gambar Panduan (Opsional)</label>
          
          {images.length > 0 && (
            <div className="space-y-4 mb-4">
              {images.map((img, index) => (
                <div key={index} className="flex gap-4 p-4 border border-suka-gray-200 rounded-xl bg-suka-gray-50 items-start">
                  <div className="w-1/3 rounded-lg overflow-hidden bg-white border border-suka-gray-200">
                    <img src={img.url} alt={`Gambar ${index+1}`} className="w-full h-32 object-contain" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold text-suka-ink uppercase tracking-wider">Judul Gambar (Opsional)</label>
                    <input
                      type="text"
                      value={img.title}
                      onChange={(e) => updateImageTitle(index, e.target.value)}
                      placeholder="Contoh: Tampilan layar kasir"
                      className="w-full rounded-lg border border-suka-gray-200 px-3 py-2 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
                    />
                  </div>
                  <button
                    onClick={() => removeImage(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6"
                    title="Hapus Gambar"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-suka-gray-200 bg-white overflow-hidden p-4 relative min-h-[150px] flex items-center justify-center">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full justify-center gap-2 border-dashed border-2 border-suka-gray-300 py-8 hover:bg-suka-gray-50 text-gray-500"
            >
              {isUploading ? <Loader2 size={24} className="animate-spin text-suka-orange" /> : <ImageIcon size={24} className="text-gray-400" />}
              <span className="font-medium text-gray-600">
                {isUploading ? 'Mengunggah...' : 'Tambah Gambar'}
              </span>
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-suka-ink">Konten Panduan</label>
          <div className="rounded-xl border border-suka-gray-200 bg-white overflow-hidden focus-within:border-suka-orange focus-within:ring-1 focus-within:ring-suka-orange">
            
            {/* Toolbar */}
            {editor && (
              <div className="bg-suka-gray-50 px-3 py-2 border-b border-suka-gray-200 flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('bold') ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Bold"
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('italic') ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Italic"
                >
                  <Italic size={16} />
                </button>
                
                <div className="w-px h-6 bg-suka-gray-200 mx-1"></div>
                
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Heading 1"
                >
                  <Heading1 size={16} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Heading 2"
                >
                  <Heading2 size={16} />
                </button>

                <div className="w-px h-6 bg-suka-gray-200 mx-1"></div>

                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('bulletList') ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Bullet List"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 rounded hover:bg-suka-gray-200 ${editor.isActive('orderedList') ? 'bg-suka-gray-200 text-suka-orange' : 'text-gray-600'}`}
                  title="Ordered List"
                >
                  <ListOrdered size={16} />
                </button>

              </div>
            )}

            {/* Editor Area */}
            <div className="w-full">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
