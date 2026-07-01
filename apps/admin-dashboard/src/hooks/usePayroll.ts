'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import type { PayrollRecord } from '@/lib/types';

interface PayrollRow extends PayrollRecord {
  outlet_staff: {
    name: string;
    role: string;
    outlet_id: string;
    outlets: {
      name: string;
    };
  };
}

export function usePayroll(month: number, year: number) {
  const supabase = createClient();

  return useQuery<PayrollRow[]>({
    queryKey: ['payroll', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(
          `
          *,
          outlet_staff!payroll_records_staff_id_fkey(
            name,
            role,
            outlet_id,
            outlets!outlet_staff_outlet_id_fkey(name)
          )
        `
        )
        .eq('period_month', month)
        .eq('period_year', year)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as PayrollRow[]) ?? [];
    },
    enabled: !!month && !!year,
  });
}

export type { PayrollRow };
