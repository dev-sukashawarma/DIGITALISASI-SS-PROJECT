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
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      
      setParsedData(data)

      const ordersMap = new Map()
      for (const row of data as any[]) {
         const orderId = row['Order ID']
         if (!orderId) continue
         
         if (!ordersMap.has(orderId)) {
            ordersMap.set(orderId, {
               id: orderId,
               status: row['Order Status'],
               date: row['Created Time'] || null,
               subtotal: 0,
               discount: 0,
               total: parseFloat(row['Order Amount'] || '0'),
               items: []
            })
         }
         
         const order = ordersMap.get(orderId)
         
         const qty = parseInt(row['Quantity'] || '1', 10)
         const itemDiscount = parseFloat(row['SKU Platform Discount'] || '0') + parseFloat(row['SKU Seller Discount'] || '0')
         
         order.items.push({
            product_name: row['Product Name'],
            sku_name: row['Seller SKU'] || row['Variation'],
            qty: qty,
            unit_price: parseFloat(row['SKU Unit Original Price'] || '0'),
            discount: itemDiscount,
            subtotal: parseFloat(row['SKU Subtotal After Discount'] || '0')
         })
         
         order.subtotal += parseFloat(row['SKU Subtotal Before Discount'] || '0')
         order.discount += itemDiscount
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
