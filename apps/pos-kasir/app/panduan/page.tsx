'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Book, ChevronRight, Menu, ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

interface Guide {
  id: string
  category: string
  title: string
  content: string
  image_url: string | null
  sort_order: number
}

export default function PanduanPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { brandName } = useBrand()

  useEffect(() => {
    fetch('/api/admin/guides')
      .then(res => res.json())
      .then(data => {
        setGuides(data || [])
        if (data && data.length > 0) {
          setActiveCategoryId(data[0].category)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  // Group by category
  const groupedGuides = guides.reduce((acc, guide) => {
    if (!acc[guide.category]) acc[guide.category] = []
    acc[guide.category].push(guide)
    return acc
  }, {} as Record<string, Guide[]>)

  const categories = Object.keys(groupedGuides)
  const activeGuides = activeCategoryId ? groupedGuides[activeCategoryId] : []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm h-16 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/login" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Book className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-none">Buku Panduan</h1>
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mt-1">{brandName} POS</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 max-w-[1400px] w-full mx-auto flex items-start">
        
        {/* Sidebar Overlay (Mobile) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed md:sticky top-16 left-0 z-50 md:z-auto w-[280px] h-[calc(100vh-4rem)] bg-white border-r border-gray-200 overflow-y-auto transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="p-4 space-y-6">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Daftar Isi</h2>
            <nav className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategoryId(cat)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[14px] font-bold transition-colors ${activeCategoryId === cat ? 'bg-amber-50 text-amber-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-10 lg:p-14 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
              <p className="font-medium">Memuat panduan...</p>
            </div>
          ) : activeGuides.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
              <Book className="w-12 h-12 mb-4 text-gray-300" strokeWidth={1.5} />
              <p className="font-medium">Belum ada panduan yang ditambahkan.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-12 animate-fade-in">
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">{activeCategoryId}</h2>
              </div>

              <div className="space-y-16">
                {activeGuides.map((guide, idx) => (
                  <div key={guide.id} className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">{idx + 1}</span>
                      {guide.title}
                    </h3>
                    
                    <div className="prose prose-gray max-w-none ml-11">
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{guide.content}</p>
                    </div>

                    {guide.image_url && (
                      <div className="ml-11 mt-6 rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white p-2">
                        <img src={guide.image_url} alt={guide.title} className="w-full h-auto rounded-xl object-contain bg-gray-50 max-h-[500px]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
