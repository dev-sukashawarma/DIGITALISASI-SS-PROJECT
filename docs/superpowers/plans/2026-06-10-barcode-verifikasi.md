# QR Scan + Card Verifikasi Penerimaan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crew scan QR code dari Surat Jalan fisik → verifikasi penerimaan item satu per satu via kartu mobile-friendly → submit otomatis update ledger stok.

**Architecture:** QR code di-embed ke PDF via library `qrcode` (encode `document_number`). Halaman scan baru `/distribusi/terima/scan` pakai `BarcodeDetector` API native browser + fallback input manual. `VerifikasiForm` di-redesign jadi card-by-card stepper dengan tombol Baik/Jelek dan field catatan. Submit tetap pakai RPC `finalize_surat_jalan_and_ledger()` yang ada.

**Tech Stack:** Next.js 16, React 19, Supabase JS, Tailwind CSS 3, `qrcode` npm package, `BarcodeDetector` Web API

---

## File Map

| File | Status | Tanggung Jawab |
|------|--------|----------------|
| `supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql` | Baru | Tambah kolom `catatan TEXT` ke `surat_jalan_item` |
| `apps/distribusi/src/utils/generatePDF.ts` | Modifikasi | Embed QR code PNG di header PDF |
| `apps/distribusi/src/components/distribusi/QRScanner.tsx` | Baru | Komponen kamera + `BarcodeDetector` + fallback input |
| `apps/distribusi/src/app/distribusi/terima/scan/page.tsx` | Baru | Page wrapper untuk QRScanner |
| `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` | Redesign | Card-by-card stepper dengan state Baik/Jelek/catatan |
| `apps/distribusi/src/components/distribusi/TerimaList.tsx` | Modifikasi | Tambah tombol "Scan QR" di atas tabel |

---

## Task 1: Migration — tambah kolom `catatan` ke `surat_jalan_item`

**Files:**
- Create: `supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql`

- [ ] **Step 1: Buat migration file**

```sql
-- Add catatan column to surat_jalan_item for crew rejection notes
ALTER TABLE surat_jalan_item ADD COLUMN IF NOT EXISTS catatan TEXT;
```

Simpan ke `supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql`

- [ ] **Step 2: Apply migration ke Supabase**

Jalankan SQL di Supabase Dashboard → SQL Editor, atau:
```bash
npx supabase db push
```

Verifikasi: query `SELECT column_name FROM information_schema.columns WHERE table_name = 'surat_jalan_item' AND column_name = 'catatan';` harus return 1 row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610001100_add_catatan_to_surat_jalan_item.sql
git commit -m "feat(m3): add catatan column to surat_jalan_item for rejection notes"
```

---

## Task 2: Install `qrcode` dan embed QR ke PDF

**Files:**
- Modify: `apps/distribusi/package.json`
- Modify: `apps/distribusi/src/utils/generatePDF.ts`

- [ ] **Step 1: Install package `qrcode`**

```bash
cd apps/distribusi
npm install qrcode
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Update `generatePDF.ts` — tambah parameter `qrDataUrl` ke interface dan function**

Ganti seluruh isi `apps/distribusi/src/utils/generatePDF.ts`:

```typescript
import QRCode from 'qrcode'

interface SuratJalanData {
  id: string
  document_number: string
  outlet_name: string
  sender_outlet: string
  status: string
  created_at: string
  items: Array<{
    nama: string
    satuan: string
    qty_dikirim: number
  }>
  signatures: Array<{
    signed_by: string
    role: string
    signed_at: string
    signature_image?: string
  }>
}

const SIGNATURE_CELL_HEIGHT = '80px'
const SIGNATURE_IMAGE_MAX_HEIGHT = '70px'
const SIGNATURE_IMAGE_STYLE = `max-height: ${SIGNATURE_IMAGE_MAX_HEIGHT}; max-width: 100%; display: block; margin: 0 auto;`
const SIGNATURE_PLACEHOLDER_STYLE = `height: 70px; border-bottom: 2px solid #000;`

export async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 80, margin: 1 })
}

export async function generatePDFContent(data: SuratJalanData): Promise<string> {
  const qrDataUrl = await generateQRDataUrl(data.document_number)
  const createdDate = new Date(data.created_at).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const itemRows = data.items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #000; padding: 8px;">${item.nama}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty_dikirim}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.satuan}</td>
    </tr>
  `
    )
    .join('')

  const signatureRows = data.signatures
    .map(
      (sig) => `
    <tr>
      <td style="padding: 8px; text-align: center; height: ${SIGNATURE_CELL_HEIGHT};">
        ${
          sig.signature_image
            ? `<img src="${sig.signature_image}" style="${SIGNATURE_IMAGE_STYLE}" />`
            : `<div style="${SIGNATURE_PLACEHOLDER_STYLE}"></div>`
        }
      </td>
      <td style="padding: 8px; text-align: center;">${sig.signed_by}</td>
      <td style="padding: 8px; text-align: center;">${sig.role}</td>
      <td style="padding: 8px; text-align: center;">${new Date(sig.signed_at).toLocaleDateString('id-ID')}</td>
    </tr>
  `
    )
    .join('')

  const missingSigImages = data.signatures.filter((sig) => !sig.signature_image)
  const sigImageWarning =
    missingSigImages.length > 0
      ? `\n  <!-- WARNING: ${missingSigImages.length} signature(s) missing image data: ${missingSigImages.map((s) => s.signed_by).join(', ')} -->`
      : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Surat Jalan - ${data.outlet_name}</title>${sigImageWarning}
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .header-text { text-align: center; flex: 1; }
    .header-text h1 { margin: 0; font-size: 24px; }
    .header-text p { margin: 5px 0; }
    .qr-block { text-align: center; }
    .qr-block p { font-size: 10px; color: #666; margin: 4px 0 0; }
    .info { margin: 20px 0; }
    .info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background-color: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: left; }
    .signature-section { margin-top: 40px; }
    .signature-table { width: 100%; }
    .signature-table td { padding: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-text">
      <h1>SURAT JALAN</h1>
      <p style="font-size: 16px; margin: 10px 0;">${data.document_number}</p>
    </div>
    <div class="qr-block">
      <img src="${qrDataUrl}" width="80" height="80" alt="QR Code" />
      <p>${data.document_number}</p>
    </div>
  </div>

  <div class="info">
    <p><strong>Dikirim dari:</strong> ${data.sender_outlet}</p>
    <p><strong>ke Outlet:</strong> ${data.outlet_name}</p>
    <p><strong>Tanggal:</strong> ${createdDate}</p>
    <p><strong>Status:</strong> ${data.status}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Barang</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: center;">Satuan</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="signature-section">
    <p><strong>Tanda Tangan Pengesahan:</strong></p>
    <table class="signature-table">
      <tr>
        <th>Tanda Tangan</th>
        <th>Nama</th>
        <th>Jabatan</th>
        <th>Tanggal</th>
      </tr>
      ${signatureRows}
    </table>
  </div>

  <p style="margin-top: 30px; font-size: 12px; color: #666;">
    Dokumen ini dicetak otomatis dari sistem Sukashawarma
  </p>
</body>
</html>
  `.trim()
}

export function downloadPDF(filename: string, htmlContent: string) {
  const element = document.createElement('a')
  element.setAttribute(
    'href',
    'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
  )
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
```

- [ ] **Step 3: Update semua pemanggil `generatePDFContent` jadi async**

Cari semua file yang memanggil `generatePDFContent(`:

```bash
grep -rn "generatePDFContent" apps/distribusi/src/
```

Untuk setiap pemanggil, tambah `await` di depan dan pastikan fungsi parent jadi `async`. Contoh di `SuratJalanDetail.tsx`:

```typescript
// Sebelum
const html = generatePDFContent(data)
// Sesudah
const html = await generatePDFContent(data)
```

- [ ] **Step 4: Build check**

```bash
cd apps/distribusi
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/package.json apps/distribusi/package-lock.json apps/distribusi/src/utils/generatePDF.ts
git commit -m "feat(m3): embed QR code in Surat Jalan PDF"
```

---

## Task 3: Komponen `QRScanner`

**Files:**
- Create: `apps/distribusi/src/components/distribusi/QRScanner.tsx`

- [ ] **Step 1: Buat komponen QRScanner**

```typescript
// apps/distribusi/src/components/distribusi/QRScanner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function QRScanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const animFrameRef = useRef<number | null>(null)

  const navigateToVerifikasi = async (documentNumber: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('surat_jalan')
      .select('id, status')
      .eq('document_number', documentNumber)
      .single()

    if (error || !data) {
      setError(`Surat Jalan "${documentNumber}" tidak ditemukan`)
      return
    }
    if (data.status === 'diterima') {
      setError('Surat Jalan ini sudah diterima sebelumnya')
      return
    }
    stopCamera()
    router.push(`/distribusi/terima/${data.id}`)
  }

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
      setCameraAvailable(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // @ts-ignore — BarcodeDetector not in TS lib yet
      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
      setScanning(true)
      scanLoop()
    } catch {
      setCameraAvailable(false)
    }
  }

  const scanLoop = () => {
    if (!videoRef.current || !detectorRef.current) return
    detectorRef.current
      .detect(videoRef.current)
      .then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          navigateToVerifikasi(barcodes[0].rawValue)
        } else {
          animFrameRef.current = requestAnimationFrame(scanLoop)
        }
      })
      .catch(() => {
        animFrameRef.current = requestAnimationFrame(scanLoop)
      })
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    setError(null)
    navigateToVerifikasi(manualInput.trim())
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Scan QR Surat Jalan</h1>
      <p className="text-gray-500 text-sm mb-6">
        Arahkan kamera ke QR code di Surat Jalan fisik
      </p>

      {cameraAvailable ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 mb-6 bg-black aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 mb-6 p-8 text-center bg-gray-50">
          <p className="text-gray-500 text-sm">Kamera tidak tersedia di browser ini</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="space-y-3">
        <p className="text-sm text-gray-600 font-medium">Atau masukkan nomor manual:</p>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="SJ/KITCHEN/20260610/001"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700"
        >
          Cari Surat Jalan
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Buat page wrapper**

```typescript
// apps/distribusi/src/app/distribusi/terima/scan/page.tsx
import { QRScanner } from '@/components/distribusi/QRScanner'

export default function ScanPage() {
  return <QRScanner />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/QRScanner.tsx \
        apps/distribusi/src/app/distribusi/terima/scan/page.tsx
git commit -m "feat(m3): add QR scanner page for surat jalan lookup"
```

---

## Task 4: Redesign `VerifikasiForm` — card-by-card stepper

**Files:**
- Modify: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx`

- [ ] **Step 1: Ganti seluruh isi `VerifikasiForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

type Kondisi = 'baik' | 'jelek'

type ItemVerification = {
  qty_terima: number
  kondisi: Kondisi
  catatan: string
}

type Step = 'cards' | 'summary'

export function VerifikasiForm({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [verifications, setVerifications] = useState<Record<string, ItemVerification>>({})
  const [step, setStep] = useState<Step>('cards')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>
  if (error || !data) return <p className="p-6 text-red-600">Gagal memuat: {error}</p>

  const items = data.surat_jalan_item
  const currentItem = items[currentIndex]
  const currentVerif = verifications[currentItem?.id] ?? {
    qty_terima: currentItem?.qty_dikirim ?? 0,
    kondisi: 'baik' as Kondisi,
    catatan: '',
  }
  const progress = Math.round((currentIndex / items.length) * 100)
  const jelekItems = Object.entries(verifications).filter(([, v]) => v.kondisi === 'jelek')

  const setVerif = (patch: Partial<ItemVerification>) => {
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, ...patch },
    }))
  }

  const confirmItem = (v: ItemVerification) => {
    setVerifications((prev) => ({ ...prev, [currentItem.id]: v }))
    if (currentIndex + 1 >= items.length) {
      setStep('summary')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleBaik = () => {
    confirmItem({
      qty_terima: currentItem.qty_dikirim,
      kondisi: 'baik',
      catatan: '',
    })
  }

  const handleJelekConfirm = () => {
    if (currentVerif.kondisi === 'jelek' && !currentVerif.catatan.trim()) {
      alert('Wajib isi catatan untuk item yang jelek')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim) {
      alert('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    confirmItem(currentVerif)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createClient()
    try {
      const updatePromises = items.map((item) => {
        const v = verifications[item.id]
        return supabase
          .from('surat_jalan_item')
          .update({
            qty_terima: v.qty_terima,
            kondisi: v.kondisi === 'jelek' ? 'rusak' : 'baik',
            catatan: v.catatan || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      })

      const results = await Promise.all(updatePromises)
      const errors = results.filter(({ error }) => error)
      if (errors.length > 0) throw new Error(errors[0].error?.message)

      const { error: rpcError } = await supabase.rpc('finalize_surat_jalan_and_ledger', {
        p_surat_jalan_id: id,
      })
      if (rpcError) throw new Error(rpcError.message)

      router.push('/distribusi/terima')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menyimpan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'summary') {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1">Ringkasan Verifikasi</h1>
        <p className="text-gray-500 text-sm mb-6">{items.length} item selesai dikonfirmasi</p>

        <div className="bg-white rounded-xl border border-gray-200 divide-y mb-4">
          {items.map((item) => {
            const v = verifications[item.id]
            const isJelek = v?.kondisi === 'jelek'
            return (
              <div key={item.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{item.bahan_baku?.nama}</p>
                  {isJelek && v.catatan && (
                    <p className="text-xs text-red-600 mt-0.5">{v.catatan}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isJelek
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}
                >
                  {isJelek ? `Jelek · ${v.qty_terima}/${item.qty_dikirim} ${item.bahan_baku?.satuan}` : `Baik · ${v.qty_terima} ${item.bahan_baku?.satuan}`}
                </span>
              </div>
            )
          })}
        </div>

        {jelekItems.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
            {jelekItems.length} item bermasalah — concern tercatat di catatan
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan...' : 'Selesai & Simpan Verifikasi'}
        </button>
        <button
          onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
          className="w-full mt-2 border border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50"
        >
          Kembali ke item terakhir
        </button>
      </div>
    )
  }

  // Card step
  const isJelekMode = currentVerif.kondisi === 'jelek'

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/distribusi/terima" className="text-blue-600 text-sm hover:underline">
          ← Kembali
        </Link>
        <span className="text-sm text-gray-500 font-medium">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
          {currentItem.bahan_baku?.kategori}
        </p>
        <h2 className="text-xl font-semibold mb-4">{currentItem.bahan_baku?.nama}</h2>

        <div className="flex items-end gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Dikirim</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-lg font-medium text-gray-500 min-w-[72px] text-center">
              {currentItem.qty_dikirim} {currentItem.bahan_baku?.satuan}
            </div>
          </div>
          <span className="text-gray-300 text-xl pb-2">→</span>
          <div>
            <p className="text-xs text-gray-500 mb-1">Diterima</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={currentItem.qty_dikirim}
                value={currentVerif.qty_terima}
                onChange={(e) => setVerif({ qty_terima: parseInt(e.target.value) || 0, kondisi: 'jelek' })}
                className={`border rounded-lg px-3 py-2 text-lg font-medium text-center w-20 ${
                  isJelekMode ? 'border-red-400' : 'border-green-400'
                }`}
              />
              <span className="text-sm text-gray-500">{currentItem.bahan_baku?.satuan}</span>
            </div>
          </div>
        </div>

        {isJelekMode && (
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Catatan / concern (wajib)</label>
            <textarea
              value={currentVerif.catatan}
              onChange={(e) => setVerif({ catatan: e.target.value })}
              placeholder="Contoh: 2 kg busuk, kondisi kemasan rusak..."
              rows={2}
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-red-50 resize-none"
            />
          </div>
        )}
      </div>

      {!isJelekMode ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleBaik}
            className="bg-green-600 text-white rounded-xl py-3 font-medium hover:bg-green-700 flex items-center justify-center gap-2"
          >
            ✓ Baik
          </button>
          <button
            onClick={() => setVerif({ kondisi: 'jelek', qty_terima: currentItem.qty_dikirim })}
            className="border border-red-400 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50 flex items-center justify-center gap-2"
          >
            ✗ Jelek
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setVerif({ kondisi: 'baik', qty_terima: currentItem.qty_dikirim, catatan: '' })}
            className="border border-gray-300 text-gray-600 rounded-xl py-3 font-medium hover:bg-gray-50"
          >
            ← Batalkan
          </button>
          <button
            onClick={handleJelekConfirm}
            className="bg-red-600 text-white rounded-xl py-3 font-medium hover:bg-red-700"
          >
            Konfirmasi Jelek →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/distribusi
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/VerifikasiForm.tsx
git commit -m "feat(m3): redesign VerifikasiForm as card-by-card stepper with Baik/Jelek flow"
```

---

## Task 5: Tambah tombol "Scan QR" di TerimaList

**Files:**
- Modify: `apps/distribusi/src/components/distribusi/TerimaList.tsx`

- [ ] **Step 1: Update `TerimaList.tsx` — tambah tombol Scan QR di header**

Ganti baris `<h1 className="text-3xl font-bold mb-6">Penerimaan Barang</h1>` dengan:

```typescript
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Penerimaan Barang</h1>
        <Link
          href="/distribusi/terima/scan"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
        >
          <span>📷</span> Scan QR
        </Link>
      </div>
```

Pastikan `Link` sudah di-import dari `'next/link'` (sudah ada).

- [ ] **Step 2: Commit**

```bash
git add apps/distribusi/src/components/distribusi/TerimaList.tsx
git commit -m "feat(m3): add Scan QR button to TerimaList page"
```

---

## Task 6: Manual test end-to-end di tablet

- [ ] **Step 1: Jalankan dev server dengan binding ke semua interface**

```bash
cd apps/distribusi
npx next dev -p 3002 -H 0.0.0.0
```

Akses dari tablet: `http://192.168.1.7:3002`

- [ ] **Step 2: Test happy path**
  1. Buka SJ yang sudah berstatus `dikirim` → buka detail → download PDF
  2. Verifikasi QR code muncul di pojok kanan atas PDF
  3. Buka `/distribusi/terima/scan` di tablet
  4. Scan QR dari PDF → pastikan redirect ke form verifikasi yang benar
  5. Test input manual dengan nomor dokumen yang benar → pastikan redirect
  6. Di VerifikasiForm: klik Baik untuk semua item → cek summary → submit
  7. Verifikasi ledger entry terbuat di `/stok/ledger`

- [ ] **Step 3: Test edge cases**
  1. Scan QR dari SJ yang sudah `diterima` → harus muncul pesan error, bukan redirect
  2. Input manual nomor yang tidak ada → harus muncul pesan error
  3. Klik Jelek tanpa isi catatan → harus ada alert wajib isi catatan
  4. Set qty terima > qty dikirim → harus ada alert
  5. Kembali dari summary ke item terakhir → pastikan state tidak reset

- [ ] **Step 4: Final commit jika ada perbaikan dari hasil test**

```bash
git add -p
git commit -m "fix(m3): fix issues found during tablet UAT"
```
