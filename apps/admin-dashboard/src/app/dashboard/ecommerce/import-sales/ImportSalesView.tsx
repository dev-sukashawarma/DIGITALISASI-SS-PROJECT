'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'

export default function ImportSalesView() {
  const supabase = createClient()
  const { data: channels = [], isLoading: loadingC } = useQuery<any[]>({ 
    queryKey: ['ecommerce_channels'],
    queryFn: async () => {
      const { data } = await supabase.from('ecommerce_channels').select('*').order('name')
      return data || []
    }
  })
  const { data: entities = [], isLoading: loadingE } = useQuery<any[]>({ 
    queryKey: ['ecommerce_entities'],
    queryFn: async () => {
      const { data } = await supabase.from('ecommerce_entities').select('*').order('name')
      return data || []
    }
  })

  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [selectedEntityId, setSelectedEntityId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [ordersPayload, setOrdersPayload] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [deductStock, setDeductStock] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string; processed?: number } | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      
      const buffer = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

      const parseNum = (val: any): number => {
        if (val === null || val === undefined) return 0
        if (typeof val === 'number') return isNaN(val) ? 0 : val
        const str = String(val).trim().replace(/[^0-9.,-]/g, '')
        if (!str) return 0
        if (str.includes(',') && !str.includes('.')) {
          return parseFloat(str.replace(',', '.')) || 0
        }
        if (str.includes('.') && str.includes(',')) {
          if (str.indexOf('.') < str.indexOf(',')) {
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
          } else {
            return parseFloat(str.replace(/,/g, '')) || 0
          }
        }
        if (/^\d{1,3}\.\d{3}$/.test(str) || /^\d{1,3}\.\d{3}\.\d{3}$/.test(str)) {
          return parseFloat(str.replace(/\./g, '')) || 0
        }
        return parseFloat(str) || 0
      }

      // Auto-detect target sheet
      let targetSheetName = wb.SheetNames[0]
      if (wb.SheetNames.includes('Rincian per Item (Exploded)')) {
        targetSheetName = 'Rincian per Item (Exploded)'
      } else if (wb.SheetNames.includes('orders')) {
        targetSheetName = 'orders'
      } else if (wb.SheetNames.includes('Penghasilan')) {
        targetSheetName = 'Penghasilan'
      }

      const ws = wb.Sheets[targetSheetName]
      const data = XLSX.utils.sheet_to_json(ws, { raw: false })
      setParsedData(data)

      // Normalize any date value (string, Date object, or number) to ISO string
      const toISODate = (val: any): string | null => {
        if (!val) return null
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString()
        if (typeof val === 'number') {
          const utcMs = (val - 25569) * 86400 * 1000
          return new Date(utcMs).toISOString()
        }
        const str = String(val).trim()
        const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/)
        if (m) {
          const [_, day, month, year, h, mm2, s] = m
          return new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${(h||'00').padStart(2,'0')}:${(mm2||'00').padStart(2,'0')}:${(s||'00').padStart(2,'0')}+07:00`).toISOString()
        }
        const mIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
        if (mIso) {
          const [_, year, month, day, h, mm2, s] = mIso
          return new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${(h||'00').padStart(2,'0')}:${(mm2||'00').padStart(2,'0')}:${(s||'00').padStart(2,'0')}+07:00`).toISOString()
        }
        const parsed = new Date(str)
        return isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }

      const ordersMap = new Map()
      for (const row of data as any[]) {
        const orderId = row['Order ID'] || row['No. Pesanan'] || row['ID_Pesanan'] || row['Order SN'] || row['Nomor Pesanan']
        if (!orderId) continue

        const status = row['Order Status'] || row['Status Pesanan'] || row['Status'] || 'Completed'
        const rawDate = row['Created Time'] || row['Waktu Pesanan Dibuat'] || row['Waktu Pembayaran Dilakukan'] || row['Tanggal_Order'] || row['Order Creation Date'] || row['Waktu Pesanan Selesai']
        const date = toISODate(rawDate)

        const productName = row['Product Name'] || row['Nama Produk'] || row['Nama_Produk'] || 'Unknown Item'
        const skuName = row['Seller SKU'] || row['Variation'] || row['Nomor Referensi SKU'] || row['SKU_Penjual'] || row['Nama Variasi'] || row['SKU Induk'] || ''
        const qty = parseInt(row['Quantity'] || row['Jumlah'] || row['Qty_Pcs'] || row['Qty'] || '1', 10) || 1
        
        const unitPrice = parseNum(row['Harga Setelah Diskon'] || row['Harga_Satuan_Promo'] || row['SKU Unit Original Price'] || row['Harga Awal'] || row['Harga_Satuan_Katalog'] || row['Harga Satuan'] || 0)
        const subtotal = parseNum(row['SKU Subtotal After Discount'] || row['Total_Nilai_Katalog'] || row['Subtotal Pesanan'] || (unitPrice * qty))
        const itemDiscount = parseNum(row['SKU Platform Discount'] || row['Total Diskon'] || row['Diskon Dari Penjual'] || 0) + parseNum(row['SKU Seller Discount'] || row['Diskon Dari Shopee'] || 0)
        const orderAmount = parseNum(row['Order Amount'] || row['Total Pembayaran'] || row['Omset_Produk'] || row['Total Penghasilan'] || 0)

        if (!ordersMap.has(orderId)) {
          ordersMap.set(orderId, {
            id: orderId,
            status,
            date,
            subtotal: 0,
            discount: 0,
            total: orderAmount,
            items: []
          })
        }

        const order = ordersMap.get(orderId)
        order.items.push({
          product_name: productName,
          sku_name: skuName,
          qty,
          unit_price: unitPrice,
          discount: itemDiscount,
          subtotal: subtotal || (unitPrice * qty)
        })

        order.subtotal += (subtotal || (unitPrice * qty))
        order.discount += itemDiscount
        if (!order.total || order.total === 0) {
          order.total = order.subtotal - order.discount
        }
      }

      // Auto select channel if detected
      const firstRowStr = JSON.stringify(data[0] || '').toLowerCase()
      if (firstRowStr.includes('shopee') || firstRowStr.includes('pesanan')) {
        const shopeeCh = channels.find((c: any) => c.name.toLowerCase().includes('shopee'))
        if (shopeeCh && !selectedChannelId) setSelectedChannelId(shopeeCh.id)
      } else if (firstRowStr.includes('tiktok') || firstRowStr.includes('sku unit')) {
        const tiktokCh = channels.find((c: any) => c.name.toLowerCase().includes('tiktok'))
        if (tiktokCh && !selectedChannelId) setSelectedChannelId(tiktokCh.id)
      }

      if (entities.length > 0 && !selectedEntityId) {
        setSelectedEntityId(entities[0].id)
      }

      setOrdersPayload(Array.from(ordersMap.values()))
    }
  }

  const handleProcess = async () => {
    if (!selectedEntityId || !selectedChannelId || ordersPayload.length === 0) return
    setIsProcessing(true)
    setResult(null)
    
    try {
      const res = await fetch('/api/ecommerce/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: selectedEntityId,
          channel_id: selectedChannelId,
          deduct_stock: deductStock,
          orders: ordersPayload
        })
      })

      const json = await res.json()
      if (res.ok) {
        setResult({ success: true, processed: json.processed, message: json.message || 'Import berhasil.' })
        setFile(null)
        setOrdersPayload([])
      } else {
        setResult({ success: false, message: json.error || 'Terjadi kesalahan saat import' })
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  if (loadingC || loadingE) return <div className="flex justify-center p-8"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Entitas Tujuan</label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500"
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
            >
              <option value="">-- Pilih Entitas --</option>
              {entities.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">Platform / Channel</label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500"
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
            >
              <option value="">-- Pilih Channel --</option>
              {channels.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            <label className="block text-sm font-bold text-gray-800">Potong Stok Gudang Pusat</label>
            <p className="text-xs text-gray-500">Aktifkan untuk otomatis mengurangi bahan baku sesuai resep dari stok Gudang Pusat.</p>
          </div>
          <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
            <input 
              type="checkbox" 
              name="toggle" 
              id="deduct-stock-toggle"
              checked={deductStock}
              onChange={(e) => setDeductStock(e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer focus:outline-none focus:ring-0 checked:right-0 checked:border-blue-600 border-gray-300"
              style={{
                right: deductStock ? '0' : '1.5rem',
                borderColor: deductStock ? '#2563eb' : '#d1d5db',
                transition: 'all 0.2s ease-in-out',
                backgroundColor: deductStock ? '#2563eb' : '#fff'
              }}
            />
            <label 
              htmlFor="deduct-stock-toggle" 
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${deductStock ? 'bg-blue-600' : 'bg-gray-300'}`}
            ></label>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-bold text-gray-800 mb-2">Upload File Excel (.xlsx)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
            <FileSpreadsheet size={48} className="text-gray-400 mb-4" />
            <p className="text-sm text-gray-500 mb-4">Upload format Excel dari Seller Center</p>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls"
              className="hidden" 
              id="file-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-9 rounded-md px-4">
                Pilih File
              </span>
            </label>
            {file && (
              <div className="mt-4 text-sm font-bold text-gray-800">
                File terpilih: {file.name}
                <div className="text-xs font-normal text-gray-500 mt-1">
                  Ditemukan {parsedData.length} baris ({ordersPayload.length} Pesanan)
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button 
            disabled={!selectedEntityId || !selectedChannelId || ordersPayload.length === 0 || isProcessing}
            className="rounded-xl flex items-center gap-2 bg-blue-600 text-white"
            onClick={handleProcess}
          >
            {isProcessing ? <Spinner className="w-4 h-4 text-white" /> : <UploadCloud size={16} />}
            {isProcessing ? 'Memproses...' : 'Proses & Import Data'}
          </Button>
        </div>
      </div>

      {ordersPayload.length > 0 && !result && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
          <h3 className="font-bold text-gray-800 mb-4">Preview Data (Max 5 Pesanan)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Item (SKU)</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ordersPayload.slice(0, 5).map((order: any, idx: number) => (
                  <tr key={idx} className="hover:bg-amber-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{order.id}</td>
                    <td className="px-4 py-3 text-gray-600">{order.date || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {order.items.map((i: any) => `${i.qty}x ${i.sku_name || i.product_name}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      Rp {order.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ordersPayload.length > 5 && (
            <p className="text-center text-sm text-gray-500 mt-4 italic">
              ... dan {ordersPayload.length - 5} pesanan lainnya.
            </p>
          )}
        </div>
      )}
      
      {result && (
        <div className={`p-4 rounded-xl flex items-start gap-3 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
          ) : (
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          )}
          <div>
            <h4 className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? 'Import Berhasil' : 'Import Gagal'}
            </h4>
            <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message} {result.success && `(${result.processed} pesanan baru berhasil disimpan)`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
