import { createClient } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type KasbonStatus = 'pending' | 'approved' | 'rejected' | 'not_required';
export type KasbonFinalStatus = 'pending' | 'active' | 'paid_off' | 'rejected'; // active=approved

export interface CashAdvance {
  id: string;
  staff_id: string; // was user_id
  amount: number;
  installment_months: number;
  reason: string;
  status_spv: KasbonStatus;
  status: KasbonFinalStatus; // HR status / final status
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
        status_hr: d.status === 'active' || d.status === 'paid_off' ? 'approved' : d.status, // Map 'active' to approved for frontend display
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
          status: payload.status,
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
