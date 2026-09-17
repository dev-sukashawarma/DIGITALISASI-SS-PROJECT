import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const FALLBACK_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

export function getPosSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key =
    rawKey && rawKey.trim().length > 0 && rawKey !== 'undefined'
      ? rawKey.trim()
      : FALLBACK_SERVICE_ROLE_KEY

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

