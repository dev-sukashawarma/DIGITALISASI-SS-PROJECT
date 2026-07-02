'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import Link from 'next/link'

interface PageProps {
  params: {
    system_code: string
  }
}

export default function PanduanEditorPage({ params: { system_code } }: PageProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [title, setTitle] = useState('')
  const [contentMd, setContentMd] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('system_guides')
          .select('*')
          .eq('system_code', system_code)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found, maybe it's a new system guide. Leave fields empty.
            setTitle(`Panduan Sistem ${system_code.toUpperCase()}`)
            setContentMd('Tulis panduan Anda di sini menggunakan format Markdown...\n\nAnda dapat menggunakan:\n- **Tebal**\n- *Miring*\n- `Kode`\n- ![Foto](URL_Foto)')
          } else {
            console.error('Error loading guide:', error)
            toast.error('Gagal memuat panduan sistem')
          }
        } else if (data) {
          setTitle(data.title)
          setContentMd(data.content_md)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [supabase, system_code])

  const handleSave = async () => {
    if (!title.trim() || !contentMd.trim()) {
      toast.error('Judul dan konten panduan tidak boleh kosong')
      return
    }

    setIsSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      const { error } = await supabase
        .from('system_guides')
        .upsert(
          {
            system_code,
            title,
            content_md: contentMd,
            updated_at: new Date().toISOString(),
            created_by: userId,
          },
          { onConflict: 'system_code' }
        )

      if (error) {
        console.error('Save error:', error)
        toast.error('Gagal menyimpan panduan. Pastikan Anda memiliki akses Admin/Owner.')
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
        <Link href="/dashboard/panduan" className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold text-suka-ink">Edit Panduan Sistem</h2>
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
            placeholder="Contoh: Panduan Sistem Absensi"
            className="w-full rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-suka-ink">Konten Panduan (Markdown)</label>
          <div className="rounded-xl border border-suka-gray-200 overflow-hidden focus-within:border-suka-orange focus-within:ring-1 focus-within:ring-suka-orange">
            <div className="bg-suka-gray-50 px-4 py-2 border-b border-suka-gray-200 text-xs text-gray-500 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-600" />
              Gunakan Markdown untuk format tebal, miring, daftar, dan gambar. (Cth: ![Foto](URL_FOTO))
            </div>
            <textarea
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder="Tulis panduan di sini..."
              className="w-full min-h-[500px] p-4 text-sm bg-white resize-y outline-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
