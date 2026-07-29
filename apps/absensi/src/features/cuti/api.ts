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
  id: string;
  user_id: string;
  year: number;
  total_quota: number;
  used_quota: number;
}

export function useLeaveBalance(userId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['leaveBalance', userId, year],
    queryFn: async () => {
      if (!userId) return null;
      const supabase = createClient();
      
      // Get total quota from outlet_staff
      const { data: staff, error: staffErr } = await supabase
        .from('outlet_staff')
        .select('leave_quota')
        .eq('id', userId)
        .single();
        
      if (staffErr) throw staffErr;
      
      // Get used quota from approved leave_requests this year
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data: leaves, error: leavesErr } = await supabase
        .from('leave_requests')
        .select('days')
        .eq('staff_id', userId)
        .eq('status', 'approved')
        .gte('start_date', startOfYear)
        .lte('start_date', endOfYear);
        
      if (leavesErr) throw leavesErr;
      
      const used = leaves.reduce((sum, leave) => sum + (leave.days || 0), 0);
      const total = staff.leave_quota ?? 12;

      return {
        id: userId,
        user_id: userId,
        year,
        total_quota: total,
        used_quota: used,
      } as LeaveBalance;
    },
    enabled: !!userId,
  });
}

export function useLeaveHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['leaves', userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('staff_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map back to our component's expected format
      return data.map(d => ({
        ...d,
        user_id: d.staff_id,
        type: d.leave_type,
        status_hr: d.status,
      })) as Leave[];
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
      
      const { data, error } = await supabase
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
        }])
        .select()
        .single();
        
      if (error) throw error;
      return data as Leave;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leaves', variables.staff_id] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance', variables.staff_id] });
    },
  });
}
