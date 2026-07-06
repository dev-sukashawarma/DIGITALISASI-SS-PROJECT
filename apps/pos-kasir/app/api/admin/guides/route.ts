import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Buku Panduan adalah konten bantuan publik — dibaca lewat service client agar
// selalu tampil untuk semua pengguna (termasuk yang belum login), tidak terhalang
// RLS pada tabel `guides`. Tulis/ubah (POST/PUT/DELETE) tetap dibatasi admin.
export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('system_guides')
      .select('id, category, title, content_html, image_url, sort_order')
      .eq('system_code', 'pos')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await createClient()

    // Verify admin (pakai user client untuk baca sesi & role)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await auth.from('outlet_staff').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { category, title, content_html, image_url, sort_order } = body

    // Tulis pakai service client agar tidak terhalang RLS tabel `guides`
    const db = createServiceClient()
    const { data, error } = await db
      .from('system_guides')
      .insert([{ system_code: 'pos', category, title, content_html, image_url, sort_order }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await createClient()

    // Verify admin (pakai user client untuk baca sesi & role)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await auth.from('outlet_staff').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { id, category, title, content_html, image_url, sort_order } = body

    // Update pakai service client agar tidak terhalang RLS tabel `guides`
    const db = createServiceClient()
    const { data, error } = await db
      .from('system_guides')
      .update({ category, title, content_html, image_url, sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await createClient()

    // Verify admin (pakai user client untuk baca sesi & role)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await auth.from('outlet_staff').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    // Hapus pakai service client agar tidak terhalang RLS tabel `guides`
    const db = createServiceClient()
    const { error } = await db.from('system_guides').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
