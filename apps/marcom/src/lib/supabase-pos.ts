import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'

export function getPosSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawKey || rawKey.trim().length === 0 || rawKey === 'undefined') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum di-set. Set di panel Coolify app ini ' +
        '(dan pastikan ARG/ENV-nya ada di stage runner Dockerfile), lalu redeploy.'
    )
  }
  const key = rawKey.trim()

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export type PosMenuItem = {
  id: string
  name: string
  price: number
  categoryId?: string
  categoryName?: string
}

export async function fetchPosMenuItems(): Promise<PosMenuItem[]> {
  try {
    const supabase = getPosSupabase()
    const [{ data: categories }, { data: items, error }] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase
        .from('menu_items')
        .select('id, name, price, category_id, is_available')
        .eq('is_available', true)
        .order('name', { ascending: true })
    ])

    if (error || !items) {
      console.error('Error fetching POS menu items:', error)
      return []
    }

    const catMap = new Map((categories || []).map((c: any) => [c.id, c.name]))

    return items.map((it: any) => ({
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      categoryId: it.category_id || undefined,
      categoryName: catMap.get(it.category_id) || 'Menu Lainnya',
    }))
  } catch (err) {
    console.error('fetchPosMenuItems failed:', err)
    return []
  }
}

export type PosOutlet = {
  id: string
  name: string
  slug?: string | null
  type: string
  region?: string | null
  address?: string | null
  phone?: string | null
  isActive: boolean
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
}

export async function fetchPosOutlets(): Promise<PosOutlet[]> {
  try {
    const supabase = getPosSupabase()
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error fetching POS outlets:', error)
      return []
    }

    return (data as Array<Record<string, unknown>>).map((o) => ({
      id: String(o.id),
      name: String(o.name || ''),
      slug: (o.slug as string) || null,
      type: (o.type as string) || 'outlet',
      region: (o.region as string) || null,
      address: (o.address as string) || null,
      phone: (o.phone as string) || null,
      isActive: (o.is_active as boolean) ?? true,
      bankName: (o.bank_name as string) || null,
      bankAccountNumber: (o.bank_account_number as string) || null,
      bankAccountName: (o.bank_account_name as string) || null,
    }))
  } catch (err) {
    console.error('fetchPosOutlets failed:', err)
    return []
  }
}

