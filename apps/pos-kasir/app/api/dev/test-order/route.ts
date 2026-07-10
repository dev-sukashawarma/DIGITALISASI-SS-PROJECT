import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { posOutletId } = await req.json();

    if (!posOutletId) {
      return NextResponse.json({ error: "posOutletId wajib dikirim" }, { status: 400 });
    }

    // Bikin client ke Sistem Order menggunakan SERVICE ROLE KEY untuk memotong RLS
    // Kredensial di-hardcode khusus untuk dev testing agar tidak perlu repot setup env di Vercel
    const SS_ORDER_URL = "https://qntuhtkujpwudcpudwbj.supabase.co";
    const SS_ORDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4";

    if (!SS_ORDER_URL || !SS_ORDER_KEY) {
      return NextResponse.json({ error: "Kredensial SS_ORDER tidak ditemukan" }, { status: 500 });
    }

    const orderSystemSupabase = createClient(SS_ORDER_URL, SS_ORDER_KEY);

    // 0. Dapatkan ID Outlet di Sistem Order berdasarkan pos_outlet_id kasir
    const { data: outletData, error: outletErr } = await orderSystemSupabase
      .from('outlets')
      .select('id')
      .eq('pos_outlet_id', posOutletId)
      .limit(1)
      .single();

    if (outletErr || !outletData) {
      return NextResponse.json({ error: "Outlet Kasir ini belum dipetakan ke Sistem Order." }, { status: 404 });
    }

    // 1. Ambil menu test di Sistem Order
    const { data: menuData, error: menuErr } = await orderSystemSupabase
      .from('menu_items')
      .select('*')
      .ilike('name', '%tes%')
      .limit(1)
      .single();

    if (menuErr || !menuData) {
      return NextResponse.json({ error: 'Menu dengan nama "tes" tidak ditemukan di database Sistem Order! Buat menu tersebut di dashboard Sistem Order terlebih dahulu.' }, { status: 404 });
    }

    // 2. Buat ID order_number (random 4 digit)
    const orderNumberStr = 'ORD-TEST-' + String(Math.floor(Math.random() * 9000) + 1000);
    
    // Setup pickup_time agar order mendarat di tab Terjadwal.
    // Set 21 menit dari sekarang agar bisa ditest.
    const pickupDate = new Date(Date.now() + (21 * 60 * 1000)).toISOString();

    const newOrder = {
      outlet_id: outletData.id,
      order_number: orderNumberStr,
      customer_name: 'DEV TESTER',
      customer_wa: '08123456789',
      status: 'paid', // Supaya memicu OnlineOrderSync!
      payment_method: 'qris',
      total: menuData.price,
      subtotal: menuData.price,
      service_fee: 0,
      pickup_time: pickupDate,
      notes: 'Ini adalah pesanan otomatis dari tombol DEV testing.',
      channel: 'online'
    };

    const { data: orderData, error: orderErr } = await orderSystemSupabase
      .from('orders')
      .insert(newOrder)
      .select()
      .single();

    if (orderErr || !orderData) {
      throw new Error(orderErr.message || 'Gagal membuat pesanan di Sistem Order');
    }

    // 3. Insert item
    const newOrderItem = {
      order_id: orderData.id,
      menu_item_id: menuData.id,
      item_name: menuData.name,
      quantity: 1,
      unit_price: menuData.price,
      subtotal: menuData.price,
      note: 'Menu test dev'
    };

    const { error: itemErr } = await orderSystemSupabase
      .from('order_items')
      .insert(newOrderItem);

    if (itemErr) {
      throw new Error(itemErr.message);
    }

    return NextResponse.json({ success: true, order: orderData });

  } catch (err: any) {
    console.error("Test order error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan internal" }, { status: 500 });
  }
}
