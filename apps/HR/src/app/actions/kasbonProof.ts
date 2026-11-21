'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import { sendWahaFile, sendWahaText } from '@/lib/waha'
import { mimeTypeFromProofPath, pesanBuktiTransferKasbon } from '@/lib/whatsappKasbon'

const KASBON_PROOF_ROLES = ['admin', 'owner', 'admin_hr', 'admin_finance']
const BUCKET_FINANCE_PROOFS = 'finance-proofs'
/** 7 hari: cukup lama agar tautan bukti di pesan WhatsApp tetap bisa dibuka penerima. */
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Konfigurasi Supabase service role belum tersedia di server')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getKasbonProofSignedUrls(
  paths: string[],
): Promise<{ ok: true; urls: Record<string, string> } | { ok: false; error: string }> {
  try {
    await requireRole(KASBON_PROOF_ROLES)

    const cleanPaths = [...new Set(
      paths
        .map((p) => p?.trim())
        .filter((p): p is string => Boolean(p) && !/^https?:\/\//i.test(p)),
    )].slice(0, 100)

    if (cleanPaths.length === 0) {
      return { ok: true, urls: {} }
    }

    const db = adminDb()
    // Pastikan hanya path yang benar-benar tercatat sebagai bukti_cair kasbon yang bisa di-sign.
    const { data: rows, error: dbErr } = await db
      .from('cash_advances')
      .select('bukti_cair')
      .in('bukti_cair', cleanPaths)
    if (dbErr) throw dbErr

    const verified = [...new Set(
      (rows ?? [])
        .map((r) => (r.bukti_cair as string | null)?.trim())
        .filter((p): p is string => Boolean(p)),
    )]

    if (verified.length === 0) {
      return { ok: true, urls: {} }
    }

    const { data, error } = await db.storage
      .from(BUCKET_FINANCE_PROOFS)
      .createSignedUrls(verified, SIGNED_URL_TTL_SECONDS)
    if (error) throw error

    const urls: Record<string, string> = {}
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) {
        urls[entry.path] = entry.signedUrl
      }
    }

    return { ok: true, urls }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal memuat tautan bukti transfer',
    }
  }
}

export async function sendKasbonProofWaha(
  cashAdvanceId: string,
  customNote?: string,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    await requireRole(KASBON_PROOF_ROLES)

    const db = adminDb()
    const { data: row, error: rowErr } = await db
      .from('cash_advances')
      .select('id, staff_id, amount, metode_cair, dicairkan_at, bukti_cair, status')
      .eq('id', cashAdvanceId)
      .maybeSingle()

    if (rowErr) throw rowErr
    if (!row) return { ok: false, error: 'Data kasbon tidak ditemukan' }

    const { data: staff, error: staffErr } = await db
      .from('outlet_staff')
      .select('name, phone')
      .eq('id', row.staff_id)
      .maybeSingle()
    if (staffErr) throw staffErr

    const phone = (staff?.phone as string | null)?.trim()
    if (!phone) {
      return { ok: false, error: 'Nomor WhatsApp staf belum terdaftar di data karyawan' }
    }

    const staffName = (staff?.name as string | null)?.trim() || 'Rekan'
    const buktiPath = (row.bukti_cair as string | null)?.trim()
    let caption = pesanBuktiTransferKasbon({
      staffName,
      amount: Number(row.amount) || 0,
      metodeCair: row.metode_cair as 'transfer' | 'tunai' | null,
      dicairkanAt: row.dicairkan_at as string | null,
      includeProofLink: !buktiPath,
    })

    if (customNote?.trim()) {
      caption = `${caption}\n\nCatatan HR: ${customNote.trim()}`
    }

    if (!buktiPath) {
      const textRes = await sendWahaText({ phone, text: caption, simulateTyping: true })
      if (!textRes.success) {
        return { ok: false, error: textRes.error || 'Gagal mengirim pesan WhatsApp via WAHA' }
      }
      return { ok: true, messageId: textRes.messageId }
    }

    let fileBuffer: ArrayBuffer
    let mimetype = mimeTypeFromProofPath(buktiPath)

    if (/^https?:\/\//i.test(buktiPath)) {
      const res = await fetch(buktiPath, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) {
        return { ok: false, error: `Gagal mengunduh file bukti (HTTP ${res.status})` }
      }
      mimetype = res.headers.get('content-type') || mimetype
      fileBuffer = await res.arrayBuffer()
    } else {
      const { data: blob, error: dlErr } = await db.storage
        .from(BUCKET_FINANCE_PROOFS)
        .download(buktiPath)
      if (dlErr || !blob) {
        return { ok: false, error: dlErr?.message || 'File bukti transfer tidak ditemukan di storage' }
      }
      if (blob.type) mimetype = blob.type
      fileBuffer = await blob.arrayBuffer()
    }

    const base64 = Buffer.from(fileBuffer).toString('base64')
    const rawName = buktiPath.split('/').pop()?.split('?')[0] || `bukti-kasbon-${row.id}.jpg`

    const fileRes = await sendWahaFile({
      phone,
      fileBase64: base64,
      filename: rawName,
      mimetype,
      caption,
    })

    if (!fileRes.success) {
      return { ok: false, error: fileRes.error || 'Gagal mengirim bukti transfer via WAHA' }
    }

    return { ok: true, messageId: fileRes.messageId }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal mengirim bukti via WAHA',
    }
  }
}
