'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Book, ChevronRight, Menu, ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react'
import { useBrand } from '@/components/BrandContext'

interface Guide {
  id: string
  category: string
  title: string
  content_html: string
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeCategoryId])

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

  // Pagination logic
  const currentIndex = categories.indexOf(activeCategoryId)
  const prevCategory = currentIndex > 0 ? categories[currentIndex - 1] : null
  const nextCategory = currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm h-16 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/kasir" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Book className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-none">Panduan</h1>
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
        <main className="flex-1 p-4 sm:p-6 md:p-10 lg:p-14 min-w-0">
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
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-start sm:items-center gap-3">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm mt-0.5 sm:mt-0">{idx + 1}</span>
                      <span className="leading-tight">{guide.title}</span>
                    </h3>
                    
                    <div 
                      className="prose prose-gray max-w-none sm:ml-11 prose-p:leading-relaxed prose-p:text-gray-600 prose-a:text-amber-600 hover:prose-a:text-amber-700 text-[14px] sm:text-base" 
                      dangerouslySetInnerHTML={{ __html: guide.content_html }} 
                    />

                    {(() => {
                      if (!guide.image_url) return null;
                      try {
                        const parsed = JSON.parse(guide.image_url);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          return (
                              <div className="sm:ml-11 mt-6 space-y-4">
                              {parsed.map((img: { url: string, title: string }, i: number) => (
                                <div key={i} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white p-4 space-y-3">
                                  <img src={img.url} alt={img.title || guide.title} className="w-full h-auto rounded-xl object-contain bg-gray-50 max-h-[500px]" />
                                  {img.title && (
                                    <p className="text-sm font-medium text-gray-700 text-center">{img.title}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                      } catch (e) {
                        return (
                          <div className="sm:ml-11 mt-6 rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white p-2">
                            <img src={guide.image_url} alt={guide.title} className="w-full h-auto rounded-xl object-contain bg-gray-50 max-h-[500px]" />
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ))}
              </div>

              {/* Navigation Footer */}
              <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {prevCategory ? (
                  <button
                    onClick={() => setActiveCategoryId(prevCategory)}
                    className="flex items-center justify-center sm:justify-start gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors text-sm text-left group"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Sebelumnya</div>
                      <div className="line-clamp-1">{prevCategory}</div>
                    </div>
                  </button>
                ) : (
                  <div className="hidden sm:block flex-1" />
                )}

                {nextCategory && (
                  <button
                    onClick={() => setActiveCategoryId(nextCategory)}
                    className="flex items-center justify-center sm:justify-end gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors text-sm text-right group"
                  >
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Selanjutnya</div>
                      <div className="line-clamp-1">{nextCategory}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
