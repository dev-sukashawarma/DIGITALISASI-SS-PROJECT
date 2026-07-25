import type { SupabaseClient } from '@supabase/supabase-js'

export type PaperWidth = 58 | 80
export type FontScale = 'normal' | 'besar'
export type FontFamily = 'monospace' | 'sans' | 'serif'

/** Kontrol tipografi & margin bersama (berlaku penuh di jalur cetak HTML/browser;
 *  di thermal/ESC-POS hanya `bold` yang berefek). */
export interface Typography {
  fontFamily: FontFamily
  fontSizePx: number
  bold: boolean
  marginMm: number
}

export interface CustomerLayout extends Typography {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; footerText: string
  fontScale: FontScale; showCashier: boolean; showCustomer: boolean; showItemNotes: boolean
}
export interface KitchenLayout extends Typography {
  paperWidth: PaperWidth; showLogo: boolean; headerText: string; fontScale: FontScale; showCustomer: boolean
}
export interface QrLayout extends Typography {
  paperWidth: PaperWidth; showLogo: boolean; title: string; footerText: string; qrSizeMm: number
}
export interface PrintLayout {
  struk_customer: CustomerLayout; struk_dapur: KitchenLayout; qr_surat_jalan: QrLayout
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  struk_customer: {
    paperWidth: 58, showLogo: true, headerText: '', footerText: 'Terima kasih & selamat menikmati!',
    fontScale: 'normal', showCashier: true, showCustomer: true, showItemNotes: true,
    fontFamily: 'monospace', fontSizePx: 14, bold: true, marginMm: 2,
  },
  struk_dapur: {
    paperWidth: 58, showLogo: false, headerText: 'STRUK DAPUR', fontScale: 'normal', showCustomer: true,
    fontFamily: 'monospace', fontSizePx: 14, bold: true, marginMm: 2,
  },
  qr_surat_jalan: {
    paperWidth: 58, showLogo: false, title: 'VERIFIKASI SJ', footerText: 'Distribusi\nSuka Shawarma', qrSizeMm: 45,
    fontFamily: 'monospace', fontSizePx: 13, bold: true, marginMm: 2,
  },
}

export const PRINT_LAYOUT_KEY = 'print_layout'

export function mergePrintLayout(raw: unknown): PrintLayout {
  // Kolom global_settings.value bertipe TEXT → nilai bisa datang sebagai string JSON
  // (bukan objek). Parse dulu bila string, agar setelan tersimpan benar-benar terpakai.
  let obj: unknown = raw
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { obj = {} }
  }
  const r = (obj ?? {}) as Partial<PrintLayout>
  return {
    struk_customer: { ...DEFAULT_PRINT_LAYOUT.struk_customer, ...(r.struk_customer ?? {}) },
    struk_dapur: { ...DEFAULT_PRINT_LAYOUT.struk_dapur, ...(r.struk_dapur ?? {}) },
    qr_surat_jalan: { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, ...(r.qr_surat_jalan ?? {}) },
  }
}

let cachedLayout: PrintLayout | null = null;
let lastFetchTime = 0;

export async function fetchPrintLayout(supabase: SupabaseClient): Promise<PrintLayout> {
  const now = Date.now();
  if (cachedLayout && (now - lastFetchTime < 60_000 * 5)) {
    return cachedLayout;
  }
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', PRINT_LAYOUT_KEY)
      .maybeSingle()
    if (error || !data) return DEFAULT_PRINT_LAYOUT
    cachedLayout = mergePrintLayout((data as { value: unknown }).value)
    lastFetchTime = now
    return cachedLayout
  } catch {
    return DEFAULT_PRINT_LAYOUT
  }
}
