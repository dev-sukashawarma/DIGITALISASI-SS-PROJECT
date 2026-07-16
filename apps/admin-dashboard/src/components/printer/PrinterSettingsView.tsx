'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Printer, Bluetooth, BluetoothConnected, Loader2, Save, CheckCircle2, AlertCircle, Play,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { usePrinterState, printerStore } from '@/lib/printer/printerStore'
import {
  connectBluetoothPrinter, autoConnectBluetoothPrinter, disconnectBluetoothPrinter,
  printBytes, printHtmlFallback,
} from '@/lib/printer/bluetooth-printer'
import {
  DEFAULT_PRINT_LAYOUT, mergePrintLayout, PRINT_LAYOUT_KEY, type PrintLayout, type Typography,
} from '@/lib/printer/printLayout'
import { buildTemplateReceipt } from '@/lib/printer/buildTemplateReceipt'

type TabKey = keyof PrintLayout
const TABS: { key: TabKey; label: string }[] = [
  { key: 'struk_customer', label: 'Struk Customer' },
  { key: 'struk_dapur', label: 'Struk Dapur' },
  { key: 'qr_surat_jalan', label: 'QR Surat Jalan' },
]

// ── HTML preview per template (untuk uji cetak browser fallback + preview di layar) ──
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

// Logo brand asli bila tersedia; jika belum ada logo terpasang, fallback ke placeholder.
function logoTag(show: boolean, logoUrl: string | null): string {
  if (!show) return ''
  if (logoUrl) return `<img class="logo-img" src="${esc(logoUrl)}" alt="Logo" />`
  return `<div class="logo">[LOGO]</div>`
}

function customerPreviewHtml(c: PrintLayout['struk_customer'], forPrint: boolean, logoUrl: string | null): string {
  const notes = c.showItemNotes ? `<div class="note">- pedas, tanpa bawang</div>` : ''
  const cashier = c.showCashier ? `<div class="muted">Kasir: Contoh</div>` : ''
  const cust = c.showCustomer ? `<div class="muted">Pelanggan: Contoh</div>` : ''
  const logo = logoTag(c.showLogo, logoUrl)
  const body = `
    ${logo}
    <div class="lg">${esc(c.headerText || 'SUKA SHAWARMA')}</div>
    <div class="muted">Suka Shawarma</div>
    <div class="hr"></div>
    ${cashier}${cust}
    <div class="queue">No. 123</div>
    <div class="hr"></div>
    <div class="row"><span>1x Shawarma Ayam</span><span>Rp 25.000</span></div>${notes}
    <div class="child"><span>EXTRA Keju</span><span>Rp 5.000</span></div>
    <div class="child"><span>EXTRA Kentang</span><span>Rp 5.000</span></div>
    <div class="row"><span>2x Kebab Daging</span><span>Rp 50.000</span></div>
    <div class="hr"></div>
    <div class="row total"><strong>TOTAL</strong><strong>Rp 85.000</strong></div>
    <div class="hr"></div>
    ${c.footerText.split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}`
  return wrapHtml(c.paperWidth, c, body, forPrint)
}

function kitchenPreviewHtml(c: PrintLayout['struk_dapur'], forPrint: boolean, logoUrl: string | null): string {
  const cust = c.showCustomer ? `<div class="muted">Pelanggan: Contoh</div>` : ''
  const logo = logoTag(c.showLogo, logoUrl)
  const body = `
    ${logo}
    <div class="lg">${esc(c.headerText || 'STRUK DAPUR')}</div>
    <div class="hr"></div>
    ${cust}
    <div class="queue">No. 123</div>
    <div class="hr"></div>
    <div>1x Shawarma Ayam</div>
    <div class="child"><span>EXTRA Keju</span></div>
    <div class="child"><span>EXTRA Kentang</span></div>
    <div>2x Kebab Daging</div>`
  return wrapHtml(c.paperWidth, c, body, forPrint)
}

function qrPreviewHtml(c: PrintLayout['qr_surat_jalan'], forPrint: boolean, logoUrl: string | null): string {
  const logo = logoTag(c.showLogo, logoUrl)
  const body = `
    ${logo}
    <div class="lg">${esc(c.title)}</div>
    <div class="qr" style="width:${c.qrSizeMm}mm;height:${c.qrSizeMm}mm">QR</div>
    <div class="hr"></div>
    ${c.footerText.split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}`
  return wrapHtml(c.paperWidth, c, body, forPrint)
}

const FONT_STACK: Record<Typography['fontFamily'], string> = {
  monospace: `'Courier New', Courier, monospace`,
  sans: `Arial, Helvetica, sans-serif`,
  serif: `'Times New Roman', Times, serif`,
}

function wrapHtml(paperWidth: number, typo: Typography, body: string, forPrint: boolean): string {
  const base = Math.max(6, typo.fontSizePx)
  const px = (mult: number) => Math.round(base * mult)
  const weight = typo.bold ? 900 : 400
  const fam = FONT_STACK[typo.fontFamily] ?? FONT_STACK.monospace
  const page = forPrint ? `@page { size: ${paperWidth}mm auto; margin: 0; }` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>
    ${page}
    body { width:${paperWidth}mm; margin:0; padding:${typo.marginMm}mm; font-family:${fam};
           color:#000; font-weight:${weight}; font-size:${base}px; text-align:center; }
    .lg { font-size:${px(1.25)}px; }
    .muted { font-size:${px(0.85)}px; }
    .logo { font-size:11px; border:1px dashed #000; display:inline-block; padding:2px 6px; margin-bottom:4px; }
    .logo-img { width:44px; height:44px; object-fit:contain; display:block; margin:0 auto 4px auto; filter:grayscale(100%) contrast(150%); }
    .hr { border-top:2px dashed #000; margin:5px 0; }
    .row, .child, .total { display:flex; justify-content:space-between; text-align:left; }
    .child { padding-left:10px; border-left:2px solid #000; margin-left:4px; }
    .note { text-align:left; font-style:italic; font-size:${px(0.8)}px; }
    .queue { font-size:${px(1.55)}px; font-weight:${weight}; margin:4px 0; }
    .qr { border:2px solid #000; margin:8px auto; display:flex; align-items:center; justify-content:center; }
  </style></head><body>${body}</body></html>`
}

function previewHtml(tab: TabKey, layout: PrintLayout, forPrint: boolean, logoUrl: string | null): string {
  if (tab === 'struk_customer') return customerPreviewHtml(layout.struk_customer, forPrint, logoUrl)
  if (tab === 'struk_dapur') return kitchenPreviewHtml(layout.struk_dapur, forPrint, logoUrl)
  return qrPreviewHtml(layout.qr_surat_jalan, forPrint, logoUrl)
}

export default function PrinterSettingsView() {
  const { device, isConnecting, error } = usePrinterState()
  const [brandLogo, setBrandLogo] = useState<string | null>(null)
  // Logo untuk preview: brand_logo tersimpan → pakai itu; jika belum ada, fallback ke
  // aset statis /logo.png (sama seperti yang dicetak struk asli). URL harus absolut
  // karena iframe srcDoc tak me-resolve path relatif.
  const previewLogo =
    brandLogo || (typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : null)
  const [layout, setLayout] = useState<PrintLayout>(DEFAULT_PRINT_LAYOUT)
  const [tab, setTab] = useState<TabKey>('struk_customer')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [btSupported, setBtSupported] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setBtSupported(typeof navigator !== 'undefined' && !!(navigator as any).bluetooth)
    autoConnectBluetoothPrinter()
    ;(async () => {
      try {
        const { data } = await supabase
          .from('global_settings')
          .select('key, value')
          .in('key', [PRINT_LAYOUT_KEY, 'brand_logo'])
        const rows = (data as { key: string; value: unknown }[] | null) ?? []
        const layoutRow = rows.find((r) => r.key === PRINT_LAYOUT_KEY)
        const logoRow = rows.find((r) => r.key === 'brand_logo')
        setLayout(mergePrintLayout(layoutRow?.value))
        setBrandLogo(typeof logoRow?.value === 'string' ? logoRow.value : null)
      } catch { setLayout(DEFAULT_PRINT_LAYOUT) }
      finally { setLoading(false) }
    })()
  }, [supabase])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message }); setTimeout(() => setToast(null), 3000)
  }

  const setField = (t: TabKey, key: string, value: unknown) =>
    setLayout((l) => ({ ...l, [t]: { ...(l[t] as any), [key]: value } }))

  const handleConnect = async () => {
    if (device) { disconnectBluetoothPrinter(); return }
    const ok = await connectBluetoothPrinter()
    if (!ok) showToast('error', printerStore.getState().error || 'Gagal menghubungkan printer')
    else showToast('success', 'Printer terhubung')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [PRINT_LAYOUT_KEY]: layout }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      showToast('success', 'Layout cetak disimpan')
    } catch (e: any) { showToast('error', e?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  const handleTestPrint = async () => {
    setTesting(true)
    try {
      if (printerStore.getState().characteristic) {
        // Printer thermal terhubung → cetak LANGSUNG via ESC/POS (logo/ukuran/bold).
        await printBytes(await buildTemplateReceipt(tab, layout, previewLogo ?? undefined))
      } else {
        // Tak ada printer thermal → fallback dialog cetak browser (persis preview).
        await printHtmlFallback(previewHtml(tab, layout, true, previewLogo))
      }
      showToast('success', 'Uji cetak dikirim')
    } catch (e: any) { showToast('error', e?.message || 'Uji cetak gagal') }
    finally { setTesting(false) }
  }

  const numBtn = (active: boolean) =>
    `px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors ${
      active ? 'border-suka-orange bg-orange-50 text-suka-brown' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown flex items-center gap-2">
          <Printer className="text-suka-orange" /> Pengaturan Printer
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Atur layout cetak untuk semua aplikasi dari sini. Koneksi Bluetooth tersimpan di perangkat ini; layout tersimpan terpusat.
        </p>
      </div>

      {/* KONEKSI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Bluetooth className="text-blue-500" /> Koneksi Printer</h2>
        {!btSupported ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold flex items-start gap-2">
            <AlertCircle className="shrink-0" size={18} /> Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge terbaru (HTTPS).
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${device ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {device ? <BluetoothConnected size={16} /> : <Bluetooth size={16} />}
              {device ? (device.name || 'Printer terhubung') : 'Belum terhubung'}
            </span>
            <button onClick={handleConnect} disabled={isConnecting}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center gap-2 ${device ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-suka-orange text-white hover:bg-orange-600'}`}>
              {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Bluetooth size={16} />}
              {isConnecting ? 'Menghubungkan...' : device ? 'Putuskan' : 'Hubungkan Printer'}
            </button>
          </div>
        )}
        {error && !device && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      </div>

      {/* TABS + EDITOR + PREVIEW */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex gap-2 flex-wrap border-b border-slate-100 pb-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${tab === t.key ? 'bg-suka-orange text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* EDITOR kiri */}
            <div className="space-y-5">
              {/* Ukuran kertas — semua template */}
              <Field label="Ukuran Kertas">
                <div className="flex gap-3">
                  {([58, 80] as const).map((wv) => (
                    <button key={wv} type="button" onClick={() => setField(tab, 'paperWidth', wv)}
                      className={numBtn((layout[tab] as any).paperWidth === wv)}>{wv}mm</button>
                  ))}
                </div>
              </Field>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={(layout[tab] as any).showLogo}
                  onChange={(e) => setField(tab, 'showLogo', e.target.checked)} className="w-5 h-5 rounded accent-suka-orange" />
                <span className="text-sm font-bold text-slate-700">Tampilkan logo</span>
              </label>

              {/* Tipografi & margin — semua template. Font/ukuran/margin berlaku di cetak HTML/browser; di thermal hanya Tebal yang berefek. */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipografi & Margin</p>
                <Field label="Font">
                  <div className="flex gap-3">
                    {([['monospace', 'Monospace'], ['sans', 'Sans'], ['serif', 'Serif']] as const).map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => setField(tab, 'fontFamily', val)}
                        className={numBtn((layout[tab] as any).fontFamily === val)}>{lbl}</button>
                    ))}
                  </div>
                </Field>
                <div className="flex gap-4 flex-wrap">
                  <Field label="Ukuran font (px)">
                    <input type="number" min={8} max={48} value={(layout[tab] as any).fontSizePx}
                      onChange={(e) => setField(tab, 'fontSizePx', Number(e.target.value) || 14)}
                      className="w-24 border border-slate-300 rounded-xl px-4 py-2.5" />
                  </Field>
                  <Field label="Margin (mm)">
                    <input type="number" min={0} max={10} step={0.5} value={(layout[tab] as any).marginMm}
                      onChange={(e) => setField(tab, 'marginMm', Number(e.target.value))}
                      className="w-24 border border-slate-300 rounded-xl px-4 py-2.5" />
                  </Field>
                </div>
                <Toggle label="Tebal (bold)" checked={(layout[tab] as any).bold} onChange={(v) => setField(tab, 'bold', v)} />
              </div>

              {tab === 'qr_surat_jalan' ? (
                <>
                  <TextField label="Judul" value={layout.qr_surat_jalan.title} onChange={(v) => setField(tab, 'title', v)} />
                  <TextField label="Footer" value={layout.qr_surat_jalan.footerText} onChange={(v) => setField(tab, 'footerText', v)} />
                  <Field label="Ukuran QR (mm)">
                    <input type="number" min={20} max={80} value={layout.qr_surat_jalan.qrSizeMm}
                      onChange={(e) => setField(tab, 'qrSizeMm', Number(e.target.value) || 45)}
                      className="w-28 border border-slate-300 rounded-xl px-4 py-2.5" />
                  </Field>
                </>
              ) : (
                <>
                  <TextField
                    label={tab === 'struk_dapur' ? 'Judul' : 'Header (kosong = nama outlet)'}
                    value={(layout[tab] as any).headerText} onChange={(v) => setField(tab, 'headerText', v)} />
                  {tab === 'struk_customer' && (
                    <>
                      <TextField label="Footer" value={layout.struk_customer.footerText} onChange={(v) => setField(tab, 'footerText', v)} />
                      <Toggle label="Tampilkan kasir" checked={layout.struk_customer.showCashier} onChange={(v) => setField(tab, 'showCashier', v)} />
                      <Toggle label="Tampilkan catatan/deskripsi item" checked={layout.struk_customer.showItemNotes} onChange={(v) => setField(tab, 'showItemNotes', v)} />
                    </>
                  )}
                  <Toggle label="Tampilkan pelanggan" checked={(layout[tab] as any).showCustomer} onChange={(v) => setField(tab, 'showCustomer', v)} />
                </>
              )}
            </div>

            {/* PREVIEW kanan */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pratinjau</p>
              <div className="flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-100 overflow-auto">
                <iframe title="preview" className="bg-white shadow-md border border-slate-200"
                  style={{ width: (layout[tab] as any).paperWidth === 80 ? 320 : 230, height: 380, border: 0 }}
                  srcDoc={previewHtml(tab, layout, false, previewLogo)} />
              </div>
              <button onClick={handleTestPrint} disabled={testing}
                className="w-full px-6 py-3 bg-suka-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                {testing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                {testing ? 'Mengirim...' : device ? 'Uji Cetak (Langsung)' : 'Uji Cetak (Browser)'}
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving || loading}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-70">
            {saving ? <Loader2 className="animate-spin text-suka-orange" size={18} /> : <Save size={18} />}
            {saving ? 'Menyimpan...' : 'Simpan Semua Layout'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{toast.message}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label className="block text-sm font-bold text-slate-700">{label}</label>{children}</div>
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all" />
    </Field>
  )
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 rounded accent-suka-orange" />
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </label>
  )
}
