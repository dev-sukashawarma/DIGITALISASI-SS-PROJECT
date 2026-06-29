'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import type { CashAdvance, CashAdvancePayment } from '@/lib/types';

interface CashAdvanceRow extends CashAdvance {
  outlet_staff: {
    name: string;
  };
  cash_advance_payments: CashAdvancePayment[];
}

export function useCashAdvances() {
  const supabase = createClient();

  return useQuery<CashAdvanceRow[]>({
    queryKey: ['cash-advances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_advances')
        .select(
          `
          *,
          outlet_staff!cash_advances_staff_id_fkey(name),
          cash_advance_payments(
            id,
            amount,
            payment_date,
            note,
            created_at
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as CashAdvanceRow[]) ?? [];
    },
  });
}

export type { CashAdvanceRow };
