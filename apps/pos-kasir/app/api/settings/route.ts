import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Menggunakan service role key untuk bypass RLS (hanya jika diperlukan)
// Tapi karena kita menggunakan cookie-based client, kita bisa panggil server client biasa.
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.from('global_settings').select('*')
    if (error) throw error

    const settings = data.reduce((acc: any, row: any) => {
      acc[row.key] = row.value
      return acc
    }, {})

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verifikasi role admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { brand_name, brand_logo } = body

    // Update settings
    if (brand_name !== undefined) {
      await supabase.from('global_settings').upsert({ key: 'brand_name', value: brand_name, updated_at: new Date().toISOString() })
    }
    if (brand_logo !== undefined) {
      await supabase.from('global_settings').upsert({ key: 'brand_logo', value: brand_logo, updated_at: new Date().toISOString() })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
