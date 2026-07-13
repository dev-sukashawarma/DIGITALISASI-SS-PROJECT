import { createClient } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type KasbonStatus = 'pending' | 'approved' | 'rejected' | 'not_required';
// DB CHECK constraint on cash_advances.status only allows these two (disbursement lifecycle, NOT approval state)
export type KasbonDisbursementStatus = 'active' | 'paid_off';

export interface CashAdvance {
  id: string;
  staff_id: string; // was user_id
  amount: number;
  installment_months: number;
  reason: string;
  status_spv: KasbonStatus;
  status_hr: KasbonStatus; // real approval column
  status: KasbonDisbursementStatus; // disbursement/payoff state, not approval
  created_at: string;
}

export interface CashAdvanceInstallment {
  id: string;
  cash_advance_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'paid';
  paid_at: string | null;
}

export function useKasbonHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['kasbon', userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cash_advances')
        .select('*')
        .eq('staff_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map back to our component's expected format
      return (data || []).map(d => ({
        ...d,
        user_id: d.staff_id,
      })) as any[];
    },
    enabled: !!userId,
  });
}

export function useSubmitKasbon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('cash_advances')
        .insert([{
          staff_id: payload.staff_id,
          amount: payload.amount,
          remaining: payload.amount, // Set remaining = amount initially
          reason: payload.reason,
          installment_months: payload.installment_months,
          status_spv: payload.status_spv,
          // status_hr defaults to 'pending' in DB; `status` (active/paid_off) is disbursement
          // state and must NOT be set here — it defaults to 'active' and has no "pending" value.
        }])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kasbon', variables.staff_id] });
    },
  });
}
