# TТД Penerimaan, Riwayat & View Pengiriman — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan tanda tangan serah-terima (Crew Penerima + Supir) di alur penerimaan distribusi, halaman Riwayat untuk SJ yang sudah diterima, dan view Pengiriman lintas-outlet untuk SPV Pusat.

**Architecture:** Kolom JSONB baru `receipt_signatures` + RPC `sign_receipt_surat_jalan` (pola sama dgn `sign_surat_jalan` yang sudah teruji). `finalize_surat_jalan_and_ledger` tidak diubah; finalize hanya dipanggil setelah 2 TТД lengkap (Pendekatan 2). Isolasi outlet sudah ditangani di frontend (RLS `surat_jalan` mengizinkan SELECT semua) — view lintas-outlet cukup tidak menerapkan filter, dan akses dibatasi via cek role di komponen.

**Tech Stack:** Supabase (Postgres + RPC plpgsql), Next.js App Router, React client components, TailwindCSS. Tidak ada unit-test harness di apps; verifikasi via SQL (Supabase SQL Editor) + manual browser sesuai konvensi `docs/E2E-RUNBOOK.md`.

---

## File Structure

**Buat:**
- `supabase/migrations/20260611000100_add_receipt_signatures.sql` — kolom + RPC TТД penerimaan
- `apps/distribusi/src/components/distribusi/ReceiptSignatureStep.tsx` — step TТД penerima (reuse `SignatureCanvas`)
- `apps/distribusi/src/hooks/useRiwayatList.ts` — daftar SJ diterima (outlet sendiri)
- `apps/distribusi/src/components/distribusi/RiwayatList.tsx` — UI daftar riwayat
- `apps/distribusi/src/app/distribusi/riwayat/page.tsx` — route riwayat
- `apps/distribusi/src/components/distribusi/RiwayatDetail.tsx` — detail read-only SJ diterima (item + semua TТД)
- `apps/distribusi/src/app/distribusi/riwayat/[id]/page.tsx` — route detail riwayat
- `apps/distribusi/src/hooks/usePengirimanList.ts` — daftar SJ lintas-outlet
- `apps/distribusi/src/components/distribusi/PengirimanList.tsx` — UI + role guard SPV Pusat
- `apps/distribusi/src/app/distribusi/pengiriman/page.tsx` — route pengiriman

**Modifikasi:**
- `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` — sisipkan step `signature` sebelum finalize
- `apps/distribusi/src/hooks/useSuratJalanDetail.ts` — sertakan `receipt_signatures` di select
- `apps/distribusi/src/app/dashboard/page.tsx` — menu navigasi per-role

---

## Task 1: Migration — kolom `receipt_signatures` + RPC `sign_receipt_surat_jalan`

**Files:**
- Create: `supabase/migrations/20260611000100_add_receipt_signatures.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- Tanda tangan serah-terima di sisi penerima (outlet tujuan).
-- Terpisah dari `signatures` (yang dipakai sisi pengirim saat draft).
-- Menyimpan array {signed_by, role, signed_at, signature_image}.

alter table surat_jalan
  add column if not exists receipt_signatures jsonb not null default '[]'::jsonb;

create or replace function sign_receipt_surat_jalan(
  p_surat_jalan_id uuid,
  p_signed_by_name text,
  p_role text,
  p_signature_image text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sj record;
  v_sigs jsonb;
begin
  select id, status, receipt_signatures into v_sj
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_sj.id is null then
    raise exception 'Surat jalan not found';
  end if;

  -- Hanya SJ yang sudah dikirim / sedang diterima yang boleh ditandatangani penerima.
  if v_sj.status not in ('dikirim', 'dikirim_lengkap', 'diterima_sebagian') then
    raise exception 'Surat jalan tidak dalam status penerimaan (status: %)', v_sj.status;
  end if;

  -- Hanya role penerima yang valid.
  if p_role not in ('Crew Penerima', 'Supir') then
    raise exception 'Role tidak valid untuk TTD penerimaan: %', p_role;
  end if;

  v_sigs := coalesce(v_sj.receipt_signatures, '[]'::jsonb);

  -- Cegah TTD ganda per role.
  if exists (
    select 1 from jsonb_array_elements(v_sigs) e
    where e->>'role' = p_role
  ) then
    raise exception '% sudah menandatangani penerimaan', p_role;
  end if;

  v_sigs := v_sigs || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now(),
      'signature_image', p_signature_image
    )
  );

  update surat_jalan
  set receipt_signatures = v_sigs
  where id = p_surat_jalan_id;

  return jsonb_build_object(
    'success', true,
    'receipt_signatures', v_sigs,
    'total', jsonb_array_length(v_sigs)
  );
end;
$$;
```

- [ ] **Step 2: Terapkan migration**

Jalankan isi file di **Supabase SQL Editor** (atau `supabase db push` jika CLI terkonfigurasi).
Expected: `ALTER TABLE` + `CREATE FUNCTION` sukses tanpa error.

- [ ] **Step 3: Verifikasi RPC via SQL**

Ambil satu `surat_jalan.id` berstatus `dikirim`/`dikirim_lengkap`, lalu:

```sql
-- Sukses: append TTD pertama
select sign_receipt_surat_jalan('<sj_id>', 'Andi Empang', 'Crew Penerima', null);
-- Tolak: role ganda
select sign_receipt_surat_jalan('<sj_id>', 'Andi Lagi', 'Crew Penerima', null);
-- Tolak: role invalid
select sign_receipt_surat_jalan('<sj_id>', 'X', 'Kitchen SPV', null);
```
Expected: panggilan pertama `success: true, total: 1`; kedua error "Crew Penerima sudah menandatangani penerimaan"; ketiga error "Role tidak valid...".

- [ ] **Step 4: Bersihkan data uji**

```sql
update surat_jalan set receipt_signatures = '[]'::jsonb where id = '<sj_id>';
```
Expected: 1 row updated.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000100_add_receipt_signatures.sql
git commit -m "feat(distribusi): add receipt_signatures column + sign_receipt RPC"
```

---

## Task 2: Komponen `ReceiptSignatureStep`

Step TТД penerima yang dipakai VerifikasiForm. Mengelola state TТД-nya sendiri, memanggil `sign_receipt_surat_jalan`, dan menampilkan tombol finalize yang aktif hanya setelah 2 role lengkap.

**Files:**
- Create: `apps/distribusi/src/components/distribusi/ReceiptSignatureStep.tsx`

- [ ] **Step 1: Tulis komponen**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { SignatureCanvas } from './SignatureCanvas'

interface ReceiptSignature {
  signed_by: string
  role: string
  signed_at: string
}

interface Props {
  suratJalanId: string
  submitting: boolean
  onFinalize: () => void
  onBack: () => void
}

const REQUIRED_ROLES = ['Crew Penerima', 'Supir'] as const
const MAX_SIGNATURE_SIZE = 50000 // 50KB, sama dgn pola pengirim

export function ReceiptSignatureStep({ suratJalanId, submitting, onFinalize, onBack }: Props) {
  const [signatures, setSignatures] = useState<ReceiptSignature[]>([])
  const [signedBy, setSignedBy] = useState('')
  const [role, setRole] = useState<typeof REQUIRED_ROLES[number]>('Crew Penerima')
  const [signatureImage, setSignatureImage] = useState('')
  const [showCanvas, setShowCanvas] = useState(false)
  const [signing, setSigning] = useState(false)

  const signedRoles = signatures.map((s) => s.role)
  const missingRoles = REQUIRED_ROLES.filter((r) => !signedRoles.includes(r))

  const handleSign = async () => {
    if (!signedBy.trim()) { alert('Nama penanda tangan harus diisi'); return }
    if (!signatureImage) { alert('Tanda tangan harus digambar terlebih dahulu'); return }
    if (signedRoles.includes(role)) { alert(`${role} sudah menandatangani.`); return }
    if (signatureImage.length > MAX_SIGNATURE_SIZE) {
      alert(`Tanda tangan terlalu besar (${(signatureImage.length / 1024).toFixed(1)}KB). Coba ulang.`)
      return
    }

    setSigning(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase.rpc('sign_receipt_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
        p_signature_image: signatureImage,
      })
      if (error) throw new Error(error.message)
      setSignatures(data.receipt_signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menandatangani'}`)
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex items-center gap-3 shadow-sm">
        <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-[#701604] tracking-tight">Tanda Tangan Penerimaan</h2>
          <p className="text-xs text-suka-brown/60 mt-0.5">Serah-terima Crew & Supir</p>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto mt-6 space-y-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 space-y-6 shadow-sm">
          {signatures.length > 0 && (
            <div className="bg-[#fff8f1] border border-suka-brown/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-suka-brown uppercase tracking-wider">
                Tanda tangan ({signatures.length}/2):
              </p>
              {signatures.map((s, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-suka-green" />
                  <span className="font-semibold">{s.signed_by}</span>
                  <span className="text-suka-brown/60 text-xs">({s.role})</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 border-t border-suka-brown/10 pt-4">
            <p className="text-sm font-bold text-suka-brown">Tambah Tanda Tangan</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Nama penanda tangan"
                className="bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof REQUIRED_ROLES[number])}
                className="bg-[#fff8f1] border border-suka-brown/15 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="Crew Penerima" disabled={signedRoles.includes('Crew Penerima')}>
                  {signedRoles.includes('Crew Penerima') ? 'Crew Penerima ✓' : 'Crew Penerima'}
                </option>
                <option value="Supir" disabled={signedRoles.includes('Supir')}>
                  {signedRoles.includes('Supir') ? 'Supir ✓' : 'Supir (Pengemudi)'}
                </option>
              </select>
              <button
                onClick={() => setShowCanvas(!showCanvas)}
                className="px-4 py-2.5 border border-suka-brown/15 text-suka-brown font-semibold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all"
              >
                {showCanvas ? 'Sembunyikan Canvas' : 'Gambar Tanda Tangan'}
              </button>
            </div>

            {showCanvas && <SignatureCanvas onSignatureSaved={(img) => setSignatureImage(img)} />}

            {signatureImage && (
              <div className="flex items-center gap-4 border border-suka-brown/10 p-3 bg-[#fff8f1]/50 rounded-xl">
                <div className="bg-white p-2 border border-suka-brown/10 rounded-lg">
                  <img src={signatureImage} alt="preview" className="h-10 w-auto object-contain" />
                </div>
                <button
                  onClick={handleSign}
                  disabled={signing}
                  className="px-4 py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {signing ? 'Menandatangani...' : 'Konfirmasi & Simpan'}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onFinalize}
          disabled={submitting || missingRoles.length > 0}
          className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md disabled:opacity-50 text-sm"
        >
          {submitting ? 'Menyimpan...' : 'Selesai & Simpan Penerimaan'}
        </button>
        {missingRoles.length > 0 && (
          <p className="text-xs text-center text-orange-600 font-semibold">
            ⚠️ Menunggu tanda tangan: {missingRoles.join(', ')}
          </p>
        )}
        <button
          onClick={onBack}
          disabled={submitting}
          className="w-full border border-suka-brown/15 text-suka-brown font-semibold rounded-xl py-3 text-xs bg-white hover:bg-suka-cream transition-all disabled:opacity-50"
        >
          ← Kembali ke ringkasan
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error TypeScript pada `ReceiptSignatureStep.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/ReceiptSignatureStep.tsx
git commit -m "feat(distribusi): add ReceiptSignatureStep component"
```

---

## Task 3: Sisipkan step TТД ke `VerifikasiForm`

Tambah step `signature` antara `summary` dan finalize. Tombol di summary jadi "Lanjut ke Tanda Tangan"; finalize hanya jalan dari `ReceiptSignatureStep`.

**Files:**
- Modify: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx`

- [ ] **Step 1: Import komponen step & redirect tujuan**

Ubah baris import (atas file) tambahkan:

```tsx
import { ReceiptSignatureStep } from './ReceiptSignatureStep'
```

- [ ] **Step 2: Perluas tipe Step**

Ganti:
```tsx
type Step = 'cards' | 'summary'
```
menjadi:
```tsx
type Step = 'cards' | 'summary' | 'signature'
```

- [ ] **Step 3: Ubah redirect finalize ke Riwayat**

Di `handleSubmit`, ganti baris:
```tsx
      router.push('/distribusi/terima')
```
menjadi:
```tsx
      router.push('/distribusi/riwayat')
```

- [ ] **Step 4: Render step signature sebelum blok `if (step === 'summary')`**

Tepat sebelum baris `if (step === 'summary') {`, sisipkan:

```tsx
  if (step === 'signature') {
    return (
      <ReceiptSignatureStep
        suratJalanId={id}
        submitting={submitting}
        onFinalize={handleSubmit}
        onBack={() => setStep('summary')}
      />
    )
  }

```

- [ ] **Step 5: Ubah tombol summary jadi "Lanjut ke Tanda Tangan"**

Di blok summary, ganti tombol submit:
```tsx
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer text-sm"
            >
              {submitting ? 'Menyimpan...' : 'Selesai & Simpan Verifikasi'}
            </button>
```
menjadi:
```tsx
            <button
              onClick={() => setStep('signature')}
              className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md transition-all cursor-pointer text-sm"
            >
              Lanjut ke Tanda Tangan →
            </button>
```

- [ ] **Step 6: Verifikasi kompilasi**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error TypeScript.

- [ ] **Step 7: Verifikasi manual alur**

Jalankan dev server distribusi, login crew (Andi/EMPANG), buka satu SJ di Inbox → Verifikasi semua item → di summary klik "Lanjut ke Tanda Tangan" → isi 2 TТД (Crew Penerima + Supir) → tombol "Selesai & Simpan Penerimaan" aktif → klik.
Expected: redirect ke `/distribusi/riwayat`; cek SQL `select status, receipt_signatures from surat_jalan where id='<sj_id>'` → status `diterima_*`, `receipt_signatures` berisi 2 entri.

- [ ] **Step 8: Commit**

```bash
git add apps/distribusi/src/components/distribusi/VerifikasiForm.tsx
git commit -m "feat(distribusi): gate finalize behind receipt signatures"
```

---

## Task 4: Hook + halaman Riwayat (outlet sendiri)

**Files:**
- Create: `apps/distribusi/src/hooks/useRiwayatList.ts`
- Create: `apps/distribusi/src/components/distribusi/RiwayatList.tsx`
- Create: `apps/distribusi/src/app/distribusi/riwayat/page.tsx`

- [ ] **Step 1: Tulis hook `useRiwayatList`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface RiwayatRow {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
  has_problem: boolean
}

export function useRiwayatList() {
  const { outletStaff } = useAuth()
  const [data, setData] = useState<RiwayatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        let query = supabase
          .from('surat_jalan')
          .select('id, outlet_id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
          .in('status', ['diterima_lengkap', 'diterima_sebagian'])

        if (outletStaff?.outlet_id) {
          query = query.eq('outlet_id', outletStaff.outlet_id)
        }

        const { data, error: err } = await query.order('created_at', { ascending: false })
        if (err) { setError(err.message); setData([]); return }

        const rows: RiwayatRow[] = (data || []).map((sj: any) => {
          const items = sj.surat_jalan_item || []
          const has_problem = items.some(
            (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
          )
          return {
            id: sj.id,
            outlet_id: sj.outlet_id,
            status: sj.status,
            created_at: sj.created_at,
            document_number: sj.document_number,
            outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets,
            has_problem,
          }
        })
        setData(rows)
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [outletStaff?.outlet_id])

  return { data, loading, error }
}
```

- [ ] **Step 2: Tulis komponen `RiwayatList`**

```tsx
'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRiwayatList } from '@/hooks/useRiwayatList'

export function RiwayatList() {
  const { outletStaff } = useAuth()
  const { data, loading } = useRiwayatList()

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat riwayat penerimaan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Riwayat Penerimaan</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">{outletStaff?.name || 'Staff'}</p>
          </div>
        </div>
        <Link href="/distribusi/terima" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Inbox
        </Link>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {data.length === 0 ? (
          <div className="bg-white rounded-xl border border-suka-brown/10 p-12 text-center shadow-sm">
            <p className="text-suka-brown/50 font-medium text-lg">Belum ada penerimaan selesai</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-suka-brown/10 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">No. SJ</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Catatan</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10">
                {data.map((sj) => (
                  <tr key={sj.id} className="hover:bg-suka-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-suka-ink">{sj.document_number || sj.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border bg-green-50 text-green-800 border-green-200">
                        {sj.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-suka-brown/70 font-medium">
                      {new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {sj.has_problem ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">⚠️ Ada Masalah</span>
                      ) : (
                        <span className="text-suka-brown/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/distribusi/riwayat/${sj.id}`} className="inline-flex px-3 py-1.5 bg-[#701604] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all">
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Tulis route page**

```tsx
import { RiwayatList } from '@/components/distribusi/RiwayatList'

export default function RiwayatPage() {
  return <RiwayatList />
}
```

- [ ] **Step 4: Verifikasi kompilasi & manual**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error. Buka `/distribusi/riwayat` sebagai crew EMPANG → SJ yang sudah diterima muncul; badge "Ada Masalah" tampil jika ada item rusak/kurang.

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/hooks/useRiwayatList.ts apps/distribusi/src/components/distribusi/RiwayatList.tsx apps/distribusi/src/app/distribusi/riwayat/page.tsx
git commit -m "feat(distribusi): add Riwayat penerimaan page"
```

---

## Task 5: Detail Riwayat (read-only, semua TТД)

Detail SJ yang sudah diterima: item (terima vs kirim, kondisi, catatan) + TТД pengirim (`signatures`) + TТД penerima (`receipt_signatures`).

**Files:**
- Modify: `apps/distribusi/src/hooks/useSuratJalanDetail.ts`
- Create: `apps/distribusi/src/components/distribusi/RiwayatDetail.tsx`
- Create: `apps/distribusi/src/app/distribusi/riwayat/[id]/page.tsx`

- [ ] **Step 1: Sertakan `receipt_signatures` di hook detail**

Di `useSuratJalanDetail.ts`, pada interface `SuratJalanDetail` tambahkan field:
```tsx
  receipt_signatures?: any[]
```
dan pada query select ganti:
```tsx
          .select('id, outlet_id, status, created_at, signatures, document_number')
```
menjadi:
```tsx
          .select('id, outlet_id, status, created_at, signatures, receipt_signatures, document_number')
```

- [ ] **Step 2: Tulis `RiwayatDetail`**

```tsx
'use client'

import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-[#fff8f1] border border-suka-brown/10 rounded-xl p-4">
      <p className="text-xs font-bold text-suka-brown uppercase tracking-wider mb-2">{title} ({sigs.length})</p>
      {sigs.length === 0 ? (
        <p className="text-xs text-suka-brown/40">Belum ada</p>
      ) : (
        <div className="space-y-3">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.signature_image && (
                <img src={s.signature_image} alt={s.role} className="h-10 w-auto bg-white border border-suka-brown/10 rounded p-1" />
              )}
              <div>
                <p className="text-sm font-semibold text-suka-ink">{s.signed_by}</p>
                <p className="text-xs text-suka-brown/60">{s.role} · {new Date(s.signed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RiwayatDetail({ id }: { id: string }) {
  const { data, loading, error } = useSuratJalanDetail(id)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat...</p>
      </div>
    )
  }
  if (error || !data) {
    return <p className="p-6 text-red-600">Gagal memuat: {error}</p>
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <h2 className="text-xl font-bold text-[#701604] tracking-tight">Detail Penerimaan</h2>
        </div>
        <Link href="/distribusi/riwayat" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Riwayat
        </Link>
      </header>

      <div className="p-6 max-w-3xl mx-auto mt-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 shadow-sm space-y-6">
          <div className="border-b-2 border-suka-brown/20 pb-4 text-center">
            <h1 className="text-2xl font-extrabold text-suka-brown tracking-tight">SURAT JALAN</h1>
            <p className="text-md font-semibold text-suka-brown/70 mt-1">{data.document_number || id.substring(0, 8).toUpperCase()}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-50 text-green-800 border border-green-200">{data.status}</span>
          </div>

          <div>
            <h2 className="text-sm font-bold text-suka-brown uppercase tracking-wider mb-3">Item Diterima</h2>
            <div className="border border-suka-brown/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-suka-brown text-xs uppercase">Barang</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Kirim</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Terima</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/10">
                  {data.surat_jalan_item.map((item) => {
                    const kurang = item.qty_terima != null && item.qty_terima < item.qty_dikirim
                    const rusak = item.kondisi === 'rusak'
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold text-suka-ink">{item.bahan_baku?.nama}</td>
                        <td className="px-4 py-3 text-center text-suka-brown/70">{item.qty_dikirim} {item.bahan_baku?.satuan}</td>
                        <td className={`px-4 py-3 text-center font-bold ${kurang ? 'text-red-600' : 'text-suka-ink'}`}>
                          {item.qty_terima ?? '-'} {item.bahan_baku?.satuan}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rusak ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                            {item.kondisi || 'baik'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignatureBlock title="TTD Pengirim" sigs={data.signatures || []} />
            <SignatureBlock title="TTD Penerima" sigs={data.receipt_signatures || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Tulis route page**

```tsx
'use client'

import { useParams } from 'next/navigation'
import { RiwayatDetail } from '@/components/distribusi/RiwayatDetail'

export default function RiwayatDetailPage() {
  const params = useParams()
  const id = params?.id as string
  if (!id) return <p>Invalid ID</p>
  return <RiwayatDetail id={id} />
}
```

- [ ] **Step 4: Verifikasi kompilasi & manual**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error. Dari Riwayat klik "Lihat Detail" → tampil item (kirim vs terima, kondisi) + 2 blok TТД (pengirim & penerima) dengan gambar TТД.

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/hooks/useSuratJalanDetail.ts apps/distribusi/src/components/distribusi/RiwayatDetail.tsx "apps/distribusi/src/app/distribusi/riwayat/[id]/page.tsx"
git commit -m "feat(distribusi): add Riwayat detail with all signatures"
```

---

## Task 6: View Pengiriman lintas-outlet (SPV Pusat)

**Files:**
- Create: `apps/distribusi/src/hooks/usePengirimanList.ts`
- Create: `apps/distribusi/src/components/distribusi/PengirimanList.tsx`
- Create: `apps/distribusi/src/app/distribusi/pengiriman/page.tsx`

- [ ] **Step 1: Tulis hook `usePengirimanList`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface PengirimanRow {
  id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
  has_problem: boolean
}

export function usePengirimanList() {
  const [data, setData] = useState<PengirimanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        // Lintas-outlet: tanpa filter outlet_id. Semua status.
        const { data, error: err } = await supabase
          .from('surat_jalan')
          .select('id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
          .order('created_at', { ascending: false })

        if (err) { setError(err.message); setData([]); return }

        const rows: PengirimanRow[] = (data || []).map((sj: any) => {
          const items = sj.surat_jalan_item || []
          const has_problem = items.some(
            (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
          )
          return {
            id: sj.id,
            status: sj.status,
            created_at: sj.created_at,
            document_number: sj.document_number,
            outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets,
            has_problem,
          }
        })
        setData(rows)
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { data, loading, error }
}
```

- [ ] **Step 2: Tulis komponen `PengirimanList` dgn role guard**

```tsx
'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { usePengirimanList } from '@/hooks/usePengirimanList'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  dikirim: 'bg-blue-50 text-blue-800 border-blue-200',
  dikirim_lengkap: 'bg-blue-50 text-blue-800 border-blue-200',
  diterima_sebagian: 'bg-orange-50 text-orange-800 border-orange-200',
  diterima_lengkap: 'bg-green-50 text-green-800 border-green-200',
}

export function PengirimanList() {
  const { outletStaff, loading: authLoading } = useAuth()
  const { data, loading } = usePengirimanList()

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] text-suka-brown text-sm">Memuat...</div>
  }

  if (outletStaff?.role !== 'kepala_outlet') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] text-center px-6">
        <p className="text-suka-brown font-bold text-lg mb-2">Akses Ditolak</p>
        <p className="text-suka-brown/60 text-sm mb-4">Halaman ini hanya untuk SPV Pusat.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-[#701604] text-white rounded-xl text-sm font-bold">← Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Pengiriman (Semua Outlet)</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">{outletStaff?.name} · SPV Pusat</p>
          </div>
        </div>
        <Link href="/dashboard" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Dashboard
        </Link>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {loading ? (
          <p className="text-suka-brown/50 text-center py-12">Memuat daftar pengiriman...</p>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-suka-brown/10 p-12 text-center shadow-sm">
            <p className="text-suka-brown/50 font-medium text-lg">Belum ada surat jalan</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-suka-brown/10 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">No. SJ</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tujuan</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10">
                {data.map((sj) => (
                  <tr key={sj.id} className="hover:bg-suka-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-suka-ink">{sj.document_number || sj.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-suka-ink">{sj.outlets?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_STYLE[sj.status] || 'bg-gray-50 text-gray-800 border-gray-200'}`}>
                        {sj.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-suka-brown/70 font-medium">
                      {new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {sj.has_problem ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">⚠️ Ada Masalah</span>
                      ) : (
                        <span className="text-suka-brown/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Tulis route page**

```tsx
import { PengirimanList } from '@/components/distribusi/PengirimanList'

export default function PengirimanPage() {
  return <PengirimanList />
}
```

- [ ] **Step 4: Verifikasi kompilasi & manual**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error. Login sbg `kepala_outlet` (SPV Pusat) → `/distribusi/pengiriman` tampil semua SJ lintas-outlet. Login sbg crew → halaman tampil "Akses Ditolak".

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/hooks/usePengirimanList.ts apps/distribusi/src/components/distribusi/PengirimanList.tsx apps/distribusi/src/app/distribusi/pengiriman/page.tsx
git commit -m "feat(distribusi): add cross-outlet Pengiriman view for SPV Pusat"
```

---

## Task 7: Navigasi dashboard per-role

**Files:**
- Modify: `apps/distribusi/src/app/dashboard/page.tsx`

- [ ] **Step 1: Tambah grid menu navigasi sesuai role**

Di `dashboard/page.tsx`, tepat sebelum penutup `</div>` terluar (setelah blok "M0 Foundation Checklist" / sebelum baris `Ready for M1...`), sisipkan blok menu. Ganti paragraf:
```tsx
      <p className="mt-8 text-gray-500 text-sm">Ready for M1 development...</p>
```
menjadi:
```tsx
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {(outletStaff?.role === 'crew' || outletStaff?.role === 'spv') && (
          <>
            <a href="/distribusi/terima" className="p-5 bg-white rounded-xl border border-suka-brown/10 hover:border-suka-orange shadow-sm transition">
              <p className="text-lg font-bold text-suka-brown">📥 Inbox Penerimaan</p>
              <p className="text-sm text-gray-500 mt-1">Verifikasi kiriman masuk</p>
            </a>
            <a href="/distribusi/riwayat" className="p-5 bg-white rounded-xl border border-suka-brown/10 hover:border-suka-orange shadow-sm transition">
              <p className="text-lg font-bold text-suka-brown">📚 Riwayat</p>
              <p className="text-sm text-gray-500 mt-1">Penerimaan yang sudah selesai</p>
            </a>
          </>
        )}
        {outletStaff?.role === 'kepala_outlet' && (
          <>
            <a href="/distribusi/surat-jalan/new" className="p-5 bg-white rounded-xl border border-suka-brown/10 hover:border-suka-orange shadow-sm transition">
              <p className="text-lg font-bold text-suka-brown">➕ Buat Surat Jalan</p>
              <p className="text-sm text-gray-500 mt-1">Kirim barang ke outlet</p>
            </a>
            <a href="/distribusi/pengiriman" className="p-5 bg-white rounded-xl border border-suka-brown/10 hover:border-suka-orange shadow-sm transition">
              <p className="text-lg font-bold text-suka-brown">🚚 Pengiriman</p>
              <p className="text-sm text-gray-500 mt-1">Pantau semua outlet</p>
            </a>
          </>
        )}
      </div>
```

- [ ] **Step 2: Verifikasi kompilasi & manual**

Run: `cd apps/distribusi && yarn tsc --noEmit`
Expected: tidak ada error. Login crew → muncul Inbox + Riwayat. Login `kepala_outlet` → muncul Buat SJ + Pengiriman.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/app/dashboard/page.tsx
git commit -m "feat(distribusi): role-based dashboard navigation"
```

---

## Task 8: E2E verifikasi rantai penuh (FASE B lanjutan)

**Files:**
- Modify: `docs/E2E-TEST-M2-M3.md` (catat hasil FASE B)

- [ ] **Step 1: Jalankan skenario penuh**

1. Login crew (Andi/EMPANG) → Dashboard → Inbox → buka SJ EMPANG.
2. Verifikasi semua item (campur "baik" & satu "jelek/kurang") → Lanjut ke Tanda Tangan.
3. Isi TТД Crew Penerima + Supir → Selesai & Simpan Penerimaan.
4. SQL cek ledger:
```sql
select * from ledger_stok where surat_jalan_id = '<sj_id>' order by created_at desc;
```
Expected: ada baris penambahan stok untuk item yang diterima (qty sesuai qty_terima).
5. Buka app stok → monitoring → stok bahan terkait di outlet EMPANG naik.
6. Distribusi → Riwayat → SJ muncul, badge "Ada Masalah" jika ada item jelek/kurang → Detail tampil 4 TТД (2 pengirim + 2 penerima).
7. Logout → login SPV Pusat → Pengiriman → SJ tampil berstatus `diterima_*`.

- [ ] **Step 2: Uji idempotency**

Ulangi klik tak akan terjadi (sudah redirect), tapi verifikasi via SQL bahwa hanya ada satu set ledger entry untuk SJ tsb (tidak ganda).
```sql
select count(*) from ledger_stok where surat_jalan_id = '<sj_id>' and keterangan ilike '%terima%';
```
Expected: jumlah = jumlah item diterima (tidak berlipat).

- [ ] **Step 3: Uji isolasi RLS frontend**

Login crew outlet lain (mis. DEPOK) → Inbox & Riwayat tidak menampilkan SJ EMPANG.
Expected: list kosong / tanpa SJ EMPANG.

- [ ] **Step 4: Catat hasil & commit**

Tambahkan ringkasan PASS/FAIL FASE B ke `docs/E2E-TEST-M2-M3.md`.

```bash
git add docs/E2E-TEST-M2-M3.md
git commit -m "docs(e2e): record FASE B penerimaan+TTD results"
```

---

## Self-Review Notes

- **Spec coverage:** Bagian 1 (DB)→T1; Bagian 2 (alur+TТД)→T2,T3; Bagian 3 (Riwayat)→T4,T5; Bagian 4 (Pengiriman)→T6; Bagian 5 (navigasi)→T7; Testing→T8. RLS: spec menyebut "pastikan kepala_outlet SELECT semua" — sudah terpenuhi oleh policy `surat_jalan_select` existing (semua authenticated), jadi tak perlu migration; akses dibatasi via role-guard di komponen (T6).
- **Konsistensi tipe:** `receipt_signatures` dipakai konsisten (kolom, select hook T5, RiwayatDetail). Field item `qty_terima`/`kondisi`/`qty_dikirim` konsisten dgn `useSuratJalanDetail` existing. Role string `'Crew Penerima'`/`'Supir'` konsisten antara RPC (T1) & komponen (T2).
- **Placeholder:** tidak ada TBD/TODO; semua step berisi kode aktual.
