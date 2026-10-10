'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Eye,
  Save,
  Loader2,
  ExternalLink,
  Laptop,
  Tablet,
  Smartphone,
  Copy,
  Trash2,
  ShieldCheck,
  Check,
  Sparkles,
  Command,
  RotateCcw
} from 'lucide-react'
import { DEFAULT_MITRA_MAINTENANCE_HTML, type MitraMaintenanceConfig } from '@/lib/maintenance/mitraMaintenance'
import { saveMitraMaintenanceConfigAction } from './actions'

interface PengaturanHalamanViewProps {
  initialConfig: MitraMaintenanceConfig
  currentUserName: string
}

export function PengaturanHalamanView({
  initialConfig,
  currentUserName,
}: PengaturanHalamanViewProps) {
  const [isActive, setIsActive] = useState<boolean>(initialConfig.is_active)
  const [customHtml, setCustomHtml] = useState<string>(initialConfig.custom_html || '')
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [copied, setCopied] = useState(false)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState({
    date: initialConfig.updated_at,
    by: initialConfig.updated_by || currentUserName,
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  // Keyboard shortcut: Cmd/Ctrl + S to Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, customHtml])

  const handleLoadDefaultTemplate = () => {
    if (customHtml.trim() && !window.confirm('Timpa kode kustom saat ini dengan template bawaan Suka Shawarma?')) {
      return
    }
    setCustomHtml(DEFAULT_MITRA_MAINTENANCE_HTML)
    showToast('success', 'Template bawaan Suka Shawarma berhasil dimuat ke editor')
  }

  const handleClearCode = () => {
    if (!customHtml.trim()) return
    if (window.confirm('Kosongkan kode kustom? Sistem akan otomatis memakai tampilan default sistem.')) {
      setCustomHtml('')
      showToast('success', 'Kode kustom dikosongkan (menggunakan tampilan default sistem)')
    }
  }

  const handleCopyCode = async () => {
    const codeToCopy = customHtml.trim() ? customHtml : DEFAULT_MITRA_MAINTENANCE_HTML
    try {
      await navigator.clipboard.writeText(codeToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('success', 'Kode berhasil disalin ke clipboard')
    } catch {
      showToast('error', 'Gagal menyalin kode')
    }
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const res = await saveMitraMaintenanceConfigAction({
        is_active: isActive,
        custom_html: customHtml,
      })
      if (res?.ok && res.data) {
        setLastUpdated({
          date: res.data.updated_at,
          by: res.data.updated_by || currentUserName,
        })
        showToast('success', 'Konfigurasi mode pemeliharaan berhasil disimpan & aktif!')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menyimpan pengaturan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewContent = customHtml.trim().length > 0 ? customHtml : DEFAULT_MITRA_MAINTENANCE_HTML
  const lineCount = (customHtml || DEFAULT_MITRA_MAINTENANCE_HTML).split('\n').length

  return (
    <div className="space-y-6 max-w-6xl pb-24 animate-fade-in font-sans">
      
      {/* 1. Header Section - Suka Shawarma Brand Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-suka-orange uppercase tracking-wider">
            <span>SISTEM</span>
            <span className="text-suka-brown/30">&bull;</span>
            <span>PENGATURAN HALAMAN</span>
            <span className="text-suka-brown/30">&bull;</span>
            <span className="px-2 py-0.5 rounded-full bg-suka-orange/15 border border-suka-orange/30 text-suka-brown text-[10px] font-extrabold">
              KHUSUS DEVELOPER
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-suka-brown tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange flex items-center justify-center text-white shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <span>Pengaturan Halaman Maintenance</span>
          </h1>

          <p className="text-suka-gray-500 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
            Kontrol status operasional halaman pemeliharaan sistem Suka Shawarma untuk akun role Mitra.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <a
            href="/dashboard/mitra"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-suka-brown bg-white hover:bg-suka-gray-50 border border-suka-gray-200 shadow-2xs hover:border-suka-orange/40 transition-all active:scale-[0.98] cursor-pointer"
            title="Buka portal mitra di tab baru"
          >
            <span>Uji Halaman Mitra</span>
            <ExternalLink className="w-3.5 h-3.5 text-suka-orange" />
          </a>

          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-suka-brown hover:bg-suka-ink text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-suka-orange" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-suka-orange" />
                <span>Simpan Pengaturan</span>
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-white/70 font-mono ml-1 px-1.5 py-0.5 rounded bg-black/20">
                  <Command className="w-2.5 h-2.5" />S
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Master Switch & Status Card */}
      <div className={`relative rounded-3xl border transition-all duration-300 overflow-hidden shadow-xs ${
        isActive 
          ? 'bg-amber-50/40 border-suka-orange/50 ring-2 ring-suka-orange/30 shadow-sm' 
          : 'bg-white/90 border-suka-brown/10'
      }`}>
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-suka-brown/10">
            
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-suka-brown tracking-tight">
                  Status Mode Pemeliharaan (UNDER MAINTENANCE)
                </h2>
                
                {isActive ? (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-suka-orange text-white shadow-xs uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>MAINTENANCE AKTIF</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>NORMAL (ONLINE)</span>
                  </span>
                )}
              </div>

              <p className="text-sm text-suka-gray-600 leading-relaxed max-w-2xl font-medium">
                Aktifkan tombol switch untuk mengalihkan seluruh pengguna role <strong className="text-suka-brown">Mitra</strong> ke halaman pemeliharaan. Akun Developer, Owner, dan Admin tetap memiliki akses penuh tanpa terblokir.
              </p>
            </div>

            {/* Custom Interactive Switch */}
            <div className="flex items-center gap-4 shrink-0 bg-white p-2.5 rounded-2xl border border-suka-brown/10 shadow-2xs self-start lg:self-auto">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-9 w-18 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                  isActive ? 'bg-suka-orange' : 'bg-suka-gray-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${
                    isActive ? 'translate-x-9' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="text-xs font-bold min-w-[75px]">
                <div className={isActive ? 'text-suka-orange' : 'text-suka-gray-500'}>
                  {isActive ? 'STATUS: ON' : 'STATUS: OFF'}
                </div>
                <div className="text-[10px] text-suka-gray-400 font-medium">
                  {isActive ? 'Mitra ditutup' : 'Mitra aktif'}
                </div>
              </div>
            </div>

          </div>

          {/* Dynamic Status Alert Banner */}
          {isActive ? (
            <div className="bg-suka-cream border border-suka-orange/40 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-suka-orange flex items-center justify-center text-white shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-xs sm:text-sm text-suka-ink leading-relaxed font-medium">
                <span className="font-bold text-suka-brown block text-sm mb-0.5">
                  Portal Saat Ini Sedang Ditutup (UNDER MAINTENANCE)
                </span>
                Seluruh akun mitra yang mengakses <code className="bg-white/80 text-suka-brown border border-suka-orange/30 px-1.5 py-0.5 rounded font-mono text-xs">/dashboard/mitra/*</code> akan melihat halaman pemeliharaan. Anda dapat menonaktifkan mode ini kapan saja setelah pembaruan selesai.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                <span className="font-bold text-emerald-950 block text-sm mb-0.5">
                  Sistem Berjalan Normal (Semua Rute Mitra Terbuka)
                </span>
                Seluruh mitra memiliki akses penuh ke Dashboard, Laba Rugi Realtime, Bukti Transfer, Tim Outlet, dan Saran.
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-suka-gray-400 font-medium pt-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-suka-green" />
              <span>Target: <strong className="text-suka-brown">Role Mitra (/dashboard/mitra/*)</strong></span>
            </div>
            {lastUpdated.date && (
              <div className="font-mono text-[11px]">
                Terakhir diupdate: <span className="font-semibold text-suka-brown">{new Date(lastUpdated.date).toLocaleString('id-ID')}</span>
                {lastUpdated.by && <span> &bull; oleh <span className="font-semibold text-suka-orange">{lastUpdated.by}</span></span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Editor & Live Preview Window */}
      <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-suka-gray-50 border-b border-suka-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            {/* Window dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400/90 inline-block" />
            </div>

            <div className="h-4 w-[1px] bg-suka-gray-300" />

            <div className="flex items-center gap-2 text-xs font-mono text-suka-brown font-semibold">
              <Code2 className="w-4 h-4 text-suka-orange" />
              <span>mitra-under-maintenance.html</span>
              <span className="text-[10px] text-suka-gray-500 font-semibold px-2 py-0.5 rounded bg-white border border-suka-gray-200">
                SANDBOXED IFRAME
              </span>
            </div>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center p-1 bg-suka-gray-200/80 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white text-suka-brown shadow-xs font-bold'
                  : 'text-suka-gray-600 hover:text-suka-brown'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Editor Kode</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-suka-brown shadow-xs font-bold'
                  : 'text-suka-gray-600 hover:text-suka-brown'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>

        </div>

        {/* Tab 1: Code Editor View */}
        {activeTab === 'editor' && (
          <div className="p-6 space-y-4">
            
            {/* Editor Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadDefaultTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream hover:bg-orange-100 border border-suka-orange/30 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-suka-orange" />
                  <span>Muat Template Suka Shawarma</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-suka-gray-700 bg-white hover:bg-suka-gray-50 border border-suka-gray-200 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-suka-green" /> : <Copy className="w-3.5 h-3.5 text-suka-gray-500" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
                </button>

                {customHtml.trim() && (
                  <button
                    type="button"
                    onClick={handleClearCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Kode</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] font-mono text-suka-gray-500 flex items-center gap-3">
                <span>{lineCount} baris</span>
                <span>&bull;</span>
                <span>{customHtml.length} karakter</span>
              </div>
            </div>

            {/* Code Box */}
            <div className="relative rounded-2xl border border-suka-gray-300 bg-slate-950 overflow-hidden shadow-inner">
              <div className="flex">
                {/* Line Numbers Gutter */}
                <div className="hidden sm:block py-4 px-3 bg-slate-900 text-slate-500 font-mono text-xs select-none border-r border-slate-800 text-right min-w-[48px]">
                  {Array.from({ length: Math.min(lineCount, 30) }, (_, i) => (
                    <div key={i + 1} className="leading-6">{i + 1}</div>
                  ))}
                  {lineCount > 30 && <div className="text-slate-600">&bull;&bull;&bull;</div>}
                </div>

                {/* Editor Textarea */}
                <textarea
                  ref={textareaRef}
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  placeholder="<!-- Masukkan kode HTML dan CSS kustom di sini. -->&#10;<!-- Kosongkan bila ingin menggunakan template standar bawaan sistem -->"
                  rows={20}
                  className="flex-1 bg-transparent text-slate-100 font-mono text-xs sm:text-sm p-4 outline-none border-none resize-y leading-6 selection:bg-suka-orange/40 selection:text-white"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-suka-gray-500 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-suka-orange" />
                <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-suka-gray-100 text-suka-brown font-mono text-[10px] border border-suka-gray-200">Ctrl+S</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-suka-gray-100 text-suka-brown font-mono text-[10px] border border-suka-gray-200">Cmd+S</kbd> untuk menyimpan langsung.</span>
              </div>
              <span>Iframe Sandbox Terisolasi</span>
            </div>

          </div>
        )}

        {/* Tab 2: Live Preview */}
        {activeTab === 'preview' && (
          <div className="p-6 space-y-4 bg-suka-gray-100/60">
            
            {/* Viewport Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-suka-gray-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-suka-brown text-white shadow-xs'
                      : 'text-suka-gray-600 hover:text-suka-brown'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Desktop (100%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewDevice === 'tablet'
                      ? 'bg-suka-brown text-white shadow-xs'
                      : 'text-suka-gray-600 hover:text-suka-brown'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablet (768px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-suka-brown text-white shadow-xs'
                      : 'text-suka-gray-600 hover:text-suka-brown'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile (390px)</span>
                </button>
              </div>

              <div className="text-xs font-mono text-suka-gray-600 font-semibold">
                {customHtml.trim() ? (
                  <span className="text-suka-orange font-bold">Kustom HTML Aktif</span>
                ) : (
                  <span className="text-suka-brown font-bold">Template Bawaan Suka Shawarma</span>
                )}
              </div>
            </div>

            {/* Faux Browser Mockup Frame */}
            <div className="flex items-center justify-center min-h-[640px] p-4 sm:p-8 bg-suka-gray-200/50 rounded-2xl border border-suka-gray-300 overflow-auto">
              <div
                className={`transition-all duration-300 bg-white rounded-2xl shadow-xl overflow-hidden border border-suka-gray-300 flex flex-col ${
                  previewDevice === 'desktop'
                    ? 'w-full h-[650px]'
                    : previewDevice === 'tablet'
                    ? 'w-[768px] h-[650px]'
                    : 'w-[390px] h-[650px]'
                }`}
              >
                {/* Browser Address Bar */}
                <div className="bg-suka-gray-50 border-b border-suka-gray-200 px-4 py-2.5 flex items-center justify-between text-xs text-suka-gray-500 select-none shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  </div>
                  
                  <div className="bg-white border border-suka-gray-200 rounded-lg px-3 py-1 text-[11px] font-mono text-suka-brown flex items-center gap-2 max-w-[280px] truncate shadow-2xs">
                    <span className="text-suka-green text-[10px]">&#128274;</span>
                    <span>https://sukashawarma.com/dashboard/mitra</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('editor')
                      setTimeout(() => setActiveTab('preview'), 50)
                    }}
                    className="text-suka-gray-500 hover:text-suka-brown transition-colors cursor-pointer"
                    title="Refresh Pratinjau"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Rendered Live Iframe */}
                <div className="flex-1 w-full h-full bg-suka-cream relative">
                  <iframe
                    srcDoc={previewContent}
                    title="Live Preview Halaman Maintenance"
                    className="w-full h-full border-none block m-0 p-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer Toolbar */}
        <div className="p-4 sm:p-6 bg-white border-t border-suka-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-suka-gray-500 font-medium">
            Perubahan konfigurasi akan segera berdampak pada seluruh sesi portal mitra setelah Anda menekan tombol simpan.
          </p>

          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3 bg-suka-brown hover:bg-suka-ink text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-suka-orange" />
                <span>Menyimpan Pengaturan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-suka-orange" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-6 py-3.5 rounded-2xl shadow-xl font-bold text-sm animate-fade-up backdrop-blur-xl border ${
            toast.type === 'success'
              ? 'bg-white text-suka-brown border-suka-green/40 shadow-suka-brown/10 ring-2 ring-suka-green/20'
              : 'bg-white text-red-700 border-red-300 shadow-suka-brown/10 ring-2 ring-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-suka-green shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  )
}
