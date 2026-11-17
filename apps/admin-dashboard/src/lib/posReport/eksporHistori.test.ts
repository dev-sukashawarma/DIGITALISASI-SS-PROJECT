// @vitest-environment node
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computeTableFooter, type OrderRow } from '@/lib/posReport/compute'
import { buildHistoriTransaksiExport } from '@/lib/posReport/eksporHistori'
import { namaBerkasHistori, susunPdfHistoriTransaksi } from '@/lib/posReport/eksporHistoriPdf'

const outlets = [
  { id: 'out-1', name: 'SUKA SHAWARMA EMPANG' },
  { id: 'out-2', name: 'MITRA CIBINONG' },
]

function makeOrders(): OrderRow[] {
  return [
    {
      id: 'o-1',
      order_number: 101,
      status: 'completed',
      payment_method: 'qris',
      total_amount: 45000,
      discount_amount: 5000,
      promo_subsidy: 0,
      scheduled_promo_names: ['Promo Siang'],
      created_at: '2026-11-17T05:15:00Z',
      outlet_id: 'out-1',
      channel: null,
      sales_source: 'pos_kasir',
      customer_name: 'Budi',
      cashier_name: 'Rina',
      customer_receipt_print_count: 0,
      customer_receipt_skipped: true,
      kitchen_receipt_print_count: 1,
      kitchen_receipt_skipped: false,
      order_items: [
        {
          id: 'oi-1',
          menu_item_name: 'PAKET NONGKI 1',
          quantity: 1,
          unit_price: 50000,
          subtotal: 50000,
          package_choices: { Minuman: 'Ice Tea' },
        },
        {
          id: 'oi-2',
          menu_item_name: 'Extra Keju',
          quantity: 1,
          unit_price: 0,
          subtotal: 0,
          is_promo_reward: true,
          promo_name: 'BOGO Keju',
          promo_buy_quantity: 1,
          promo_get_quantity: 1,
        },
      ],
    } as any,
    {
      id: 'o-2',
      order_number: 102,
      status: 'completed',
      payment_method: 'gofood',
      total_amount: 40000,
      discount_amount: 0,
      promo_subsidy: 10000,
      settlement_promo_merchant: 6000,
      created_at: '2026-11-17T06:30:00Z',
      outlet_id: 'out-2',
      channel: 'gofood',
      sales_source: 'gofood',
      customer_name: 'Sari',
      cashier_name: null,
      order_items: [
        {
          id: 'oi-3',
          menu_item_name: 'Original Ayam Jumbo',
          quantity: 1,
          unit_price: 40000,
          subtotal: 40000,
        },
      ],
    } as any,
  ]
}

describe('eksporHistori & eksporHistoriPdf', () => {
  it('memetakan rincian transaksi sesuai kolom tabel Histori Transaksi Detail', () => {
    const orders = makeOrders()
    const footer = computeTableFooter(orders, [])
    const res = buildHistoriTransaksiExport({
      tableRows: orders,
      footer,
      outlets,
      periode: { from: '2026-11-17', to: '2026-11-17' },
      isSSOnlineSelected: false,
    })

    expect(res.totalMatching).toBe(2)
    expect(res.truncated).toBe(false)
    expect(res.rows).toHaveLength(2)

    const r1 = res.rows[0]
    expect(r1.orderNumberLabel).toBe('#101')
    expect(r1.outletName).toBe('SUKA SHAWARMA EMPANG')
    expect(r1.customerName).toBe('Budi')
    expect(r1.cashierName).toBe('Rina')
    expect(r1.itemsText).toContain('1x PAKET NONGKI 1')
    expect(r1.itemsText).toContain('1x Gratis · Extra Keju')
    expect(r1.packagesText).toContain('1x PAKET NONGKI 1 (Minuman: Ice Tea)')
    expect(r1.promoBadges).toEqual(['Promo Siang', 'BUY 1 GET 1'])
    expect(r1.hasSkippedReceipt).toBe(true)
    expect(r1.originalAmount).toBe(50000)
    expect(r1.deductionNotes).toEqual(['Diskon: -Rp 5.000'])

    const bigOrderRow = buildHistoriTransaksiExport({
      tableRows: [
        {
          id: 'o-big',
          order_number: 103,
          status: 'completed',
          payment_method: 'cash',
          order_type: 'big_order',
          total_amount: 85000,
          discount_amount: 15000,
          promo_subsidy: 0,
          created_at: '2026-11-17T07:00:00Z',
          outlet_id: 'out-1',
          channel: null,
          sales_source: 'pos_kasir',
          customer_name: 'Acara Kantor',
          order_items: [{ id: 'oi-b', menu_item_name: 'Original Ayam', quantity: 4, unit_price: 25000, subtotal: 100000 }],
        } as any,
      ],
      footer: computeTableFooter([], []),
      outlets,
      periode: { from: '2026-11-17', to: '2026-11-17' },
      isSSOnlineSelected: false,
    }).rows[0]
    expect(bigOrderRow.promoBadges).toContain('Big Order -15%')
    expect(bigOrderRow.deductionNotes).toEqual(['Diskon Big Order 15%: -Rp 15.000'])

    const r2 = res.rows[1]
    expect(r2.deductionNotes).toEqual(['Promo Toko: -Rp 6.000'])
  })

  it('menghormati maxRows dan menandai truncated jika melebihi batas', () => {
    const orders = makeOrders()
    const footer = computeTableFooter(orders, [])
    const res = buildHistoriTransaksiExport({
      tableRows: orders,
      footer,
      outlets,
      periode: { from: '2026-11-17', to: '2026-11-17' },
      isSSOnlineSelected: false,
      maxRows: 1,
    })

    expect(res.totalMatching).toBe(2)
    expect(res.truncated).toBe(true)
    expect(res.rows).toHaveLength(1)
  })

  it('menyusun PDF Histori Transaksi Detail mode outlet biasa & multi-halaman tanpa error', () => {
    const baseOrders = makeOrders()
    const manyOrders: OrderRow[] = Array.from({ length: 45 }, (_, idx) => ({
      ...baseOrders[idx % 2],
      id: `o-batch-${idx}`,
      order_number: 200 + idx,
    })) as any
    const footer = computeTableFooter(manyOrders, [])
    const data = buildHistoriTransaksiExport({
      tableRows: manyOrders,
      footer,
      outlets,
      periode: { from: '2026-11-01', to: '2026-11-17' },
      isSSOnlineSelected: false,
    })

    const doc = susunPdfHistoriTransaksi(jsPDF, autoTable, data, {
      cabang: 'Semua Cabang',
      channel: 'Semua Channel',
      paymentLabel: 'Semua Metode Bayar',
      receiptLabel: 'Semua Status Struk',
      search: '',
      multiOutlet: true,
    })

    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(1)
    const buf = doc.output('arraybuffer')
    expect(buf.byteLength).toBeGreaterThan(1000)
  })

  it('menyusun PDF Histori Transaksi Detail mode SS Online & membentuk nama berkas bersih', () => {
    const ecomOrder: OrderRow = {
      id: 'ec-1',
      order_number: 0,
      status: 'completed',
      payment_method: 'tiktok_shop',
      total_amount: 60000,
      discount_amount: 8000,
      promo_subsidy: 0,
      created_at: '2026-11-17T08:00:00Z',
      outlet_id: 'ss-online',
      channel: 'tiktok_shop',
      sales_source: 'Online',
      customer_name: 'SS Online Customer',
      cashier_name: null,
      order_items: [
        {
          id: 'ei-1',
          menu_item_name: 'Shawarma Frozen Pack',
          quantity: 2,
          unit_price: 35000,
          subtotal: 70000,
        },
      ],
    } as any

    const footer = computeTableFooter([ecomOrder], [])
    const data = buildHistoriTransaksiExport({
      tableRows: [ecomOrder],
      footer,
      outlets,
      periode: { from: '2026-11-17', to: '2026-11-17' },
      isSSOnlineSelected: true,
    })

    const ctx = {
      cabang: 'SS Online',
      channel: 'TikTok Seller',
      paymentLabel: 'Semua Metode Bayar',
      receiptLabel: '-',
      search: 'Frozen',
      multiOutlet: false,
    }

    const doc = susunPdfHistoriTransaksi(jsPDF, autoTable, data, ctx)
    expect(doc.internal.getNumberOfPages()).toBe(1)
    expect(namaBerkasHistori(data, ctx)).toBe('Histori_Transaksi_SS_Online_2026-11-17.pdf')
  })
})
