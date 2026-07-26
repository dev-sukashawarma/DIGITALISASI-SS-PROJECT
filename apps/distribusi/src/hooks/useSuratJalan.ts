'use client'
import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { SuratJalan, SuratJalanItem } from '@/types/distribusi'

import { useAuth } from '@suka/auth'

// List Surat Jalan scoped by staff accessibility (Pusat sees all; Leader sees assigned outlets; Crew sees own outlet)
export function useSuratJalanList(outlet_id?: string, status?: string) {
  const { outletStaff } = useAuth()
  const [data, setData] = useState<SuratJalan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!outletStaff) return
    const supabase = createSupabaseBrowserClient()
    const fetchData = async () => {
      try {
        let query = supabase.from('surat_jalan').select('*, outlets(name)')

        const isGlobalPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'owner'].includes(outletStaff.role)

        if (outlet_id) {
          query = query.eq('outlet_id', outlet_id)
        } else if (!isGlobalPusat) {
          if (outletStaff.role === 'leader') {
            const { data: soData } = await supabase
              .from('staff_outlets')
              .select('outlet_id')
              .eq('staff_id', outletStaff.id)

            const ids = new Set<string>()
            if (outletStaff.outlet_id) ids.add(outletStaff.outlet_id)
            if (soData) {
              soData.forEach((row: any) => {
                if (row.outlet_id) ids.add(row.outlet_id)
              })
            }
            const accessibleIds = Array.from(ids)
            if (accessibleIds.length > 0) {
              query = query.in('outlet_id', accessibleIds)
            } else {
              setData([])
              setLoading(false)
              return
            }
          } else if (outletStaff.outlet_id) {
            query = query.eq('outlet_id', outletStaff.outlet_id)
          } else {
            setData([])
            setLoading(false)
            return
          }
        }

        if (status) query = query.eq('status', status)

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        const formattedData = ((data || []) as any[]).map((sj) => ({
          ...sj,
          outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
        }))
        setData(formattedData as SuratJalan[])
      } catch (err: unknown) {
        console.error('Error fetching surat_jalan:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [outletStaff, outlet_id, status])

  return { suratJalanList: data, loading }
}

// Load single Surat Jalan + its items
export function useSuratJalanDetail(suratJalanId: string | undefined) {
  const [sj, setSj] = useState<SuratJalan | null>(null)
  const [items, setItems] = useState<SuratJalanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!suratJalanId) return
    const supabase = createSupabaseBrowserClient()
    const fetchDetail = async () => {
      try {
        const [sjResult, itemsResult] = await Promise.all([
          supabase.from('surat_jalan').select('*').eq('id', suratJalanId).single(),
          supabase.from('surat_jalan_item').select('*').eq('surat_jalan_id', suratJalanId)
        ])
        const { data: sjData, error: sjError } = sjResult
        const { data: itemsData, error: itemsError } = itemsResult
        if (sjError) throw sjError
        if (itemsError) throw itemsError
        setSj(sjData as SuratJalan)
        setItems((itemsData as SuratJalanItem[]) ?? [])
      } catch (err: unknown) {
        console.error('Error fetching detail:', err)
        setSj(null)
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [suratJalanId])

  return { sj, items, loading }
}

// RPC: create_surat_jalan
export function useSuratJalanActions() {
  const supabase = createSupabaseBrowserClient()

  const create = useCallback(async (outlet_id: string, items: Array<{ bahan_baku_id: string; qty_dikirim: number }>) => {
    const { data, error } = await supabase.rpc('create_surat_jalan', {
      p_outlet_id: outlet_id,
      p_items: items
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  const send = useCallback(async (surat_jalan_id: string, signatures: any[]) => {
    const { data, error } = await supabase.rpc('send_surat_jalan', {
      p_surat_jalan_id: surat_jalan_id,
      p_signatures: signatures
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  const verify = useCallback(async (surat_jalan_id: string, item_id: string, qty_terima: number, kondisi: string, foto_path: string | null) => {
    const { data, error } = await supabase.rpc('verify_surat_jalan_item', {
      p_surat_jalan_id: surat_jalan_id,
      p_item_id: item_id,
      p_qty_terima: qty_terima,
      p_kondisi: kondisi,
      p_foto_path: foto_path
    })
    if (error) throw error
    return data as SuratJalanItem
  }, [])

  const finalize = useCallback(async (surat_jalan_id: string) => {
    const { data, error } = await supabase.rpc('finalize_surat_jalan', {
      p_surat_jalan_id: surat_jalan_id
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  return { create, send, verify, finalize }
}
