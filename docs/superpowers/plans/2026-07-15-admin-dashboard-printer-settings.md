# Pengaturan Printer (admin-dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan halaman **Pengaturan Printer** di admin-dashboard (`/dashboard/printer`, grup nav Sistem, ADMIN) untuk mengelola koneksi printer thermal Bluetooth + preferensi cetak (kertas, logo, header/footer, layout) + uji cetak.

**Architecture:** Port stack Bluetooth thermal dari `apps/pos-kasir` (ESC/POS encoder + Web Bluetooth) ke `apps/admin-dashboard/src/lib/printer/`, didekopel dari bentuk `ReceiptData` khusus POS (layer Bluetooth hanya kirim `Uint8Array`). State koneksi via store vanilla `useSyncExternalStore` (tanpa dependency zustand baru). Preferensi cetak persist di `localStorage`. Tidak ada DB/migration. Wiring cetak ke dokumen nyata di luar scope.

**Tech Stack:** Next.js App Router (client component), TypeScript, TailwindCSS, Web Bluetooth API, React `useSyncExternalStore`, Vitest.

**Referensi sumber (port):** `apps/pos-kasir/lib/escpos-encoder.ts`, `apps/pos-kasir/lib/printerStore.ts`, `apps/pos-kasir/lib/bluetooth-printer.ts`, `apps/pos-kasir/lib/printReceipt.ts` (fallback iframe).

---

## File Structure

- Create `apps/admin-dashboard/src/lib/printer/escpos-encoder.ts` — encoder ESC/POS (port apa adanya).
- Create `apps/admin-dashboard/src/lib/printer/printerStore.ts` — store koneksi vanilla (state + subscribe + hook).
- Create `apps/admin-dashboard/src/lib/printer/printerConfig.ts` — tipe `PrinterConfig`, load/save localStorage, `buildSampleReceipt`.
- Create `apps/admin-dashboard/src/lib/printer/printerConfig.test.ts` — unit test config + sample receipt.
- Create `apps/admin-dashboard/src/lib/printer/bluetooth-printer.ts` — connect/autoConnect/disconnect/printBytes + fallback iframe.
- Create `apps/admin-dashboard/src/components/printer/PrinterSettingsView.tsx` — UI 3 kartu.
- Create `apps/admin-dashboard/src/app/dashboard/printer/page.tsx` — route render view.
- Modify `apps/admin-dashboard/src/components/layout/navConfig.ts` — tambah item ke grup Sistem.
- Modify `apps/admin-dashboard/src/components/layout/navConfig.test.ts` — assert item baru.

Semua perintah dijalankan dari `apps/admin-dashboard/` kecuali disebutkan lain.

---

## Task 1: Port ESC/POS encoder

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/escpos-encoder.ts`

- [ ] **Step 1: Buat file encoder (port apa adanya dari pos-kasir)**

```ts
export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.initialize();
  }

  public initialize() {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  public alignLeft() {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter() {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight() {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  public bold(on: boolean) {
    this.buffer.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  public size(doubleWidth: boolean, doubleHeight: boolean) {
    let size = 0;
    if (doubleHeight) size |= 0x01;
    if (doubleWidth) size |= 0x10;
    this.buffer.push(0x1d, 0x21, size);
    return this;
  }

  public underline(on: boolean) {
    this.buffer.push(0x1b, 0x2d, on ? 1 : 0);
    return this;
  }

  public text(str: string) {
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code > 255) code = 63;
      this.buffer.push(code);
    }
    return this;
  }

  public newline() {
    this.buffer.push(0x0a);
    return this;
  }

  public line(str: string) {
    this.text(str);
    this.newline();
    return this;
  }

  public hr(char = '-', width = 32) {
    this.line(char.repeat(width));
    return this;
  }

  public row(left: string, right: string, char = ' ', width = 32) {
    if (left.length + right.length > width) {
      left = left.substring(0, width - right.length - 1);
    }
    const spacesCount = width - left.length - right.length;
    const middle = char.repeat(Math.max(0, spacesCount));
    this.line(left + middle + right);
    return this;
  }

  public cut(partial = false) {
    this.newline().newline().newline().newline();
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  public encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
```

> Catatan: `hr`/`row` diberi parameter `width` (default 32 = 58mm) supaya 80mm bisa pakai 48. Sisanya identik dengan pos-kasir.

- [ ] **Step 2: Type-check file**

Run: `yarn type-check`
Expected: PASS (0 error baru).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/escpos-encoder.ts
git commit -m "feat(admin-dashboard): port ESC/POS encoder untuk printer thermal"
```

---

## Task 2: Config printer + sample receipt (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/printerConfig.ts`
- Test: `apps/admin-dashboard/src/lib/printer/printerConfig.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_PRINTER_CONFIG,
  loadPrinterConfig,
  savePrinterConfig,
  buildSampleReceipt,
  type PrinterConfig,
} from './printerConfig'

describe('printerConfig localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mengembalikan default saat localStorage kosong', () => {
    expect(loadPrinterConfig()).toEqual(DEFAULT_PRINTER_CONFIG)
  })

  it('round-trip save lalu load', () => {
    const cfg: PrinterConfig = {
      ...DEFAULT_PRINTER_CONFIG,
      paperWidth: 80,
      showLogo: false,
      headerText: 'TOKO A',
      footerText: 'Sampai jumpa',
      density: 'padat',
      align: 'left',
    }
    savePrinterConfig(cfg)
    expect(loadPrinterConfig()).toEqual(cfg)
  })

  it('merge default bila JSON tersimpan tidak lengkap', () => {
    localStorage.setItem('admin_printer_config', JSON.stringify({ paperWidth: 80 }))
    const loaded = loadPrinterConfig()
    expect(loaded.paperWidth).toBe(80)
    expect(loaded.showLogo).toBe(DEFAULT_PRINTER_CONFIG.showLogo)
  })

  it('fallback ke default bila JSON korup', () => {
    localStorage.setItem('admin_printer_config', '{bukan json')
    expect(loadPrinterConfig()).toEqual(DEFAULT_PRINTER_CONFIG)
  })
})

describe('buildSampleReceipt', () => {
  it('menghasilkan bytes non-kosong', () => {
    const bytes = buildSampleReceipt(DEFAULT_PRINTER_CONFIG)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('80mm menghasilkan output berbeda dari 58mm (lebar berbeda)', () => {
    const a = buildSampleReceipt({ ...DEFAULT_PRINTER_CONFIG, paperWidth: 58 })
    const b = buildSampleReceipt({ ...DEFAULT_PRINTER_CONFIG, paperWidth: 80 })
    expect(b.length).not.toBe(a.length)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `yarn vitest run src/lib/printer/printerConfig.test.ts`
Expected: FAIL — module `./printerConfig` belum ada.

- [ ] **Step 3: Implementasi minimal**

```ts
import { EscPosEncoder } from './escpos-encoder'

export interface PrinterConfig {
  paperWidth: 58 | 80          // mm
  showLogo: boolean
  headerText: string
  footerText: string
  density: 'normal' | 'padat'
  align: 'left' | 'center'
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: 58,
  showLogo: true,
  headerText: 'SUKA SHAWARMA',
  footerText: 'Terima kasih',
  density: 'normal',
  align: 'center',
}

const STORAGE_KEY = 'admin_printer_config'

export function loadPrinterConfig(): PrinterConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PRINTER_CONFIG }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG }
    const parsed = JSON.parse(raw) as Partial<PrinterConfig>
    return { ...DEFAULT_PRINTER_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG }
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** Lebar karakter per baris menurut ukuran kertas. */
export function charWidth(paperWidth: 58 | 80): number {
  return paperWidth === 80 ? 48 : 32
}

/** Bangun struk contoh untuk uji cetak, memakai preferensi aktif. */
export function buildSampleReceipt(config: PrinterConfig): Uint8Array {
  const w = charWidth(config.paperWidth)
  const enc = new EscPosEncoder()
  enc.initialize()

  if (config.align === 'center') enc.alignCenter()
  else enc.alignLeft()

  enc.bold(true).size(false, true).line(config.headerText).size(false, false).bold(false)
  enc.line('-- CONTOH STRUK / UJI CETAK --')
  enc.alignLeft().hr('-', w)
  enc.row('Item Contoh', 'Rp 10.000', ' ', w)
  enc.row('Item Kedua', 'Rp 25.000', ' ', w)
  enc.hr('-', w)
  enc.bold(true).row('TOTAL', 'Rp 35.000', ' ', w).bold(false)
  enc.hr('-', w)

  if (config.align === 'center') enc.alignCenter()
  enc.newline().line(config.footerText).newline()
  enc.cut()
  return enc.encode()
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `yarn vitest run src/lib/printer/printerConfig.test.ts`
Expected: PASS semua.

> `vitest.config` app sudah `environment: 'jsdom'` global → `localStorage` tersedia, tak perlu direktif per-file.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/printerConfig.ts apps/admin-dashboard/src/lib/printer/printerConfig.test.ts
git commit -m "feat(admin-dashboard): printer config localStorage + sample receipt (TDD)"
```

---

## Task 3: Store koneksi printer (vanilla, tanpa zustand)

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/printerStore.ts`

- [ ] **Step 1: Buat store eksternal + hook**

```ts
'use client'

import { useSyncExternalStore } from 'react'

export interface WebBluetoothDevice extends EventTarget {
  id: string
  name?: string
  gatt?: {
    connected: boolean
    disconnect: () => void
  }
}

export interface PrinterState {
  device: WebBluetoothDevice | null
  characteristic: any | null // BluetoothRemoteGATTCharacteristic
  isConnecting: boolean
  error: string | null
}

let state: PrinterState = {
  device: null,
  characteristic: null,
  isConnecting: false,
  error: null,
}

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function setState(patch: Partial<PrinterState>) {
  state = { ...state, ...patch }
  emit()
}

export const printerStore = {
  getState(): PrinterState {
    return state
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setDevice(device: WebBluetoothDevice, characteristic: any) {
    device.addEventListener('gattserverdisconnected', () => {
      setState({ device: null, characteristic: null })
    })
    setState({ device, characteristic, error: null, isConnecting: false })
  },
  disconnect() {
    if (state.device?.gatt?.connected) {
      state.device.gatt.disconnect()
    }
    setState({ device: null, characteristic: null, error: null })
  },
  setConnecting(status: boolean) {
    setState({ isConnecting: status })
  },
  setError(error: string | null) {
    setState({ error, isConnecting: false })
  },
}

/** Hook React untuk membaca state store (re-render saat berubah). */
export function usePrinterState(): PrinterState {
  return useSyncExternalStore(
    printerStore.subscribe,
    printerStore.getState,
    printerStore.getState, // server snapshot (SSR) = state awal
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/printerStore.ts
git commit -m "feat(admin-dashboard): store koneksi printer via useSyncExternalStore"
```

---

## Task 4: Layer Bluetooth (connect / autoConnect / printBytes / fallback)

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/bluetooth-printer.ts`

- [ ] **Step 1: Buat file (adaptasi dari pos-kasir, tanpa ReceiptData)**

```ts
import { printerStore, WebBluetoothDevice } from './printerStore'

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const CUSTOM_SERVICE_UUID_1 = '49535343-fe7d-4ae5-8fa9-9fafd205e455'
const CUSTOM_SERVICE_UUID_2 = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'

const SERVICES = [PRINTER_SERVICE_UUID, CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2]
const SAVED_ID_KEY = 'admin_saved_printer_id'

async function connectToDevice(device: BluetoothDevice): Promise<boolean> {
  if (!device.gatt) throw new Error('Perangkat tidak mendukung GATT Bluetooth.')

  const server = await device.gatt.connect()
  let targetCharacteristic: any = null

  for (const serviceUuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid.toLowerCase())
      const characteristics = await service.getCharacteristics()
      targetCharacteristic = characteristics.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse,
      )
      if (targetCharacteristic) break
    } catch {
      // service tidak ada di device ini, lanjut
    }
  }

  if (!targetCharacteristic) {
    throw new Error(
      'Tidak menemukan layanan cetak pada printer ini. Pastikan ini printer thermal yang kompatibel.',
    )
  }

  printerStore.setDevice(device as WebBluetoothDevice, targetCharacteristic)
  if (device.id) localStorage.setItem(SAVED_ID_KEY, device.id)
  return true
}

export async function connectBluetoothPrinter(): Promise<boolean> {
  printerStore.setConnecting(true)
  try {
    if (!(navigator as any).bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge terbaru.')
    }
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [CUSTOM_SERVICE_UUID_1] },
        { services: [CUSTOM_SERVICE_UUID_2] },
        { services: [PRINTER_SERVICE_UUID] },
        { namePrefix: 'PANDA' },
        { namePrefix: 'PRJ' },
        { namePrefix: 'Printer' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'MTP' },
      ],
      optionalServices: [CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2, PRINTER_SERVICE_UUID],
    })
    return await connectToDevice(device)
  } catch (error: any) {
    printerStore.setError(error?.message ?? 'Koneksi gagal')
    return false
  }
}

export async function autoConnectBluetoothPrinter(): Promise<boolean> {
  try {
    const savedId = localStorage.getItem(SAVED_ID_KEY)
    if (!savedId) return false
    const bt = (navigator as any).bluetooth
    if (bt && bt.getDevices) {
      printerStore.setConnecting(true)
      const devices = await bt.getDevices()
      const device = devices.find((d: any) => d.id === savedId)
      if (device) return await connectToDevice(device)
    }
  } catch {
    // abaikan; auto-connect best-effort
  } finally {
    if (printerStore.getState().isConnecting) printerStore.setConnecting(false)
  }
  return false
}

export function disconnectBluetoothPrinter(): void {
  printerStore.disconnect()
}

/** Kirim payload ESC/POS ke printer terhubung (chunk 256 byte). */
export async function printBytes(payload: Uint8Array): Promise<void> {
  const { characteristic } = printerStore.getState()
  if (!characteristic) throw new Error('Printer belum terkoneksi')

  const maxChunkSize = 256
  for (let i = 0; i < payload.length; i += maxChunkSize) {
    const chunk = payload.slice(i, i + maxChunkSize)
    await characteristic.writeValue(chunk)
    await new Promise((r) => setTimeout(r, 20))
  }
}

/**
 * Fallback cetak lewat hidden iframe + window.print() saat printer Bluetooth
 * tidak terhubung. `html` adalah dokumen struk lengkap.
 */
export function printHtmlFallback(html: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = () => setTimeout(() => iframe.parentNode?.removeChild(iframe), 500)
    const doc = iframe.contentWindow?.document
    const win = iframe.contentWindow
    if (!doc || !win) {
      cleanup()
      return resolve()
    }
    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } finally {
        cleanup()
        resolve()
      }
    }, 300)
  })
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/bluetooth-printer.ts
git commit -m "feat(admin-dashboard): layer Web Bluetooth printer (connect/print/fallback)"
```

---

## Task 5: UI PrinterSettingsView (3 kartu)

**Files:**
- Create: `apps/admin-dashboard/src/components/printer/PrinterSettingsView.tsx`

- [ ] **Step 1: Buat komponen view**

```tsx
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
```

> `density` disimpan & ditampilkan tapi belum mengubah byte output (hook masa depan) — sengaja minimal sesuai scope "settings saja". Jangan tambah logika cetak dokumen nyata.

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS. (Ikon `Printer`, `Bluetooth`, `BluetoothConnected` sudah terverifikasi ada di lucide `^0.300.0`.)

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/printer/PrinterSettingsView.tsx
git commit -m "feat(admin-dashboard): UI PrinterSettingsView (koneksi + config + uji cetak)"
```

---

## Task 6: Route halaman

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/printer/page.tsx`

- [ ] **Step 1: Buat page**

```tsx
import PrinterSettingsView from '@/components/printer/PrinterSettingsView'

export default function PrinterSettingsPage() {
  return <PrinterSettingsView />
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/printer/page.tsx
git commit -m "feat(admin-dashboard): route /dashboard/printer"
```

---

## Task 7: Item nav grup Sistem (TDD)

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Test: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

- [ ] **Step 1: Tambah test yang gagal (di akhir file test, sebelum EOF)**

```ts
describe('Pengaturan Printer nav item', () => {
  it('ADMIN punya Pengaturan Printer di grup Sistem, OWNER tidak', () => {
    const admin = accessibleItems('ADMIN').map((i) => i.href)
    const owner = accessibleItems('OWNER').map((i) => i.href)
    expect(admin).toContain('/dashboard/printer')
    expect(owner).not.toContain('/dashboard/printer')

    const sistem = accessibleGroups('ADMIN').find((g) => g.title === 'Sistem')
    expect(sistem?.items.map((i) => i.href)).toContain('/dashboard/printer')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `yarn vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL — `/dashboard/printer` belum ada di nav.

- [ ] **Step 3: Tambah import ikon `Printer`**

Di `navConfig.ts` baris import lucide (baris ~5), tambahkan `Printer`:

```ts
  Package, FileText, Settings, ShoppingCart, Truck, TrendingDown, Printer, type LucideIcon,
```

- [ ] **Step 4: Tambah item ke grup Sistem**

Di array `items` grup `title: 'Sistem'`, tambahkan setelah baris `system-health`:

```ts
      { href: '/dashboard/printer', label: 'Pengaturan Printer', shortLabel: 'Printer', icon: Printer, roles: ['ADMIN'] },
```

Hasil grup Sistem menjadi:

```ts
  {
    title: 'Sistem',
    icon: Settings,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/panduan', label: 'Panduan Sistem', shortLabel: 'Panduan', icon: BookOpen, roles: ['ADMIN', 'OWNER'] },
      { href: '/dashboard/push-center', label: 'Pusat Notifikasi', shortLabel: 'Notifikasi', icon: BellRing, roles: ['ADMIN'] },
      { href: '/dashboard/system-health', label: 'Kesehatan Sistem', shortLabel: 'Sistem', icon: Activity, roles: ['ADMIN'] },
      { href: '/dashboard/printer', label: 'Pengaturan Printer', shortLabel: 'Printer', icon: Printer, roles: ['ADMIN'] },
    ],
  },
```

- [ ] **Step 5: Jalankan test, pastikan LULUS**

Run: `yarn vitest run src/components/layout/navConfig.test.ts`
Expected: PASS semua (termasuk test lama yang tak berubah — grup Sistem tetap ada, jumlah pintu tak berubah).

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): nav item Pengaturan Printer di grup Sistem (TDD)"
```

---

## Task 8: Verifikasi akhir

- [ ] **Step 1: Full type-check**

Run: `yarn type-check`
Expected: 0 error baru dari file printer (error pre-existing tak-terkait di file lain — mis. BOM/bahan-baku — boleh diabaikan; catat bila ada).

- [ ] **Step 2: Full test suite**

Run: `yarn vitest run`
Expected: test printer (`printerConfig.test.ts`, `navConfig.test.ts`) hijau; tidak ada regresi baru.

- [ ] **Step 3: Build**

Run: `yarn build`
Expected: sukses; route `/dashboard/printer` muncul di output (`ƒ` atau `○`).

- [ ] **Step 4: Smoke test manual (dicatat, bukan otomatis)**

- Buka `/dashboard/printer` sebagai ADMIN → 3 kartu tampil.
- Ubah paper width 58→80 → pratinjau melebar; klik Simpan → reload halaman → setelan bertahan.
- Klik "Uji Cetak (Browser)" tanpa printer → dialog print browser muncul.
- (Opsional, perangkat fisik) "Hubungkan Printer" → pilih thermal → status jadi hijau → "Uji Cetak (Bluetooth)" mencetak struk contoh.

- [ ] **Step 5: Commit akhir bila ada perubahan tersisa**

```bash
git add -A
git commit -m "chore(admin-dashboard): finalize pengaturan printer" || echo "nothing to commit"
```

---

## Catatan Self-Review

- **Spec coverage:** koneksi Bluetooth (Task 4+5 kartu 1) ✓; config kertas/logo/header/footer/layout (Task 2, Task 5 kartu 2) ✓; uji cetak + preview (Task 5 kartu 3) ✓; persistensi localStorage (Task 2) ✓; home `/dashboard/printer` grup Sistem ADMIN (Task 6, 7) ✓; isolasi tanpa DB/@suka/app lain ✓; degrade tanpa Web Bluetooth (Task 5 `btSupported`) ✓.
- **Penyimpangan spec (disengaja):** spec menyebut zustand (port pos-kasir); diganti store `useSyncExternalStore` karena admin-dashboard tak punya dependency zustand — menghindari menambah dependency baru. Perilaku identik.
- **Konsistensi tipe:** `PrinterConfig` fields identik di Task 2/5; `printerStore`/`usePrinterState`/`printBytes`/`printHtmlFallback` dipakai konsisten di Task 5.
