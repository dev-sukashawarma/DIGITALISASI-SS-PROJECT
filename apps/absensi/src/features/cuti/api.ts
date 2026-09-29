import { createClient } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'not_required';
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other';

export interface Leave {
  id: string;
  staff_id: string; // was user_id
  leave_type: string; // was type
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  attachment_url: string | null;
  status_spv: LeaveStatus;
  status: LeaveStatus; // HR status
  rejection_note: string | null;
  created_at: string;
  file?: File | null;
}

export interface LeaveBalance {
  /** Sisa kuota — `outlet_staff.leave_quota` sudah dipotong HR setiap kali menyetujui
   *  cuti (apps/HR useLeaveMutations). Jangan dikurangi lagi dengan pemakaian. */
  sisa_quota: number;
}

/** Satu baris via primary key. Pemakaian tahun ini tidak di-query terpisah: dihitung dari
 *  riwayat (`useLeaveHistory`) yang memang sudah dimuat di layar yang sama. `year` tetap
 *  di queryKey karena realtime (useLeaveNotifications) meng-invalidate dengan kunci itu. */
export function useLeaveBalance(userId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['leaveBalance', userId, year],
    queryFn: async () => {
      if (!userId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from('outlet_staff')
        .select('leave_quota')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return { sisa_quota: data.leave_quota ?? 0 } as LeaveBalance;
    },
    enabled: !!userId,
    // Kuota hanya berubah saat HR menyetujui — dan itu sudah memicu invalidasi realtime.
    staleTime: 5 * 60_000,
  });
}

const KOLOM_RIWAYAT =
  'id,staff_id,leave_type,start_date,end_date,days,reason,attachment_url,status_spv,status,rejection_note,created_at';

export function useLeaveHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['leaves', userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leave_requests')
        .select(KOLOM_RIWAYAT)
        .eq('staff_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as Leave[];
    },
    enabled: !!userId,
  });
}

export function useSubmitLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Leave>) => {
      const supabase = createClient();
      
      let attachment_url: string | null = null;
      if (payload.file) {
        const fileExt = payload.file.name.split('.').pop();
        const fileName = `${Date.now()}_${payload.staff_id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('hr-attachments')
          .upload(fileName, payload.file);
          
        if (uploadError) throw new Error(`Gagal upload bukti: ${uploadError.message}`);
        
        const { data: publicUrlData } = supabase.storage
          .from('hr-attachments')
          .getPublicUrl(fileName);
          
        attachment_url = publicUrlData.publicUrl;
      }
      
      // Tanpa .select(): baris hasil insert tidak dipakai (riwayat dimuat ulang lewat
      // invalidasi), jadi tidak perlu dikirim balik.
      const { error } = await supabase
        .from('leave_requests')
        .insert([{
          staff_id: payload.staff_id,
          leave_type: payload.leave_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          days: payload.days,
          reason: payload.reason,
          status_spv: payload.status_spv,
          status: payload.status,
          attachment_url,
        }]);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      // Kuota tidak berubah saat mengajukan (baru dipotong ketika HR menyetujui),
      // jadi cukup riwayat yang dimuat ulang.
      queryClient.invalidateQueries({ queryKey: ['leaves', variables.staff_id] });
    },
  });
}
