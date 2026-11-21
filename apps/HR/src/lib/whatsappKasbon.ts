import { formatDate, formatRupiah } from './format'
import { nomorWa, tautanWa } from './whatsapp'

/**
 * Helper murni untuk bukti pencairan kasbon & pesan WhatsApp dari HR ke staf.
 */

export function isPdfProof(pathOrUrl: string | null | undefined): boolean {
  if (!pathOrUrl) return false
  const clean = pathOrUrl.split('?')[0].split('#')[0].trim().toLowerCase()
  return clean.endsWith('.pdf')
}

export function mimeTypeFromProofPath(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return 'application/octet-stream'
  const clean = pathOrUrl.split('?')[0].split('#')[0].trim().toLowerCase()
  if (clean.endsWith('.pdf')) return 'application/pdf'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export interface PesanKasbonParams {
  staffName: string
  amount: number
  metodeCair?: 'transfer' | 'tunai' | null
  dicairkanAt?: string | null
  proofUrl?: string | null
  /** True untuk link wa.me (menyertakan URL bukti jika ada); false untuk lampiran file WAHA. */
  includeProofLink?: boolean
}

export function pesanBuktiTransferKasbon({
  staffName,
  amount,
  metodeCair,
  dicairkanAt,
  proofUrl,
  includeProofLink = true,
}: PesanKasbonParams): string {
  const nama = staffName.trim() || 'Rekan'
  const metode = metodeCair === 'tunai' ? 'Tunai' : 'Transfer'
  const tgl = dicairkanAt ? `, ${formatDate(dicairkanAt)}` : ''

  const lines = [
    `Halo ${nama},`,
    `Kasbon Anda sebesar *${formatRupiah(amount)}* sudah disetujui & dicairkan oleh Finance (${metode}${tgl}).`,
  ]

  if (includeProofLink && proofUrl) {
    lines.push('', `Bukti ${metode === 'Tunai' ? 'tanda terima' : 'transfer'}: ${proofUrl}`)
  } else if (!includeProofLink) {
    lines.push('', `Berikut kami lampirkan bukti ${metode === 'Tunai' ? 'pencairan' : 'transfer'}nya.`)
  }

  lines.push('', 'Silakan dicek ya. Terima kasih.')
  return lines.join('\n')
}

export function tautanWaKasbon(
  params: PesanKasbonParams & { phone: string | null | undefined },
): string | null {
  const nomor = nomorWa(params.phone)
  if (!nomor) return null
  return tautanWa(nomor, pesanBuktiTransferKasbon({ ...params, includeProofLink: true }))
}
