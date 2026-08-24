'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

type AdjustmentInput = {
  outletId: string
  targetBalance: number
  note: string
}
export async function adjustPettyCashBalance(input: AdjustmentInput) {
  try {
    if (!input.outletId) throw new Error('Pilih outlet terlebih dahulu')
    if (!Number.isFinite(input.targetBalance) || input.targetBalance < 0) {
      throw new Error('Nominal penyesuaian tidak valid')
    }
    if (input.note.trim().length < 5) {
      throw new Error('Catatan perubahan minimal 5 karakter')
    }

    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { data, error } = await supabase.rpc('admin_adjust_petty_cash', {
      p_outlet_id: input.outletId,
      p_target_balance: input.targetBalance,
      p_note: input.note.trim(),
    })

    if (error) throw error

    revalidatePath('/dashboard/petty-cash-balance')
    revalidatePath('/dashboard/leader')
    revalidatePath('/dashboard/area-manager/petty-cash')

    const result = data as {
      adjustment_id: string
      application_mode: 'active_shift' | 'next_shift_opening'
      balance_before: number
      target_balance: number
      adjustment_amount: number
    }

    return { success: true as const, result }
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.message || 'Saldo gagal disimpan',
    }
  }
}
