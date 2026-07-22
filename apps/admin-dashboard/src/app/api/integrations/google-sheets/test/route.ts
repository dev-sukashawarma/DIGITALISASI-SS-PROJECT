import { NextResponse } from 'next/server'
import { sendOrderToGoogleSheets } from '@/lib/google-sheets-webhook'

export async function POST(request: Request) {
  try {
    const { url, order, items, outletName } = await request.json()

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json(
        { error: 'URL Webhook Google Apps Script tidak valid' },
        { status: 400 }
      )
    }

    const success = await sendOrderToGoogleSheets(
      url,
      order || {
        order_number: 'TEST-001',
        channel: 'POS',
        payment_method: 'QRIS',
        created_at: new Date().toISOString()
      },
      items || [
        {
          menu_item_name: 'Tes Suka Shawarma Ayam (Dummy)',
          quantity: 2,
          unit_price: 25000,
          subtotal: 50000
        }
      ],
      outletName || 'Cabang Uji Coba'
    )

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Gagal terhubung ke Google Apps Script Webhook' },
        { status: 500 }
      )
    }
  } catch (err: any) {
    console.error('Error in Google Sheets test proxy API:', err)
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan pada server proxy' },
      { status: 500 }
    )
  }
}
