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
