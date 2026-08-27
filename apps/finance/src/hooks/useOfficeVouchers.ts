'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import {
  type OfficeVoucher,
  type OfficeDivision
} from '@/lib/officeVoucher'
import { type ExpenseCategory } from '@/lib/expenseCategories'
import {
  getOfficeVouchersAction,
  createOfficeVoucherAction,
  settleOfficeVoucherAction,
  verifyOfficeVoucherAction,
  rejectOfficeVoucherAction
} from '@/app/actions/officeVoucherActions'
import { toast } from 'sonner'

export function useOfficeVouchers(filterMonth?: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // 1. Fetch vouchers (via Server Action with service role)
  const query = useQuery<OfficeVoucher[]>({
    queryKey: ['office_vouchers', filterMonth],
    staleTime: 10_000,
    queryFn: async () => {
      return await getOfficeVouchersAction(filterMonth)
    }
  })

  // 2. Create Voucher (via Server Action with service role to bypass RLS)
  const createMutation = useMutation({
    mutationFn: async (input: {
      date: string
      division: OfficeDivision
      recipientName: string
      category: ExpenseCategory
      advanceAmount: number
      reason: string
      paymentSource?: string
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      return await createOfficeVoucherAction({
        ...input,
        userId
      })
    },
    onSuccess: () => {
      toast.success('Pengajuan dana & voucher kas kantor berhasil dibuat!')
      queryClient.invalidateQueries({ queryKey: ['office_vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err: any) => {
      toast.error('Gagal membuat voucher: ' + err.message)
    }
  })

  // 3. Settle / Upload Receipt Voucher
  const settleMutation = useMutation({
    mutationFn: async (input: {
      voucher: OfficeVoucher
      realizedAmount: number
      receiptUrl?: string | null
      notes?: string
    }) => {
      return await settleOfficeVoucherAction(input)
    },
    onSuccess: () => {
      toast.success('Bukti belanja berhasil diupload & diajukan untuk verifikasi Finance!')
      queryClient.invalidateQueries({ queryKey: ['office_vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err: any) => {
      toast.error('Gagal memperbarui voucher: ' + err.message)
    }
  })

  // 4. Verify & Approve into OPEX
  const verifyMutation = useMutation({
    mutationFn: async (input: {
      voucher: OfficeVoucher
      approvedAmount?: number
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const userEmail = session?.user?.email || 'Finance & Accounting'

      return await verifyOfficeVoucherAction({
        voucher: input.voucher,
        approvedAmount: input.approvedAmount,
        verifiedBy: userEmail
      })
    },
    onSuccess: () => {
      toast.success('Voucher berhasil diverifikasi & resmi tercatat ke OPEX Kantor!')
      queryClient.invalidateQueries({ queryKey: ['office_vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err: any) => {
      toast.error('Gagal verifikasi voucher: ' + err.message)
    }
  })

  // 5. Reject Voucher
  const rejectMutation = useMutation({
    mutationFn: async (input: { voucher: OfficeVoucher; reason: string }) => {
      return await rejectOfficeVoucherAction(input)
    },
    onSuccess: () => {
      toast.success('Voucher ditolak.')
      queryClient.invalidateQueries({ queryKey: ['office_vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  return {
    vouchers: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createVoucher: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    settleVoucher: settleMutation.mutateAsync,
    isSettling: settleMutation.isPending,
    verifyVoucher: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
    rejectVoucher: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    refetch: query.refetch
  }
}
