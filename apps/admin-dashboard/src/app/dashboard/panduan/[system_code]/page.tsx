'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, Plus, Trash2, Loader2, ArrowLeft, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { createPanduan, deletePanduan } from './actions'

interface Guide {
  id: string
  system_code: string
  title: string
  category?: string
  sort_order?: number
  desc?: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  'absensi': 'Sistem Absensi',
  'pos': 'Sistem POS (Kasir)',
  'stok': 'Sistem Stok & Opname',
  'distribusi': 'Sistem Distribusi',
}

export default function SystemCategoryPage() {
  const router = useRouter()
  const params = useParams()
  const system_code = params.system_code as string
  const supabase = createSupabaseBrowserClient()
  const [guides, setGuides] = useState<Guide[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const categoryName = CATEGORY_NAMES[system_code] || system_code

  useEffect(() => {
    if (system_code) {
      loadGuides()
    }
  }, [system_code])

  const loadGuides = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_guides')
        .select('id, system_code, title, category, sort_order')
        .eq('system_code', system_code)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        toast.error('Gagal memuat daftar panduan')
      } else if (data) {
        setGuides(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      toast.error('Judul wajib diisi')
      return
    }

    setIsCreating(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (!userId) {
        toast.error('Anda belum login')
        setIsCreating(false)
        return
      }

      const res = await createPanduan({
        system_code: system_code,
        title: newTitle,
        userId
      })

      if (res.error || !res.id) {
        toast.error(res.error || 'Gagal membuat panduan')
      } else {
        toast.success('Panduan berhasil dibuat')
        setIsModalOpen(false)
        setNewTitle('')
        // Redirect to the new guide's editor
        router.push(`/dashboard/panduan/${system_code}/${res.id}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Terjadi kesalahan')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus panduan "${title}"?`)) {
      return
    }

    setDeletingId(id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (!userId) {
        toast.error('Anda belum login')
        setDeletingId(null)
        return
      }

      const res = await deletePanduan(id, userId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Panduan berhasil dihapus')
        loadGuides()
      }
    } catch (err) {
      console.error(err)
      toast.error('Terjadi kesalahan')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/panduan" className="p-2 rounded-full hover:bg-suka-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold text-suka-ink">Panduan {categoryName}</h2>
          <p className="text-sm text-gray-500">Kelola daftar panduan untuk modul ini.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Tambah Panduan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-suka-orange" />
        </div>
      ) : guides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
          <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-600">Belum ada panduan</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 text-center">Buat panduan sistem pertama Anda di kategori ini.</p>
          <Button onClick={() => setIsModalOpen(true)} variant="secondary">
            Buat Panduan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {guides.map((sys) => (
            <div
              key={sys.id}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-suka-gray-100 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all group relative"
            >
              <div className="p-3 rounded-xl bg-suka-orange/10 text-suka-orange group-hover:bg-suka-orange group-hover:text-white transition-colors">
                <BookOpen size={24} />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <Link href={`/dashboard/panduan/${system_code}/${sys.id}`} className="block">
                  <h3 className="font-bold text-suka-ink truncate hover:text-suka-orange transition-colors">{sys.title}</h3>
                </Link>
                {sys.category && (
                  <p className="text-sm text-gray-500 mt-1">{sys.category}</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete(sys.id, sys.title)
                }}
                disabled={deletingId === sys.id}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Hapus Panduan"
              >
                {deletingId === sys.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-suka-ink">Buat Panduan Baru</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-suka-ink">Judul Panduan</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Panduan Absensi Staff"
                  className="w-full rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isCreating} className="min-w-[100px]">
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
