# Setelan Layout Cetak Terpusat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin mengatur layout 3 template cetak (Struk Customer, Struk Dapur, QR Surat Jalan) dari `/dashboard/printer`, tersimpan di `global_settings.print_layout`, dan benar-benar mengontrol hasil cetak asli di pos-kasir & distribusi — dengan fallback aman ke perilaku sekarang.

**Architecture:** Satu baris DB `global_settings` (key `print_layout`, JSONB) = sumber kebenaran; RLS existing izinkan `SELECT` semua authenticated. Tiap app punya reader lokal `printLayout.ts` (tipe + default = nilai hardcoded sekarang + `fetchPrintLayout` yang deep-merge di atas default, tak pernah throw). admin-dashboard = hub editor 3 tab; pos-kasir & distribusi = konsumen yang menerapkan layout ke template masing-masing. Tanpa tabel baru, tanpa `@suka/*` baru.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Supabase (global_settings), Vitest, Web Bluetooth (uji cetak).

**Spec:** `docs/superpowers/specs/2026-07-15-centralized-print-layout-design.md`

**Referensi file live (baca sebelum ubah):**
- pos-kasir: `lib/printReceipt.ts`, `lib/bluetooth-printer.ts`, `lib/escpos-encoder.ts`, `lib/supabase/client.ts`
- distribusi: `src/utils/generatePDF.ts` (fungsi `printBarcode`), `src/components/distribusi/SuratJalanList.tsx`
- admin: `src/components/printer/PrinterSettingsView.tsx`, `src/lib/printer/*`, `src/app/api/settings/route.ts`

**Kontrak canonical (SAMA di 3 app — jaga identik):**

```ts
export type PaperWidth = 58 | 80
export type FontScale = 'normal' | 'besar'

export interface CustomerLayout {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; footerText: string
  fontScale: FontScale; showCashier: boolean; showCustomer: boolean; showItemNotes: boolean
}
export interface KitchenLayout {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; fontScale: FontScale; showCustomer: boolean
}
export interface QrLayout {
  paperWidth: PaperWidth; showLogo: boolean; title: string; footerText: string; qrSizeMm: number
}
export interface PrintLayout {
  struk_customer: CustomerLayout; struk_dapur: KitchenLayout; qr_surat_jalan: QrLayout
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  struk_customer: {
    paperWidth: 58, showLogo: true, headerText: '', footerText: 'Terima kasih & selamat menikmati!',
    fontScale: 'normal', showCashier: true, showCustomer: true, showItemNotes: true,
  },
  struk_dapur: {
    paperWidth: 58, showLogo: true, headerText: 'STRUK DAPUR', fontScale: 'besar', showCustomer: true,
  },
  qr_surat_jalan: {
    paperWidth: 58, showLogo: false, title: 'VERIFIKASI SJ', footerText: 'Distribusi\nSuka Shawarma', qrSizeMm: 45,
  },
}
export const PRINT_LAYOUT_KEY = 'print_layout'
```

**Fungsi merge (SAMA di 3 app):**

```ts
export function mergePrintLayout(raw: unknown): PrintLayout {
  const r = (raw ?? {}) as Partial<PrintLayout>
  return {
    struk_customer: { ...DEFAULT_PRINT_LAYOUT.struk_customer, ...(r.struk_customer ?? {}) },
    struk_dapur: { ...DEFAULT_PRINT_LAYOUT.struk_dapur, ...(r.struk_dapur ?? {}) },
    qr_surat_jalan: { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, ...(r.qr_surat_jalan ?? {}) },
  }
}
```

Semua perintah dari `apps/<app>/` sesuai fase. Windows + Git Bash. Setiap commit tambahkan trailing line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

# FASE 1 — admin-dashboard (hub + DB)

Working dir: `apps/admin-dashboard`

## Task 1: Seed migration `print_layout`

**Files:**
- Create: `supabase/migrations/20260715120000_seed_print_layout.sql`

- [ ] **Step 1: Buat migration (idempotent, aditif)**

```sql
-- Seed default print layout config into existing global_settings (key/value JSONB).
-- Additive & idempotent: apps fall back to hardcoded defaults if this row is absent,
-- so this seed is a convenience for discoverability, not a hard requirement.
INSERT INTO global_settings (key, value)
VALUES (
  'print_layout',
  '{
    "struk_customer": {"paperWidth":58,"showLogo":true,"headerText":"","footerText":"Terima kasih & selamat menikmati!","fontScale":"normal","showCashier":true,"showCustomer":true,"showItemNotes":true},
    "struk_dapur": {"paperWidth":58,"showLogo":true,"headerText":"STRUK DAPUR","fontScale":"besar","showCustomer":true},
    "qr_surat_jalan": {"paperWidth":58,"showLogo":false,"title":"VERIFIKASI SJ","footerText":"Distribusi\nSuka Shawarma","qrSizeMm":45}
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Commit (push DB dilakukan manual di verifikasi akhir — lihat catatan)**

```bash
git add supabase/migrations/20260715120000_seed_print_layout.sql
git commit -m "feat(db): seed print_layout defaults into global_settings"
```

> JANGAN `supabase db push` di sini. DB remote shared & riwayat sering drift (lihat CLAUDE.md). Push ditangani manusia saat verifikasi akhir; fallback default membuat app tetap jalan tanpa baris ini.

---

## Task 2: Reader `printLayout.ts` (admin) — TDD

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/printLayout.ts`
- Test: `apps/admin-dashboard/src/lib/printer/printLayout.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('mergePrintLayout', () => {
  it('null/undefined → full default', () => {
    expect(mergePrintLayout(undefined)).toEqual(DEFAULT_PRINT_LAYOUT)
    expect(mergePrintLayout(null)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
  it('partial per-field jatuh ke default', () => {
    const merged = mergePrintLayout({ struk_customer: { paperWidth: 80 } })
    expect(merged.struk_customer.paperWidth).toBe(80)
    expect(merged.struk_customer.showCashier).toBe(true) // default
    expect(merged.struk_dapur).toEqual(DEFAULT_PRINT_LAYOUT.struk_dapur)
  })
  it('override penuh dipertahankan', () => {
    const custom = { qr_surat_jalan: { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, qrSizeMm: 60 } }
    expect(mergePrintLayout(custom).qr_surat_jalan.qrSizeMm).toBe(60)
  })
})

describe('fetchPrintLayout', () => {
  it('baris ada → merge value', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.resolve({ data: { value: { struk_customer: { paperWidth: 80 } } }, error: null }) }) }) }) }
    const layout = await fetchPrintLayout(supabase as any)
    expect(layout.struk_customer.paperWidth).toBe(80)
    expect(layout.struk_customer.showLogo).toBe(true) // default
  })
  it('baris tidak ada → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.resolve({ data: null, error: null }) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
  it('error/throw → default (tak melempar)', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.reject(new Error('boom')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `yarn vitest run src/lib/printer/printLayout.test.ts`
Expected: FAIL — module belum ada.

- [ ] **Step 3: Implementasi**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type PaperWidth = 58 | 80
export type FontScale = 'normal' | 'besar'

export interface CustomerLayout {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; footerText: string
  fontScale: FontScale; showCashier: boolean; showCustomer: boolean; showItemNotes: boolean
}
export interface KitchenLayout {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; fontScale: FontScale; showCustomer: boolean
}
export interface QrLayout {
  paperWidth: PaperWidth; showLogo: boolean; title: string; footerText: string; qrSizeMm: number
}
export interface PrintLayout {
  struk_customer: CustomerLayout; struk_dapur: KitchenLayout; qr_surat_jalan: QrLayout
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  struk_customer: {
    paperWidth: 58, showLogo: true, headerText: '', footerText: 'Terima kasih & selamat menikmati!',
    fontScale: 'normal', showCashier: true, showCustomer: true, showItemNotes: true,
  },
  struk_dapur: {
    paperWidth: 58, showLogo: true, headerText: 'STRUK DAPUR', fontScale: 'besar', showCustomer: true,
  },
  qr_surat_jalan: {
    paperWidth: 58, showLogo: false, title: 'VERIFIKASI SJ', footerText: 'Distribusi\nSuka Shawarma', qrSizeMm: 45,
  },
}

export const PRINT_LAYOUT_KEY = 'print_layout'

export function mergePrintLayout(raw: unknown): PrintLayout {
  const r = (raw ?? {}) as Partial<PrintLayout>
  return {
    struk_customer: { ...DEFAULT_PRINT_LAYOUT.struk_customer, ...(r.struk_customer ?? {}) },
    struk_dapur: { ...DEFAULT_PRINT_LAYOUT.struk_dapur, ...(r.struk_dapur ?? {}) },
    qr_surat_jalan: { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, ...(r.qr_surat_jalan ?? {}) },
  }
}

export async function fetchPrintLayout(supabase: SupabaseClient): Promise<PrintLayout> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', PRINT_LAYOUT_KEY)
      .maybeSingle()
    if (error || !data) return DEFAULT_PRINT_LAYOUT
    return mergePrintLayout((data as { value: unknown }).value)
  } catch {
    return DEFAULT_PRINT_LAYOUT
  }
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

Run: `yarn vitest run src/lib/printer/printLayout.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/printLayout.ts apps/admin-dashboard/src/lib/printer/printLayout.test.ts
git commit -m "feat(admin-dashboard): reader printLayout (global_settings, merge+fallback, TDD)"
```

---

## Task 3: Builder uji-cetak escpos per template — TDD

**Files:**
- Create: `apps/admin-dashboard/src/lib/printer/buildTemplateReceipt.ts`
- Test: `apps/admin-dashboard/src/lib/printer/buildTemplateReceipt.test.ts`

> `printerConfig.ts`/`printerConfig.test.ts` lama akan dihapus di **Task 4** (satu commit dengan rewrite view yang membuang import-nya) — jangan hapus di sini agar tak ada commit yang gagal build.

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'
import { buildTemplateReceipt } from './buildTemplateReceipt'

describe('buildTemplateReceipt', () => {
  it('menghasilkan bytes non-kosong untuk tiap template', () => {
    for (const t of ['struk_customer', 'struk_dapur', 'qr_surat_jalan'] as const) {
      const bytes = buildTemplateReceipt(t, DEFAULT_PRINT_LAYOUT)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBeGreaterThan(0)
    }
  })
  it('paperWidth 80 beda output dari 58 (customer)', () => {
    const l58 = DEFAULT_PRINT_LAYOUT
    const l80 = { ...l58, struk_customer: { ...l58.struk_customer, paperWidth: 80 as const } }
    expect(buildTemplateReceipt('struk_customer', l80).length)
      .not.toBe(buildTemplateReceipt('struk_customer', l58).length)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `yarn vitest run src/lib/printer/buildTemplateReceipt.test.ts`
Expected: FAIL — module belum ada.

- [ ] **Step 3: Implementasi (uji-cetak; contoh order untuk customer termasuk extra topping)**

```ts
import { EscPosEncoder } from './escpos-encoder'
import type { PrintLayout, PaperWidth } from './printLayout'

function charWidth(w: PaperWidth): number { return w === 80 ? 48 : 32 }

export function buildTemplateReceipt(
  template: keyof PrintLayout,
  layout: PrintLayout,
): Uint8Array {
  const enc = new EscPosEncoder()
  enc.initialize()

  if (template === 'qr_surat_jalan') {
    const c = layout.qr_surat_jalan
    const w = charWidth(c.paperWidth)
    enc.alignCenter().bold(true).size(false, true).line(c.title).size(false, false).bold(false)
    enc.line('[ QR ' + c.qrSizeMm + 'mm ]').hr('-', w)
    for (const ln of c.footerText.split('\n')) enc.line(ln)
    enc.cut()
    return enc.encode()
  }

  if (template === 'struk_dapur') {
    const c = layout.struk_dapur
    const w = charWidth(c.paperWidth)
    enc.alignCenter().bold(true).size(false, true).line(c.headerText || 'STRUK DAPUR').size(false, false).bold(false)
    enc.alignLeft().hr('-', w)
    if (c.showCustomer) enc.line('Pelanggan: Contoh')
    enc.line('No. 123').hr('-', w)
    enc.line('1x Shawarma Ayam')
    enc.line('  EXTRA Keju')
    enc.line('  EXTRA Kentang')
    enc.line('2x Kebab Daging')
    enc.cut()
    return enc.encode()
  }

  // struk_customer
  const c = layout.struk_customer
  const w = charWidth(c.paperWidth)
  enc.alignCenter().bold(true).size(false, c.fontScale === 'besar')
    .line(c.headerText || 'SUKA SHAWARMA').size(false, false).bold(false)
  enc.line('Suka Shawarma').alignLeft().hr('-', w)
  if (c.showCashier) enc.line('Kasir: Contoh')
  if (c.showCustomer) enc.line('Pelanggan: Contoh')
  enc.hr('-', w)
  enc.row('1x Shawarma Ayam', 'Rp 25.000', ' ', w)
  if (c.showItemNotes) enc.line(' - pedas, tanpa bawang')
  enc.row('  EXTRA Keju', 'Rp 5.000', ' ', w)
  enc.row('  EXTRA Kentang', 'Rp 5.000', ' ', w)
  enc.row('2x Kebab Daging', 'Rp 50.000', ' ', w)
  enc.hr('-', w)
  enc.bold(true).row('TOTAL', 'Rp 85.000', ' ', w).bold(false).hr('-', w)
  enc.alignCenter()
  for (const ln of c.footerText.split('\n')) enc.line(ln)
  enc.cut()
  return enc.encode()
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

Run: `yarn vitest run src/lib/printer/buildTemplateReceipt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/printer/buildTemplateReceipt.ts apps/admin-dashboard/src/lib/printer/buildTemplateReceipt.test.ts
git commit -m "feat(admin-dashboard): builder uji-cetak per template (TDD)"
```

---

## Task 4: Rework `PrinterSettingsView` — 3 tab + preview + save/load + uji cetak

**Files:**
- Rewrite: `apps/admin-dashboard/src/components/printer/PrinterSettingsView.tsx`
- Delete: `apps/admin-dashboard/src/lib/printer/printerConfig.ts`, `printerConfig.test.ts` (di-superseded oleh `printLayout.ts` + `buildTemplateReceipt.ts`)

Komponen ini sudah ada (kartu Koneksi + config generik). **Pertahankan** kartu Koneksi + import Bluetooth. **Ganti** kartu config generik dengan editor 3-tab. Ganti seluruh file dengan berikut:

- [ ] **Step 1: Tulis komponen baru**

```tsx
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
  DEFAULT_PRINT_LAYOUT, mergePrintLayout, PRINT_LAYOUT_KEY, type PrintLayout,
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

function customerPreviewHtml(c: PrintLayout['struk_customer'], forPrint: boolean): string {
  const notes = c.showItemNotes ? `<div class="note">- pedas, tanpa bawang</div>` : ''
  const cashier = c.showCashier ? `<div class="muted">Kasir: Contoh</div>` : ''
  const cust = c.showCustomer ? `<div class="muted">Pelanggan: Contoh</div>` : ''
  const logo = c.showLogo ? `<div class="logo">[LOGO]</div>` : ''
  const scale = c.fontScale === 'besar' ? 1.25 : 1
  const body = `
    ${logo}
    <div class="lg">${esc(c.headerText || 'SUKA SHAWARMA')}</div>
    <div class="muted">Suka Shawarma</div>
    <div class="hr"></div>
    ${cashier}${cust}
    <div class="hr"></div>
    <div class="row"><span>1x Shawarma Ayam</span><span>Rp 25.000</span></div>${notes}
    <div class="child"><span>EXTRA Keju</span><span>Rp 5.000</span></div>
    <div class="child"><span>EXTRA Kentang</span><span>Rp 5.000</span></div>
    <div class="row"><span>2x Kebab Daging</span><span>Rp 50.000</span></div>
    <div class="hr"></div>
    <div class="row total"><strong>TOTAL</strong><strong>Rp 85.000</strong></div>
    <div class="hr"></div>
    ${c.footerText.split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}`
  return wrapHtml(c.paperWidth, scale, body, forPrint)
}

function kitchenPreviewHtml(c: PrintLayout['struk_dapur'], forPrint: boolean): string {
  const cust = c.showCustomer ? `<div class="muted">Pelanggan: Contoh</div>` : ''
  const logo = c.showLogo ? `<div class="logo">[LOGO]</div>` : ''
  const body = `
    ${logo}
    <div class="lg">${esc(c.headerText || 'STRUK DAPUR')}</div>
    <div class="hr"></div>
    ${cust}
    <div>No. 123</div>
    <div class="hr"></div>
    <div>1x Shawarma Ayam</div>
    <div class="child"><span>EXTRA Keju</span></div>
    <div class="child"><span>EXTRA Kentang</span></div>
    <div>2x Kebab Daging</div>`
  return wrapHtml(c.paperWidth, c.fontScale === 'besar' ? 1.35 : 1.1, body, forPrint)
}

function qrPreviewHtml(c: PrintLayout['qr_surat_jalan'], forPrint: boolean): string {
  const logo = c.showLogo ? `<div class="logo">[LOGO]</div>` : ''
  const body = `
    ${logo}
    <div class="lg">${esc(c.title)}</div>
    <div class="qr" style="width:${c.qrSizeMm}mm;height:${c.qrSizeMm}mm">QR</div>
    <div class="hr"></div>
    ${c.footerText.split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}`
  return wrapHtml(c.paperWidth, 1, body, forPrint)
}

function wrapHtml(paperWidth: number, scale: number, body: string, forPrint: boolean): string {
  const page = forPrint ? `@page { size: ${paperWidth}mm auto; margin: 0; }` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>
    ${page}
    body { width:${paperWidth}mm; margin:0; padding:6px 8px; font-family:'Courier New',monospace;
           color:#000; font-weight:900; font-size:${Math.round(13 * scale)}px; text-align:center; }
    .lg { font-size:${Math.round(17 * scale)}px; }
    .muted { font-size:${Math.round(12 * scale)}px; }
    .logo { font-size:11px; border:1px dashed #000; display:inline-block; padding:2px 6px; margin-bottom:4px; }
    .hr { border-top:2px dashed #000; margin:5px 0; }
    .row, .child, .total { display:flex; justify-content:space-between; text-align:left; }
    .child { padding-left:10px; border-left:2px solid #000; margin-left:4px; }
    .note { text-align:left; font-style:italic; font-size:${Math.round(11 * scale)}px; }
    .qr { border:2px solid #000; margin:8px auto; display:flex; align-items:center; justify-content:center; }
  </style></head><body>${body}</body></html>`
}

function previewHtml(tab: TabKey, layout: PrintLayout, forPrint: boolean): string {
  if (tab === 'struk_customer') return customerPreviewHtml(layout.struk_customer, forPrint)
  if (tab === 'struk_dapur') return kitchenPreviewHtml(layout.struk_dapur, forPrint)
  return qrPreviewHtml(layout.qr_surat_jalan, forPrint)
}

export default function PrinterSettingsView() {
  const { device, isConnecting, error } = usePrinterState()
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
        const { data } = await supabase.from('global_settings').select('value').eq('key', PRINT_LAYOUT_KEY).maybeSingle()
        setLayout(mergePrintLayout((data as any)?.value))
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
        await printBytes(buildTemplateReceipt(tab, layout))
      } else {
        await printHtmlFallback(previewHtml(tab, layout, true))
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
                  <Field label="Ukuran Font">
                    <div className="flex gap-3">
                      {(['normal', 'besar'] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setField(tab, 'fontScale', f)}
                          className={numBtn((layout[tab] as any).fontScale === f) + ' capitalize'}>{f}</button>
                      ))}
                    </div>
                  </Field>
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
                  srcDoc={previewHtml(tab, layout, false)} />
              </div>
              <button onClick={handleTestPrint} disabled={testing}
                className="w-full px-6 py-3 bg-suka-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                {testing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                {testing ? 'Mengirim...' : device ? 'Uji Cetak (Bluetooth)' : 'Uji Cetak (Browser)'}
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
```

- [ ] **Step 2: Hapus modul config lama (import-nya sudah tak dipakai view baru)**

```bash
git rm apps/admin-dashboard/src/lib/printer/printerConfig.ts apps/admin-dashboard/src/lib/printer/printerConfig.test.ts
```

- [ ] **Step 3: Type-check**

Run: `yarn type-check`
Expected: 0 error baru dari `PrinterSettingsView.tsx` / `printLayout.ts` / `buildTemplateReceipt.ts`, dan tak ada referensi sisa ke `printerConfig`. (Baseline pre-existing tak-terkait diabaikan.)

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/printer/PrinterSettingsView.tsx apps/admin-dashboard/src/lib/printer/printerConfig.ts apps/admin-dashboard/src/lib/printer/printerConfig.test.ts
git commit -m "feat(admin-dashboard): hub layout cetak 3 tab + hapus config generik lama"
```

---

## Task 5: Verifikasi Fase 1

- [ ] **Step 1:** `yarn vitest run src/lib/printer` → semua hijau (printLayout, buildTemplateReceipt).
- [ ] **Step 2:** `yarn type-check` → tak ada error baru dari file printer.
- [ ] **Step 3:** `yarn build` → sukses, route `/dashboard/printer` muncul.
- [ ] **Step 4: Commit sisa bila ada**

```bash
git add -A && git commit -m "chore(admin-dashboard): finalize hub layout cetak fase 1" || echo "nothing"
```

---

# FASE 2 — pos-kasir (Struk Customer + Dapur)

Working dir: `apps/pos-kasir`. Package manager: cek (`yarn` atau `npm`) via lockfile; contoh pakai `yarn`.

## Task 6: Reader `printLayout.ts` (pos-kasir) — TDD

**Files:**
- Create: `apps/pos-kasir/lib/printLayout.ts`
- Test: `apps/pos-kasir/lib/printLayout.test.ts`

- [ ] **Step 1: Tulis test yang gagal** (sama pola Task 2; hanya `struk_customer`/`struk_dapur` yang diverifikasi)

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('pos-kasir printLayout', () => {
  it('partial merge jatuh ke default', () => {
    const m = mergePrintLayout({ struk_customer: { showItemNotes: false } })
    expect(m.struk_customer.showItemNotes).toBe(false)
    expect(m.struk_customer.paperWidth).toBe(58)
    expect(m.struk_dapur).toEqual(DEFAULT_PRINT_LAYOUT.struk_dapur)
  })
  it('fetch error → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('x')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
```

- [ ] **Step 2: Jalankan → GAGAL.** Run: `yarn vitest run lib/printLayout.test.ts`

- [ ] **Step 3: Implementasi** — SALIN PERSIS isi `apps/admin-dashboard/src/lib/printer/printLayout.ts` dari Task 2 Step 3 (identik: types + DEFAULT_PRINT_LAYOUT + PRINT_LAYOUT_KEY + mergePrintLayout + fetchPrintLayout). Jaga nilai default identik.

- [ ] **Step 4: Jalankan → LULUS.**

> Jika pos-kasir belum punya vitest: cek `apps/pos-kasir/package.json`. Bila tak ada, tambahkan `"test": "vitest run"` + devDeps `vitest` (versi selaras admin-dashboard `^2.1.0`) + `vitest.config.ts` minimal (`environment: 'node'`). Jika menambah infra tes dianggap di luar scope oleh controller, laporkan sebagai DONE_WITH_CONCERNS dan pindahkan test ini ke admin-dashboard-style manual — tapi default: tambahkan vitest.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-kasir/lib/printLayout.ts apps/pos-kasir/lib/printLayout.test.ts
git commit -m "feat(pos-kasir): reader printLayout (global_settings, merge+fallback)"
```

---

## Task 7: Parametrisasi `buildReceiptHtml` dengan layout — TDD

**Files:**
- Modify: `apps/pos-kasir/lib/printReceipt.ts`
- Test: `apps/pos-kasir/lib/printReceipt.test.ts`

Baca `printReceipt.ts` dulu. Ubah signature `buildReceiptHtml(d, origin, layout?)` di mana `layout` = `CustomerLayout | KitchenLayout` yang relevan; default ambil dari `DEFAULT_PRINT_LAYOUT`. Terapkan: `paperWidth` (ganti konstanta `PAPER_WIDTH_MM`), `showLogo` (sembunyikan `<img class=logo>`), `headerText` (override nama outlet bila non-kosong), `footerText`, `fontScale` (skala ukuran font), `showCashier`, `showCustomer`, `showItemNotes` (untuk customer). Pertahankan render extra-topping (`isChild` → `EXTRA <nama>`).

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { buildReceiptHtml, type ReceiptData } from './printReceipt'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'

const base: ReceiptData = {
  outletName: 'OUTLET X', orderNumber: 7, dateISO: '2026-07-15T10:00:00Z',
  customerName: 'Budi', items: [
    { name: 'Shawarma', quantity: 1, unit_price: 25000, subtotal: 25000, note: 'pedas' },
    { name: 'Keju', quantity: 1, unit_price: 5000, subtotal: 5000, isChild: true },
  ],
  subtotal: 30000, discount: 0, total: 30000, paymentMethod: 'cash',
  amountReceived: 50000, changeAmount: 20000, cashierName: 'Sari', receiptType: 'customer',
}

describe('buildReceiptHtml layout', () => {
  it('default: catatan, kasir, extra topping tampil', () => {
    const html = buildReceiptHtml(base, '', DEFAULT_PRINT_LAYOUT.struk_customer)
    expect(html).toContain('pedas')
    expect(html).toContain('Kasir: Sari')
    expect(html).toContain('EXTRA Keju')
  })
  it('showItemNotes:false menyembunyikan catatan', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, showItemNotes: false })
    expect(html).not.toContain('pedas')
  })
  it('showCashier:false menyembunyikan baris kasir', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, showCashier: false })
    expect(html).not.toContain('Kasir: Sari')
  })
  it('paperWidth 80 → @page 80mm', () => {
    const html = buildReceiptHtml(base, '', { ...DEFAULT_PRINT_LAYOUT.struk_customer, paperWidth: 80 })
    expect(html).toContain('80mm')
  })
})
```

- [ ] **Step 2: Jalankan → GAGAL** (signature belum terima layout / test import). Run: `yarn vitest run lib/printReceipt.test.ts`

- [ ] **Step 3: Implementasi** — modifikasi `buildReceiptHtml`:
  - Tambah import: `import { DEFAULT_PRINT_LAYOUT, type CustomerLayout, type KitchenLayout } from './printLayout'`
  - Signature: `export function buildReceiptHtml(d: ReceiptData, origin = '', layout: CustomerLayout | KitchenLayout = d.receiptType === 'kitchen' ? DEFAULT_PRINT_LAYOUT.struk_dapur : DEFAULT_PRINT_LAYOUT.struk_customer): string`
  - Ganti `const PAPER_WIDTH_MM = 58` (module const) → gunakan `layout.paperWidth` di dalam fungsi (variabel lokal `const paperWidth = layout.paperWidth`). Perbarui semua referensi `PAPER_WIDTH_MM` di dalam fungsi.
  - `isKitchen` tetap dari `d.receiptType`. Font sizing: definisikan `const scale = layout.fontScale === 'besar' ? 1.3 : 1` dan kalikan ukuran px basis (mis. body `${Math.round((isKitchen?22:14)*scale)}px`, dst untuk `.lg`, `td.qty`, `td.name`, `.muted`, `.note`).
  - Logo: bungkus `<img class=logo>` dengan `${layout.showLogo ? '<img .../>' : ''}`.
  - Header: `const header = ('headerText' in layout && layout.headerText) ? layout.headerText : (d.outletName || 'SUKA SHAWARMA')`.
  - Footer (customer): pakai `('footerText' in layout ? layout.footerText : 'Terima kasih & selamat menikmati!')`.
  - Kasir: `${(!isKitchen && d.cashierName && (layout as CustomerLayout).showCashier) ? '<div ...>Kasir: ...</div>' : ''}`.
  - Pelanggan: gunakan `layout.showCustomer` (ada di kedua tipe).
  - Catatan item: bungkus `noteHtml` dengan cek `(!isKitchen && (layout as CustomerLayout).showItemNotes)` untuk customer; dapur ikut aturan sekarang.
  - `@page size`: tetap dihitung dinamis (tinggi), ganti lebar ke `paperWidth`.

  (Tulis kode lengkapnya berdasarkan file existing; jaga sisa struktur tak berubah.)

- [ ] **Step 4: Jalankan → LULUS.** Run: `yarn vitest run lib/printReceipt.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/pos-kasir/lib/printReceipt.ts apps/pos-kasir/lib/printLayout.test.ts apps/pos-kasir/lib/printReceipt.test.ts
git commit -m "feat(pos-kasir): buildReceiptHtml hormati layout terpusat (TDD)"
```

---

## Task 8: `printReceipt` & jalur Bluetooth ambil layout

**Files:**
- Modify: `apps/pos-kasir/lib/printReceipt.ts` (fungsi `printReceipt` + `fallbackPrint`)
- Modify: `apps/pos-kasir/lib/bluetooth-printer.ts` (fungsi `printViaBluetooth`)

Tujuan: call site (7 tempat) TIDAK berubah — `printReceipt(data)` fetch layout sendiri lalu teruskan ke jalur Bluetooth & fallback HTML.

- [ ] **Step 1: `printReceipt` fetch layout**
  - Import: `import { createClient } from '@/lib/supabase/client'` dan `import { fetchPrintLayout, DEFAULT_PRINT_LAYOUT } from './printLayout'`.
  - Di awal `printReceipt(data)`: `const layout = await fetchPrintLayout(createClient()).catch(() => DEFAULT_PRINT_LAYOUT)`. Pilih `const tpl = data.receiptType === 'kitchen' ? layout.struk_dapur : layout.struk_customer`.
  - Jalur Bluetooth: `printViaBluetooth(data, tpl)`. Jalur fallback: `fallbackPrint(data, resolve, tpl)` → panggil `buildReceiptHtml(dataWithBase64, origin, tpl)`.
  - Karena `printReceipt` sudah `Promise`, `await` fetch aman.

- [ ] **Step 2: `printViaBluetooth(data, layout)`** — terima param `layout: CustomerLayout | KitchenLayout`. Terapkan ke escpos:
  - `const width = layout.paperWidth === 80 ? 48 : 32` untuk `hr`/`row`.
  - `size(false, layout.fontScale === 'besar')` untuk baris judul/total (customer); dapur tetap besar.
  - Header: `layout.headerText || data.outletName`.
  - Toggle `showCashier`/`showCustomer`/`showItemNotes` (customer) & `showCustomer` (dapur).
  - Footer customer: `layout.footerText`.
  - Default param = `DEFAULT_PRINT_LAYOUT.struk_customer` agar pemanggil lama tetap kompilasi.

- [ ] **Step 3: Type-check** — Run: `yarn type-check` (atau `tsc --noEmit`). Expected: 0 error baru.

- [ ] **Step 4: Test regresi** — `yarn vitest run lib/printReceipt.test.ts` tetap hijau.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-kasir/lib/printReceipt.ts apps/pos-kasir/lib/bluetooth-printer.ts
git commit -m "feat(pos-kasir): printReceipt & jalur Bluetooth pakai layout terpusat (fallback aman)"
```

---

## Task 9: Verifikasi Fase 2

- [ ] **Step 1:** `yarn vitest run` (pos-kasir) → test printReceipt/printLayout hijau.
- [ ] **Step 2:** `yarn type-check` → tak ada error baru.
- [ ] **Step 3:** `yarn build` (pos-kasir) → sukses.

---

# FASE 3 — distribusi (QR / Surat Jalan)

Working dir: `apps/distribusi`

## Task 10: Reader `printLayout.ts` (distribusi) — TDD

**Files:**
- Create: `apps/distribusi/src/utils/printLayout.ts`
- Test: `apps/distribusi/src/utils/printLayout.test.ts`

- [ ] **Step 1: Test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('distribusi printLayout', () => {
  it('override qrSizeMm', () => {
    expect(mergePrintLayout({ qr_surat_jalan: { qrSizeMm: 60 } }).qr_surat_jalan.qrSizeMm).toBe(60)
  })
  it('fetch error → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('x')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
```

- [ ] **Step 2: Jalankan → GAGAL.** Run: `./node_modules/.bin/vitest run src/utils/printLayout.test.ts` (npx rusak di repo ini — pakai binari langsung; lihat memory absensi). Bila distribusi tak punya vitest, tambahkan seperti catatan Task 6.

- [ ] **Step 3: Implementasi** — SALIN PERSIS `printLayout.ts` dari Task 2 (identik). Jaga default identik.

- [ ] **Step 4: Jalankan → LULUS.**

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/utils/printLayout.ts apps/distribusi/src/utils/printLayout.test.ts
git commit -m "feat(distribusi): reader printLayout (global_settings, merge+fallback)"
```

---

## Task 11: `printBarcode` hormati layout — TDD (ekstrak builder murni)

**Files:**
- Modify: `apps/distribusi/src/utils/generatePDF.ts` (fungsi `printBarcode`)
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanList.tsx` (`handlePrintBarcode`)
- Test: `apps/distribusi/src/utils/barcodeHtml.test.ts`

- [ ] **Step 1: Ekstrak builder HTML murni + test gagal**

Di `generatePDF.ts`, ekstrak string HTML `printBarcode` jadi fungsi murni yang bisa diuji:

```ts
import { DEFAULT_PRINT_LAYOUT, type QrLayout } from './printLayout'

export function buildBarcodeHtml(docNumber: string, dataUrl: string, layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan): string {
  const footer = layout.footerText.split('\n').map((l) => l).join('<br/>')
  const logo = layout.showLogo ? `<div class="logo">SUKA</div>` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print QR - ${docNumber}</title><style>
    @page { margin: 0mm; } @media print { @page { margin: 0mm; } }
    * { box-sizing: border-box; } html, body { background:#fff; margin:0; padding:0; }
    body { width:${layout.paperWidth}mm; padding:8px 4px; font-family:'Courier New',monospace; color:#000; text-align:center; }
    .logo { font-size:11px; font-weight:900; margin-bottom:4px; }
    .title { font-size:16px; font-weight:900; margin-bottom:2px; text-transform:uppercase; }
    .subtitle { font-size:13px; font-weight:900; margin-bottom:8px; text-decoration:underline; }
    img { width:${layout.qrSizeMm}mm; height:${layout.qrSizeMm}mm; display:block; margin:0 auto; }
    .footer { margin-top:10px; font-size:10px; font-weight:900; border-top:1px dashed #000; padding-top:6px; }
  </style></head><body>
    ${logo}
    <div class="title">${layout.title}</div>
    <div class="subtitle">${docNumber}</div>
    <img src="${dataUrl}" alt="QR Code" />
    <div class="footer">${footer}</div>
  </body></html>`
}
```

Test:

```ts
import { describe, it, expect } from 'vitest'
import { buildBarcodeHtml } from './generatePDF'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'

describe('buildBarcodeHtml', () => {
  it('default: judul & footer sekarang', () => {
    const html = buildBarcodeHtml('SJ-001', 'data:img', DEFAULT_PRINT_LAYOUT.qr_surat_jalan)
    expect(html).toContain('VERIFIKASI SJ')
    expect(html).toContain('Distribusi')
    expect(html).toContain('45mm')
  })
  it('override judul/qr/paper', () => {
    const html = buildBarcodeHtml('SJ-002', 'data:img', { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, title: 'CEK SJ', qrSizeMm: 60, paperWidth: 80 })
    expect(html).toContain('CEK SJ')
    expect(html).toContain('60mm')
    expect(html).toContain('80mm')
  })
})
```

- [ ] **Step 2: Jalankan → GAGAL.** Run: `./node_modules/.bin/vitest run src/utils/barcodeHtml.test.ts`

- [ ] **Step 3: Implementasi** — di `printBarcode(docNumber, dataUrl, layout?)`:
  - Signature: `export function printBarcode(docNumber: string, dataUrl: string, layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan)`.
  - Ganti string HTML inline dengan `const html = buildBarcodeHtml(docNumber, dataUrl, layout)`.
  - `const PAPER_WIDTH_MM = layout.paperWidth` untuk perhitungan `applyPageSize`.
  - Sisa logika iframe/print tak berubah.

- [ ] **Step 4: Wire caller** — `SuratJalanList.tsx handlePrintBarcode`:
  - Import `fetchPrintLayout` dari `@/utils/printLayout` dan `createSupabaseBrowserClient` sudah ada.
  - Ambil layout sebelum print: `const layout = await fetchPrintLayout(createSupabaseBrowserClient())` lalu `printBarcode(docNumber, dataUrl, layout.qr_surat_jalan)`.

- [ ] **Step 5: Jalankan → LULUS** + `type-check`.

- [ ] **Step 6: Commit**

```bash
git add apps/distribusi/src/utils/generatePDF.ts apps/distribusi/src/utils/barcodeHtml.test.ts apps/distribusi/src/components/distribusi/SuratJalanList.tsx
git commit -m "feat(distribusi): print QR hormati layout terpusat (TDD)"
```

---

## Task 12: Verifikasi Fase 3 + akhir

- [ ] **Step 1:** distribusi: `./node_modules/.bin/vitest run src/utils` hijau; `type-check`; `build` sukses.
- [ ] **Step 2: Smoke test manual (dicatat):**
  - admin `/dashboard/printer`: ubah Struk Customer paperWidth 80 + footer, Simpan; reload → tetap; Uji Cetak (Browser) → dialog print.
  - Struk Dapur & QR tab: preview berubah sesuai knob.
- [ ] **Step 3: Catatan push DB (manusia):** `supabase db push` migration `20260715120000` (verifikasi baris `print_layout` di `global_settings` via `supabase db query "select key from global_settings where key='print_layout'" --linked`). App tetap jalan tanpa ini (fallback).
- [ ] **Step 4: Catatan redeploy (manusia):** redeploy `admin-dashboard`, `pos-kasir`, `distribusi` agar efek penuh live.

---

## Catatan Self-Review

- **Spec coverage:** DB global_settings key print_layout (Task 1) ✓; reader+merge+fallback tiap app (Task 2/6/10) ✓; hub 3 tab + preview + extra-topping di customer + save + uji cetak (Task 3/4) ✓; pos-kasir customer+dapur wiring (Task 7/8) ✓; distribusi QR wiring (Task 11) ✓; scope global ✓; fallback aman default=perilaku sekarang (Task 7/8/11 default param) ✓; koneksi Bluetooth tetap device-local (Task 4 pertahankan kartu) ✓.
- **Konsistensi tipe:** `PrintLayout`/`CustomerLayout`/`KitchenLayout`/`QrLayout` + `DEFAULT_PRINT_LAYOUT` + `mergePrintLayout` + `fetchPrintLayout` identik di 3 app (Task 2 kanonik, Task 6/10 salin persis). `buildReceiptHtml(d, origin, layout)` & `printViaBluetooth(data, layout)` & `printBarcode(doc, url, layout)` konsisten dengan pemanggil.
- **Risiko dikelola:** semua perubahan konsumen backward-compatible via default param = nilai sekarang; DB aditif; tak sentuh @suka/*.
- **Catatan:** distribusi/pos-kasir mungkin perlu setup vitest (Task 6/10 note). Jika controller memutuskan skip infra tes di app itu, reader tetap dipakai; test dipindah ke verifikasi manual.
