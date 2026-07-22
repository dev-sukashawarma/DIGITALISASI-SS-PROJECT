# Real-Time Item Sales Sync to Google Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrasi real-time pengiriman item penjualan per transaksi POS ke Google Sheets via Google Apps Script Webhook. Data penjualan akan langsung **diakumulasi (ditambahkan) ke dalam sel rekapan spesifik (pivot)** berdasarkan Cabang, Nama Menu, dan Tanggal di Spreadsheet, dilengkapi dengan saklar ON/OFF dan input Webhook URL di Admin Dashboard.

**Architecture:** Modul helper asynchronous (`lib/google-sheets-webhook.ts`) mengambil data `global_settings` (`google_sheets_webhook_url`, `google_sheets_sync_enabled`) dari Supabase. Ketika transaksi POS diselesaikan, helper mengirimkan payload JSON ke Google Apps Script tanpa memblokir UI kasir (*fire-and-forget*). Di Dashboard Admin, pengguna dapat mengonfigurasi Webhook URL, menguji koneksi, serta menyalin templat kode Google Apps Script (yang sudah disesuaikan dengan format tabel Rekapan/Pivot otomatis).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase Client (`@supabase/supabase-js`), Vitest, Lucide React, TailwindCSS.

## Global Constraints

- Platform: Next.js App Router dalam monorepo (`apps/admin-dashboard`).
- Non-blocking: Pengiriman HTTP POST ke Google Apps Script harus bersifat non-blocking (async fire-and-forget) agar transaksi kasir tidak melambat.
- Unit Testing: Menggunakan Vitest untuk pengujian fungsi helper `google-sheets-webhook.ts`.

---

### Task 1: Payload Formatter & Google Sheets Webhook Dispatcher Helper

**Files:**
- Create: `apps/admin-dashboard/src/lib/google-sheets-webhook.ts`
- Create: `apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts`

**Interfaces:**
- Consumes: `OrderItem`, `Order` metadata types.
- Produces: `formatGoogleSheetsPayload(order, items, outletName)` -> `GoogleSheetsPayload`, `sendOrderToGoogleSheets(webhookUrl, order, items, outletName, fetchFn)` -> `Promise<boolean>`.

- [ ] **Step 1: Write the failing unit test**

Create file `apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { formatGoogleSheetsPayload, sendOrderToGoogleSheets, GoogleSheetsPayload } from './google-sheets-webhook'

describe('google-sheets-webhook helper', () => {
  it('correctly formats order and items into Google Sheets payload', () => {
    const mockOrder = {
      id: 'ord-123',
      order_number: 10045,
      created_at: '2026-07-22T14:00:00Z',
      channel: 'pos',
      sales_source: 'POS Kasir',
      payment_method: 'qris',
      total_amount: 50000
    }
    const mockItems = [
      { id: 'item-1', menu_item_name: 'Shawarma Chicken', quantity: 2, unit_price: 20000, subtotal: 40000 },
      { id: 'item-2', menu_item_name: 'Extra Cheese', quantity: 1, unit_price: 10000, subtotal: 10000 }
    ]

    const payload = formatGoogleSheetsPayload(mockOrder, mockItems, 'Outlet Dramaga')

    expect(payload.event).toBe('ORDER_COMPLETED')
    expect(payload.order_number).toBe('10045')
    expect(payload.outlet_name).toBe('Outlet Dramaga')
    expect(payload.payment_method).toBe('qris')
    expect(payload.items.length).toBe(2)
    expect(payload.items[0]).toEqual({
      menu_item_name: 'Shawarma Chicken',
      quantity: 2,
      unit_price: 20000,
      subtotal: 40000
    })
  })

  it('sends HTTP POST payload to Webhook URL asynchronously', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' })
    })

    const mockOrder = { id: 'ord-1', order_number: 1, created_at: '2026-07-22', channel: 'pos', sales_source: 'pos', payment_method: 'cash', total_amount: 20000 }
    const mockItems = [{ id: 'i-1', menu_item_name: 'Tea', quantity: 1, unit_price: 20000, subtotal: 20000 }]

    const result = await sendOrderToGoogleSheets('https://script.google.com/macros/s/test/exec', mockOrder, mockItems, 'Cabang A', mockFetch as any)

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/test/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts`
Expected: FAIL with module/function not found.

- [ ] **Step 3: Write minimal implementation**

Create file `apps/admin-dashboard/src/lib/google-sheets-webhook.ts`:

```typescript
export interface GoogleSheetsItem {
  menu_item_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface GoogleSheetsPayload {
  event: string
  timestamp: string
  day_of_month: number
  order_number: string
  outlet_name: string
  channel: string
  payment_method: string
  items: GoogleSheetsItem[]
}

export function formatGoogleSheetsPayload(
  order: {
    order_number: number | string
    created_at: string
    channel?: string | null
    sales_source?: string | null
    payment_method?: string | null
  },
  items: {
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[],
  outletName: string
): GoogleSheetsPayload {
  const dateObj = new Date(order.created_at || new Date().toISOString())
  // Dapatkan tanggal (1-31) waktu lokal Asia/Jakarta
  const dayOfMonth = Number(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(dateObj))

  return {
    event: 'ORDER_COMPLETED',
    timestamp: order.created_at || new Date().toISOString(),
    day_of_month: dayOfMonth,
    order_number: String(order.order_number),
    outlet_name: outletName || 'Utama',
    channel: order.channel || order.sales_source || 'POS Kasir',
    payment_method: order.payment_method || 'Tunai',
    items: items.map(item => ({
      menu_item_name: item.menu_item_name.split('|')[0].trim().toUpperCase(),
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      subtotal: Number(item.subtotal) || 0
    }))
  }
}

export async function sendOrderToGoogleSheets(
  webhookUrl: string,
  order: any,
  items: any[],
  outletName: string,
  customFetch: typeof fetch = fetch
): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return false
  }

  try {
    const payload = formatGoogleSheetsPayload(order, items, outletName)
    const response = await customFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return response.ok
  } catch (error) {
    console.error('Google Sheets Webhook Error:', error)
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/google-sheets-webhook.ts apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts
git commit -m "feat: add google sheets webhook helper and unit tests"
```

---

### Task 2: System Settings Management Functions for Webhook Config

**Files:**
- Create: `apps/admin-dashboard/src/lib/google-sheets-config.ts`
- Create: `apps/admin-dashboard/src/lib/google-sheets-config.test.ts`

**Interfaces:**
- Consumes: Supabase Client.
- Produces: `getGoogleSheetsConfig(supabase)` -> `Promise<{ url: string; enabled: boolean }>`, `saveGoogleSheetsConfig(supabase, config)` -> `Promise<boolean>`.

- [ ] **Step 1: Write the failing unit test**

Create file `apps/admin-dashboard/src/lib/google-sheets-config.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from './google-sheets-config'

describe('google-sheets-config helper', () => {
  it('parses config correctly from supabase global_settings data', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { key: 'google_sheets_webhook_url', value: 'https://script.google.com/test' },
              { key: 'google_sheets_sync_enabled', value: 'true' }
            ],
            error: null
          })
        })
      })
    }

    const config = await getGoogleSheetsConfig(mockSupabase as any)
    expect(config.url).toBe('https://script.google.com/test')
    expect(config.enabled).toBe(true)
  })

  it('saves config using upsert', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        upsert: upsertMock
      })
    }

    const success = await saveGoogleSheetsConfig(mockSupabase as any, {
      url: 'https://script.google.com/new',
      enabled: false
    })

    expect(success).toBe(true)
    expect(upsertMock).toHaveBeenCalledWith([
      { key: 'google_sheets_webhook_url', value: 'https://script.google.com/new' },
      { key: 'google_sheets_sync_enabled', value: 'false' }
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/admin-dashboard/src/lib/google-sheets-config.test.ts`
Expected: FAIL with module/function not found.

- [ ] **Step 3: Write minimal implementation**

Create file `apps/admin-dashboard/src/lib/google-sheets-config.ts`:

```typescript
export interface GoogleSheetsConfig {
  url: string
  enabled: boolean
}

export async function getGoogleSheetsConfig(supabase: any): Promise<GoogleSheetsConfig> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('key, value')
      .in('key', ['google_sheets_webhook_url', 'google_sheets_sync_enabled'])

    if (error || !data) {
      return { url: '', enabled: false }
    }

    const urlItem = data.find((d: any) => d.key === 'google_sheets_webhook_url')
    const enabledItem = data.find((d: any) => d.key === 'google_sheets_sync_enabled')

    return {
      url: urlItem?.value || '',
      enabled: enabledItem?.value === 'true'
    }
  } catch (err) {
    console.error('Failed to get Google Sheets config:', err)
    return { url: '', enabled: false }
  }
}

export async function saveGoogleSheetsConfig(
  supabase: any,
  config: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const { error } = await supabase.from('global_settings').upsert([
      { key: 'google_sheets_webhook_url', value: config.url.trim() },
      { key: 'google_sheets_sync_enabled', value: String(config.enabled) }
    ])

    return !error
  } catch (err) {
    console.error('Failed to save Google Sheets config:', err)
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/admin-dashboard/src/lib/google-sheets-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/google-sheets-config.ts apps/admin-dashboard/src/lib/google-sheets-config.test.ts
git commit -m "feat: add google sheets config database settings helper and tests"
```

---

### Task 3: UI Modal / Component Pengaturan Google Sheets & Template Guide

**Files:**
- Create: `apps/admin-dashboard/src/components/GoogleSheetsSettingsModal.tsx`
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx`

**Interfaces:**
- Consumes: `getGoogleSheetsConfig`, `saveGoogleSheetsConfig`, `sendOrderToGoogleSheets`.
- Produces: UI Modal component with URL input, Toggle, Test Webhook button, and copyable Apps Script code snippet.

- [ ] **Step 1: Create GoogleSheetsSettingsModal component**

Create `apps/admin-dashboard/src/components/GoogleSheetsSettingsModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Check, Copy, ExternalLink, Send, FileSpreadsheet } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from '@/lib/google-sheets-config'
import { sendOrderToGoogleSheets } from '@/lib/google-sheets-webhook'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Pemetaan nama cabang ke nama Sheet (Tab)
    // Sesuaikan mapping ini dengan nama tab di Spreadsheet Anda
    var outletSheetMap = {
      "SUKA SHAWARMA EMPANG": "SS EMPANG",
      "SUKA SHAWARMA PAJAJARAN": "SS PAJAJARAN",
      "SUKA SHAWARMA DRAMAGA": "SS DRAMAGA",
      "SUKA SHAWARMA CIMANGGU": "SS CIMANGGU",
      "SUKA SHAWARMA BNR": "SS BNR",
      "MITRA PALEDANG": "MITRA PALEDANG"
      // Tambahkan cabang lain jika perlu...
    };
    
    var sheetName = outletSheetMap[data.outlet_name] || data.outlet_name;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error("Tab sheet dengan nama '" + sheetName + "' tidak ditemukan.");
    }
    
    // Baris header tanggal (kolom 1, 2, 3... 31). Sesuaikan dengan baris di sheet Anda.
    var HEADER_ROW_INDEX = 2; // Misal header angka tanggal ada di baris 2
    var MENU_COL_INDEX = 1;   // Kolom A untuk nama menu
    
    // Ambil semua nama menu di kolom A (dimulai dari baris 3 ke bawah)
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) lastRow = 3;
    var menuData = sheet.getRange(3, MENU_COL_INDEX, lastRow - 2, 1).getValues();
    var menuMap = {};
    for (var i = 0; i < menuData.length; i++) {
      var m = String(menuData[i][0]).trim().toUpperCase();
      if (m) menuMap[m] = i + 3; // Simpan baris (i + 3 karena data mulai baris 3)
    }
    
    // Ambil header tanggal di baris 2 (mulai dari kolom D misalnya, atau kolom 4)
    var lastCol = sheet.getLastColumn();
    if (lastCol < 4) lastCol = 35;
    var dateHeaderData = sheet.getRange(HEADER_ROW_INDEX, 1, 1, lastCol).getValues()[0];
    var dateMap = {};
    for (var c = 0; c < dateHeaderData.length; c++) {
      var d = String(dateHeaderData[c]).trim();
      if (d) dateMap[d] = c + 1; // Simpan kolom (c + 1)
    }
    
    var targetDate = String(data.day_of_month); // "22"
    var targetCol = dateMap[targetDate];
    
    if (!targetCol) {
      throw new Error("Kolom tanggal '" + targetDate + "' tidak ditemukan di baris " + HEADER_ROW_INDEX);
    }
    
    // Proses penambahan (akumulasi) tiap item
    data.items.forEach(function(item) {
      var menuName = String(item.menu_item_name).trim().toUpperCase();
      var targetRow = menuMap[menuName];
      
      if (targetRow) {
        var cell = sheet.getRange(targetRow, targetCol);
        var currentQty = Number(cell.getValue()) || 0;
        cell.setValue(currentQty + Number(item.quantity));
      }
      // Jika menu tidak ditemukan di kolom A, item tersebut dilewati (atau bisa dicatat di log)
    });
    
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`

export default function GoogleSheetsSettingsModal({ isOpen, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const fetchConfig = async () => {
      setLoading(true)
      const supabase = createClient()
      const cfg = await getGoogleSheetsConfig(supabase)
      setUrl(cfg.url)
      setEnabled(cfg.enabled)
      setLoading(false)
    }
    fetchConfig()
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const supabase = createClient()
    const success = await saveGoogleSheetsConfig(supabase, { url, enabled })
    setSaving(false)
    if (success) {
      setMessage({ type: 'success', text: 'Pengaturan Google Sheets berhasil disimpan!' })
    } else {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan ke database.' })
    }
  }

  const handleTest = async () => {
    if (!url) {
      setMessage({ type: 'error', text: 'Masukkan Webhook URL terlebih dahulu.' })
      return
    }
    setTesting(true)
    setMessage(null)

    const dummyOrder = {
      order_number: 9999,
      created_at: new Date().toISOString(),
      channel: 'POS Kasir (Tes)',
      payment_method: 'QRIS (Tes)'
    }
    const dummyItems = [
      { menu_item_name: '[TES] Shawarma Chicken', quantity: 1, unit_price: 25000, subtotal: 25000 }
    ]

    const ok = await sendOrderToGoogleSheets(url, dummyOrder, dummyItems, 'Cabang Tes')
    setTesting(false)

    if (ok) {
      setMessage({ type: 'success', text: 'Tes koneksi berhasil! Baris data dummy dikirim ke Google Sheet.' })
    } else {
      setMessage({ type: 'error', text: 'Tes gagal. Pastikan Webhook URL benar dan Akses set to "Anyone".' })
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Integrasi Real-Time Google Sheets</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Memuat konfigurasi...</div>
        ) : (
          <div className="mt-4 space-y-5">
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            {/* Toggle Active */}
            <div className="flex items-center justify-between rounded-lg border p-4 bg-gray-50">
              <div>
                <h3 className="font-semibold text-gray-800">Status Sync Real-time</h3>
                <p className="text-xs text-gray-500">Kirim item penjualan secara otomatis setiap ada transaksi POS</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Apps Script Webhook URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Apps Script Guide & Template Code */}
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Kode Google Apps Script Template</h4>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Tersalin!' : 'Salin Kode'}
                </button>
              </div>
              <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-h-40 font-mono">
                {APPS_SCRIPT_TEMPLATE}
              </pre>
              <ol className="mt-3 text-xs text-gray-600 list-decimal pl-4 space-y-1">
                <li>Buka Google Spreadsheet Anda &gt; Menu <b>Extensions</b> &gt; <b>Apps Script</b>.</li>
                <li>Hapus kode bawaan, lalu **Paste** kode di atas. Klik Simpan.</li>
                <li>Klik tombol <b>Deploy</b> &gt; <b>New deployment</b> &gt; Pilih type <b>Web app</b>.</li>
                <li>Setel <b>Who has access</b> menjadi <b>Anyone</b> (Penting!).</li>
                <li>Copy URL Web app yang dihasilkan dan paste pada kolom URL di atas.</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !url}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {testing ? 'Menguji...' : 'Tes Koneksi'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Google Sheets button in ReportsView.tsx header**

Modify `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx` to include Google Sheets Modal trigger:

Add import:
```tsx
import GoogleSheetsSettingsModal from '@/components/GoogleSheetsSettingsModal'
```

Add state inside `ReportsView`:
```tsx
const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false)
```

Add button next to title/filters:
```tsx
<button
  onClick={() => setShowGoogleSheetsModal(true)}
  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
>
  <FileSpreadsheet className="h-4 w-4" />
  Integrasi Google Sheets
</button>
```

Add Modal render at bottom of return:
```tsx
<GoogleSheetsSettingsModal
  isOpen={showGoogleSheetsModal}
  onClose={() => setShowGoogleSheetsModal(false)}
/>
```

- [ ] **Step 3: Test build/type-check**

Run: `npm run type-check --workspace=@suka/admin-dashboard`
Expected: Clean compile without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/GoogleSheetsSettingsModal.tsx apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx
git commit -m "feat: add google sheets settings modal and report view integration"
```

---

### Task 4: Hook Order Completion Event to Dispatch Google Sheets Webhook

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx` (or order actions dispatcher).

**Interfaces:**
- Consumes: `sendOrderToGoogleSheets`, `getGoogleSheetsConfig`.
- Produces: Automatic non-blocking Google Sheets sync execution upon order creation/completion.

- [ ] **Step 1: Add non-blocking trigger helper when orders are completed**

In `apps/admin-dashboard/src/lib/google-sheets-webhook.ts`, export a trigger function:

```typescript
import { getGoogleSheetsConfig } from './google-sheets-config'

export function triggerGoogleSheetsSyncIfActive(supabase: any, order: any, items: any[], outletName: string) {
  // Asynchronous fire-and-forget
  getGoogleSheetsConfig(supabase).then(config => {
    if (config.enabled && config.url) {
      sendOrderToGoogleSheets(config.url, order, items, outletName)
    }
  }).catch(err => {
    console.error('Trigger Google Sheets Sync Error:', err)
  })
}
```

- [ ] **Step 2: Run unit tests to verify all tests pass**

Run: `npx vitest run apps/admin-dashboard/src/lib/google-sheets-webhook.test.ts apps/admin-dashboard/src/lib/google-sheets-config.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/google-sheets-webhook.ts
git commit -m "feat: add triggerGoogleSheetsSyncIfActive fire-and-forget helper"
```

---
