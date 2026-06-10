'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { SuratJalan, SuratJalanItem } from '@/types/distribusi'

// List all Surat Jalan (SPV sees all; crew sees own outlet)
export function useSuratJalanList(outlet_id?: string, status?: string) {
  const [data, setData] = useState<SuratJalan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let query = supabase.from('surat_jalan').select('*')

    if (outlet_id) query = query.eq('outlet_id', outlet_id)
    if (status) query = query.eq('status', status)

    query.order('created_at', { ascending: false }).then(({ data }: any) => {
      setData((data as SuratJalan[]) ?? [])
      setLoading(false)
    })
  }, [outlet_id, status])

  return { suratJalanList: data, loading }
}

// Load single Surat Jalan + its items
export function useSuratJalanDetail(suratJalanId: string | undefined) {
  const [sj, setSj] = useState<SuratJalan | null>(null)
  const [items, setItems] = useState<SuratJalanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!suratJalanId) return
    const supabase = createClient()
    supabase.from('surat_jalan').select('*').eq('id', suratJalanId).single()
      .then(({ data }: any) => setSj(data as SuratJalan))
    supabase.from('surat_jalan_item').select('*').eq('surat_jalan_id', suratJalanId)
      .then(({ data }: any) => {
        setItems((data as SuratJalanItem[]) ?? [])
        setLoading(false)
      })
  }, [suratJalanId])

  return { sj, items, loading }
}

// RPC: create_surat_jalan
export function useSuratJalanActions() {
  const supabase = createClient()

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
