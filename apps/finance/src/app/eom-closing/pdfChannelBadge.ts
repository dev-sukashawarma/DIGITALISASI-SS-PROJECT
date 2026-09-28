/* Lencana (logo) channel untuk PDF EOM.
 * Logo di lib/channels berupa path SVG 24x24; jsPDF tak bisa menyisipkan SVG,
 * jadi di browser logo digambar ke canvas lalu disisipkan sebagai PNG.
 * Tanpa canvas (mis. saat render di server/tes) dipakai lencana huruf.
 */
import type { jsPDF } from 'jspdf'
import { getChannel } from '@/lib/channels'

type Rgb = [number, number, number]

interface BadgeInfo {
  bg: string
  mark: string
  path?: string
}

const OWN: Record<string, BadgeInfo> = {
  pos_kasir: { bg: '#2563EB', mark: 'POS' },
  pos_pawoon: { bg: '#701604', mark: 'PW' },
  online: { bg: '#F29744', mark: 'WEB' },
  endors: { bg: '#D946EF', mark: 'END' },
}

export function badgeInfo(key: string): BadgeInfo {
  if (OWN[key]) return OWN[key]
  const ch = getChannel(key)
  if (ch) return { bg: ch.bg, mark: ch.mark ?? ch.label.slice(0, 2).toUpperCase(), path: ch.logoPath }
  return { bg: '#64748B', mark: key.slice(0, 2).toUpperCase() }
}

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** PNG (data URL) per channel yang punya logo. Kosong bila canvas tak tersedia. */
export async function prepareBadgeImages(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return out
  for (const key of new Set(keys)) {
    const info = badgeInfo(key)
    if (!info.path) continue
    try {
      const size = 96
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = info.bg
      const r = 18
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.arcTo(size, 0, size, size, r)
      ctx.arcTo(size, size, 0, size, r)
      ctx.arcTo(0, size, 0, 0, r)
      ctx.arcTo(0, 0, size, 0, r)
      ctx.closePath()
      ctx.fill()
      // ikon 24x24 → 60% dari lencana, di tengah
      const scale = (size * 0.6) / 24
      ctx.translate((size - 24 * scale) / 2, (size - 24 * scale) / 2)
      ctx.scale(scale, scale)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill(new Path2D(info.path))
      out.set(key, canvas.toDataURL('image/png'))
    } catch {
      // logo gagal digambar → jatuh ke lencana huruf
    }
  }
  return out
}

/** Gambar lencana di (x, y) berukuran `size` mm. */
export function drawBadge(doc: jsPDF, key: string, x: number, y: number, size: number, images: Map<string, string>) {
  const img = images.get(key)
  if (img) {
    doc.addImage(img, 'PNG', x, y, size, size)
    return
  }
  const info = badgeInfo(key)
  doc.setFillColor(...hexToRgb(info.bg))
  doc.roundedRect(x, y, size, size, 0.8, 0.8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(info.mark.length > 2 ? 4.2 : 5.5)
  doc.text(info.mark, x + size / 2, y + size / 2, { align: 'center', baseline: 'middle' })
}
