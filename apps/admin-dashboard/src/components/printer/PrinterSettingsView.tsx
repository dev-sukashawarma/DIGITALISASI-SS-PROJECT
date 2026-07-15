'use client'

import { useEffect, useState } from 'react'
import {
  Printer, Bluetooth, BluetoothConnected, Loader2, Save,
  CheckCircle2, AlertCircle, Play,
} from 'lucide-react'
import {
  usePrinterState, printerStore,
} from '@/lib/printer/printerStore'
import {
  connectBluetoothPrinter, autoConnectBluetoothPrinter,
  disconnectBluetoothPrinter, printBytes, printHtmlFallback,
} from '@/lib/printer/bluetooth-printer'
import {
  DEFAULT_PRINTER_CONFIG, loadPrinterConfig, savePrinterConfig,
  buildSampleReceipt, type PrinterConfig,
} from '@/lib/printer/printerConfig'

function sampleHtml(config: PrinterConfig): string {
  const widthMm = config.paperWidth
  const align = config.align === 'center' ? 'center' : 'left'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Uji Cetak</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  body { width:${widthMm}mm; margin:0; padding:6px 8px; font-family:'Courier New',monospace;
         color:#000; font-weight:900; font-size:14px; text-align:${align}; }
  .hr { border-top:2px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; text-align:left; }
  .lg { font-size:18px; }
</style></head><body>
  <div class="lg">${config.headerText}</div>
  <div>-- CONTOH STRUK / UJI CETAK --</div>
  <div class="hr"></div>
  <div class="row"><span>Item Contoh</span><span>Rp 10.000</span></div>
  <div class="row"><span>Item Kedua</span><span>Rp 25.000</span></div>
  <div class="hr"></div>
  <div class="row"><strong>TOTAL</strong><strong>Rp 35.000</strong></div>
  <div class="hr"></div>
  <div>${config.footerText}</div>
</body></html>`
}

export default function PrinterSettingsView() {
  const { device, isConnecting, error } = usePrinterState()
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [btSupported, setBtSupported] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setConfig(loadPrinterConfig())
    setBtSupported(typeof navigator !== 'undefined' && !!(navigator as any).bluetooth)
    autoConnectBluetoothPrinter()
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const handleConnect = async () => {
    if (device) {
      disconnectBluetoothPrinter()
      return
    }
    const ok = await connectBluetoothPrinter()
    if (!ok) showToast('error', printerStore.getState().error || 'Gagal menghubungkan printer')
    else showToast('success', 'Printer terhubung')
  }

  const handleSave = () => {
    setSaving(true)
    savePrinterConfig(config)
    setTimeout(() => {
      setSaving(false)
      showToast('success', 'Preferensi cetak disimpan')
    }, 200)
  }

  const handleTestPrint = async () => {
    setTesting(true)
    try {
      if (printerStore.getState().characteristic) {
        await printBytes(buildSampleReceipt(config))
      } else {
        await printHtmlFallback(sampleHtml(config))
      }
      showToast('success', 'Uji cetak dikirim')
    } catch (e: any) {
      showToast('error', e?.message || 'Uji cetak gagal')
    } finally {
      setTesting(false)
    }
  }

  const set = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown flex items-center gap-2">
          <Printer className="text-suka-orange" /> Pengaturan Printer
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Kelola koneksi printer thermal Bluetooth dan preferensi cetak. Setelan tersimpan di perangkat ini.
        </p>
      </div>

      {/* KARTU 1: KONEKSI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Bluetooth className="text-blue-500" /> Koneksi Printer
        </h2>
        {!btSupported ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold flex items-start gap-2">
            <AlertCircle className="shrink-0" size={18} />
            Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome / Edge terbaru di HTTPS.
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${
                device ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {device ? <BluetoothConnected size={16} /> : <Bluetooth size={16} />}
                {device ? (device.name || 'Printer terhubung') : 'Belum terhubung'}
              </span>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center gap-2 ${
                device ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-suka-orange text-white hover:bg-orange-600'
              }`}
            >
              {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Bluetooth size={16} />}
              {isConnecting ? 'Menghubungkan...' : device ? 'Putuskan' : 'Hubungkan Printer'}
            </button>
          </div>
        )}
        {error && !device && (
          <p className="text-xs text-red-600 font-semibold">{error}</p>
        )}
      </div>

      {/* KARTU 2: KONFIGURASI CETAK */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <h2 className="font-bold text-lg text-slate-800">Konfigurasi Cetak</h2>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Ukuran Kertas</label>
          <div className="flex gap-3">
            {([58, 80] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => set('paperWidth', w)}
                className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors ${
                  config.paperWidth === w
                    ? 'border-suka-orange bg-orange-50 text-suka-brown'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {w}mm
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Perataan</label>
          <div className="flex gap-3">
            {(['center', 'left'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set('align', a)}
                className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors capitalize ${
                  config.align === a
                    ? 'border-suka-orange bg-orange-50 text-suka-brown'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {a === 'center' ? 'Tengah' : 'Kiri'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Kepadatan</label>
          <div className="flex gap-3">
            {(['normal', 'padat'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('density', d)}
                className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors capitalize ${
                  config.density === d
                    ? 'border-suka-orange bg-orange-50 text-suka-brown'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.showLogo}
            onChange={(e) => set('showLogo', e.target.checked)}
            className="w-5 h-5 rounded accent-suka-orange"
          />
          <span className="text-sm font-bold text-slate-700">Tampilkan logo di struk</span>
        </label>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Teks Header</label>
          <input
            type="text"
            value={config.headerText}
            onChange={(e) => set('headerText', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all"
            placeholder="SUKA SHAWARMA"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Teks Footer</label>
          <input
            type="text"
            value={config.footerText}
            onChange={(e) => set('footerText', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all"
            placeholder="Terima kasih"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-70"
        >
          {saving ? <Loader2 className="animate-spin text-suka-orange" size={18} /> : <Save size={18} />}
          {saving ? 'Menyimpan...' : 'Simpan Preferensi'}
        </button>
      </div>

      {/* KARTU 3: LAYOUT & UJI CETAK */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-lg text-slate-800">Layout & Uji Cetak</h2>
        <p className="text-sm text-slate-500">Pratinjau struk memakai preferensi di atas.</p>

        <div className="flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div
            className="bg-white shadow-md border border-slate-200 p-3 font-mono text-[11px] text-black"
            style={{ width: config.paperWidth === 80 ? '260px' : '190px', textAlign: config.align }}
          >
            <div className="font-black text-sm">{config.headerText}</div>
            <div>-- CONTOH STRUK / UJI CETAK --</div>
            <div className="border-t-2 border-dashed border-black my-1" />
            <div className="flex justify-between text-left"><span>Item Contoh</span><span>Rp 10.000</span></div>
            <div className="flex justify-between text-left"><span>Item Kedua</span><span>Rp 25.000</span></div>
            <div className="border-t-2 border-dashed border-black my-1" />
            <div className="flex justify-between text-left font-black"><span>TOTAL</span><span>Rp 35.000</span></div>
            <div className="border-t-2 border-dashed border-black my-1" />
            <div>{config.footerText}</div>
          </div>
        </div>

        <button
          onClick={handleTestPrint}
          disabled={testing}
          className="px-6 py-3 bg-suka-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-70"
        >
          {testing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
          {testing ? 'Mengirim...' : device ? 'Uji Cetak (Bluetooth)' : 'Uji Cetak (Browser)'}
        </button>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
