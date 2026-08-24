'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

type OverrideInput = {
  outletId: string
  startingBalance: number
  currentBalance: number
  note: string
}
export async function overridePettyCashBalance(input: OverrideInput) {
  try {
    if (!input.outletId) throw new Error('Pilih outlet terlebih dahulu')
    if (!Number.isFinite(input.startingBalance) || input.startingBalance < 0) {
      throw new Error('Modal awal tidak valid')
    }
    if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) {
      throw new Error('Saldo saat ini tidak valid')
    }
    if (input.note.trim().length < 5) {
      throw new Error('Catatan perubahan minimal 5 karakter')
    }

    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { data, error } = await supabase.rpc('admin_override_outlet_petty_cash', {
      p_outlet_id: input.outletId,
      p_starting_balance: input.startingBalance,
      p_current_balance: input.currentBalance,
      p_note: input.note.trim(),
    })

    if (error) throw error

    revalidatePath('/dashboard/petty-cash-balance')
    revalidatePath('/dashboard/leader')
    revalidatePath('/dashboard/area-manager/petty-cash')

    return { success: true as const, historyId: data as string }
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.message || 'Saldo gagal disimpan',
    }
  }
}
