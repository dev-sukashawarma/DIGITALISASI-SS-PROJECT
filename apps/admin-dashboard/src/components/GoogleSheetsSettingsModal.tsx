'use client'

import { useEffect, useState } from 'react'
import {
  FileSpreadsheet,
  X,
  Copy,
  Check,
  Send,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from '@/lib/google-sheets-config'
import { sendOrderToGoogleSheets } from '@/lib/google-sheets-webhook'

interface GoogleSheetsSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(15000); // Tunggu maks 15 detik jika ada request bersamaan
  } catch (lockError) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "System busy" })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // 1. Pilih Tab / Sheet berdasarkan Nama Cabang (Outlet Name)
    var outletName = (data.outlet_name || '').trim();
    var sheet = null;
    
    if (outletName) {
      var sheets = spreadsheet.getSheets();
      var oNameLower = outletName.toLowerCase();
      // Bersihkan kata umum untuk dapat kata kunci lokasi (misal: "empang", "pajajaran")
      var cleanKeywords = oNameLower.replace(/\b(suka|shawarma|mitra|cabang|gudang|pusat)\b/g, '').trim().split(/\s+/).filter(Boolean);

      for (var i = 0; i < sheets.length; i++) {
        var sNameLower = sheets[i].getName().toLowerCase();
        // 1. Direct match or substring match
        if (sNameLower.includes(oNameLower) || oNameLower.includes(sNameLower)) {
          sheet = sheets[i];
          break;
        }
        // 2. Keyword match (misal "empang" ada di "SS EMPANG / JULY 2026")
        for (var k = 0; k < cleanKeywords.length; k++) {
          if (cleanKeywords[k].length >= 3 && sNameLower.includes(cleanKeywords[k])) {
            sheet = sheets[i];
            break;
          }
        }
        if (sheet) break;
      }
    }
    if (!sheet) {
      sheet = spreadsheet.getActiveSheet();
    }

    // 2. Tentukan tanggal (1 - 31) dari timestamp order
    var dayOfMonth = data.day_of_month || new Date(data.timestamp || new Date()).getDate(); // 1 - 31
    var targetCol = 4 + (dayOfMonth - 1); // Kolom D = Tanggal 1 (Index 4)

    // 3. Tentukan Channel Global (Fallback)
    var globalChannel = (data.channel || '').toLowerCase();

    // 4. Pindai seluruh Kolom A untuk menemukan posisi seksi OFFLINE, FOOD APPS, TIKTOK GO
    var lastRow = sheet.getLastRow();
    var menuColumnValues = sheet.getRange(1, 1, lastRow, 1).getValues();

    var offlineStart = -1, foodAppsStart = -1, tiktokStart = -1;
    for (var r = 0; r < menuColumnValues.length; r++) {
      var val = String(menuColumnValues[r][0] || '').trim().toUpperCase();
      if (val === 'OFFLINE' || val.startsWith('OFFLINE')) offlineStart = r + 1;
      else if (val === 'FOOD APPS' || val.startsWith('FOOD APPS')) foodAppsStart = r + 1;
      else if (val === 'TIKTOK GO' || val.startsWith('TIKTOK')) tiktokStart = r + 1;
    }

    var unmatchedItems = [];
    var overwrittenCells = {};

    // 5. KAMUS PERBAIKAN TYPO (Kiri: Nama di Database POS | Kanan: Nama di Google Sheet)
    var TYPO_MAPPINGS = {
      "suka premius crispy": "suka premium crispy",
      "suka premius krispy": "suka premium crispy",
      "suka duo favorite": "suka duo favorit",
      "shawarmie duo variant": "shawarmie duo varian",
      "best seller 2 (sapi jumbo)": "best seller-sapi jumbo",
      "best seller 2 (ayam jumbo)": "best seller-ayam jumbo",
      "best seller (mix jumbo)": "best seller",
      "best seller 2": "best seller",
      "triple combo": "shawarma triple combo"
    };

    if (data.items && data.items.length > 0) {
      data.items.forEach(function(item) {
        var rawName = (item.menu_item_name || '').trim().toLowerCase();
        // Hapus prefix 'FA ' atau 'FA-' jika ada, dan ambil hanya nama menu sebelum karakter '|' (jika kebetulan masih ada)
        var cleanName = rawName.replace(/^fa[\s-]*\s*/, '').split('|')[0].trim();
        
        // Terapkan perbaikan typo secara otomatis
        if (TYPO_MAPPINGS[cleanName]) {
          cleanName = TYPO_MAPPINGS[cleanName];
        }

        var qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        var itemChannel = (item.channel || globalChannel).toLowerCase();
        var isFoodApps = itemChannel.includes('food') || itemChannel.includes('gofood') || itemChannel.includes('grabfood') || itemChannel.includes('shopeefood') || itemChannel === 'food_apps';
        var isTikTok = itemChannel.includes('tiktok') || itemChannel === 'tiktok_go';

        var matchedRow = -1;

        // Tentukan batas pencarian baris berdasarkan seksi channel
        var startR = 1, endR = lastRow;
        if (isFoodApps && foodAppsStart > 0) {
          startR = foodAppsStart;
          endR = (tiktokStart > foodAppsStart) ? tiktokStart : lastRow;
        } else if (isTikTok && tiktokStart > 0) {
          startR = tiktokStart;
          endR = lastRow;
        } else if (!isFoodApps && !isTikTok && offlineStart > 0) {
          startR = offlineStart;
          endR = (foodAppsStart > offlineStart) ? foodAppsStart : lastRow;
        }

        // Cari baris nama menu (Pass 1: EXACT MATCH)
        for (var r = startR - 1; r < endR; r++) {
          if (r >= menuColumnValues.length) break;
          var cellVal = String(menuColumnValues[r][0] || '').trim().toLowerCase();
          var cleanCellVal = cellVal.replace(/^fa[\s-]*\s*/, '').trim();
          if (cellVal && cleanCellVal === cleanName) {
            matchedRow = r + 1;
            break;
          }
        }

        // Pass 2: PARTIAL MATCH (jika exact match tidak ketemu)
        if (matchedRow === -1) {
          for (var r = startR - 1; r < endR; r++) {
            if (r >= menuColumnValues.length) break;
            var cellVal = String(menuColumnValues[r][0] || '').trim().toLowerCase();
            var cleanCellVal = cellVal.replace(/^fa[\s-]*\s*/, '').trim();
            if (cellVal && (cleanCellVal.includes(cleanName) || cleanName.includes(cleanCellVal))) {
              matchedRow = r + 1;
              break;
            }
          }
        }

        // Fallback: cari di seluruh Kolom A jika belum cocok di seksi spesifik
        if (matchedRow === -1) {
          // Pass 1 Fallback: EXACT MATCH
          for (var r = 0; r < menuColumnValues.length; r++) {
            var cellVal = String(menuColumnValues[r][0] || '').trim().toLowerCase();
            var cleanCellVal = cellVal.replace(/^fa[\s-]*\s*/, '').trim();
            if (cellVal && cleanCellVal === cleanName) {
              matchedRow = r + 1;
              break;
            }
          }
          // Pass 2 Fallback: PARTIAL MATCH
          if (matchedRow === -1) {
            for (var r = 0; r < menuColumnValues.length; r++) {
              var cellVal = String(menuColumnValues[r][0] || '').trim().toLowerCase();
              var cleanCellVal = cellVal.replace(/^fa[\s-]*\s*/, '').trim();
              if (cellVal && (cleanCellVal.includes(cleanName) || cleanName.includes(cleanCellVal))) {
                matchedRow = r + 1;
                break;
              }
            }
          }
        }

        // Jika baris menu ditemukan, tambahkan qty (PCS) pada sel tanggal bersangkutan
        if (matchedRow > 0) {
          var cellRange = sheet.getRange(matchedRow, targetCol);
          var cellKey = matchedRow + "-" + targetCol;
          
          if (data.event === 'BULK_SYNC_JULY') {
            if (!overwrittenCells[cellKey]) {
              cellRange.setValue(qty);
              overwrittenCells[cellKey] = true;
            } else {
              var currentVal = Number(cellRange.getValue()) || 0;
              cellRange.setValue(currentVal + qty);
            }
          } else {
            var currentVal = Number(cellRange.getValue()) || 0;
            cellRange.setValue(currentVal + qty);
          }
        } else {
          unmatchedItems.push({
            menu_item_name: item.menu_item_name,
            channel: itemChannel,
            quantity: qty
          });
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      result: "success", 
      unmatched_items: unmatchedItems 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`

export default function GoogleSheetsSettingsModal({ isOpen, onClose }: GoogleSheetsSettingsModalProps) {
  const [url, setUrl] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    async function loadSettings() {
      setLoading(true)
      setAlert(null)
      try {
        const supabase = createClient()
        const config = await getGoogleSheetsConfig(supabase)
        if (isMounted) {
          setUrl(config.url || '')
          setEnabled(config.enabled ?? false)
        }
      } catch (err) {
        if (isMounted) {
          setAlert({
            type: 'error',
            message: 'Gagal memuat konfigurasi Google Sheets.'
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSettings()
    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    setAlert(null)
    try {
      const supabase = createClient()
      const res = await saveGoogleSheetsConfig(supabase, { url: url.trim(), enabled })
      if (res.error) {
        setAlert({
          type: 'error',
          message: `Gagal menyimpan: ${res.error.message || 'Terjadi kesalahan'}`
        })
      } else {
        setAlert({
          type: 'success',
          message: 'Pengaturan Google Sheets berhasil disimpan!'
        })
      }
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: `Terjadi kesalahan: ${err.message || 'Gagal menyimpan'}`
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setAlert({
        type: 'error',
        message: 'Masukkan URL Webhook Google Apps Script terlebih dahulu.'
      })
      return
    }

    setTesting(true)
    setAlert(null)

    const dummyOrder = {
      order_number: 'TEST-001',
      channel: 'POS',
      payment_method: 'QRIS',
      created_at: new Date().toISOString()
    }

    const dummyItems = [
      {
        menu_item_name: 'Tes Suka Shawarma Ayam (Dummy)',
        quantity: 2,
        unit_price: 25000,
        subtotal: 50000,
        channel: 'offline'
      }
    ]

    try {
      // First try via server proxy API to bypass browser CORS restriction
      let success = false
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      try {
        const proxyRes = await fetch('/api/integrations/google-sheets/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            url: url.trim(),
            order: dummyOrder,
            items: dummyItems,
            outletName: 'Cabang Uji Coba'
          })
        })
        const data = await proxyRes.json()
        if (proxyRes.ok && data.success) {
          success = true
        }
      } catch (proxyErr) {
        // Fallback to direct client-side fetch if proxy fails
        const fallbackController = new AbortController()
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 15000)
        try {
          success = await sendOrderToGoogleSheets(
            url.trim(),
            dummyOrder,
            dummyItems,
            'Cabang Uji Coba',
            (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: fallbackController.signal })
          )
        } finally {
          clearTimeout(fallbackTimeoutId)
        }
      } finally {
        clearTimeout(timeoutId)
      }

      if (success) {
        setAlert({
          type: 'success',
          message: 'Koneksi Berhasil! Data dummy pengujian telah dikirimkan ke Google Sheets.'
        })
      } else {
        setAlert({
          type: 'error',
          message: 'Gagal terhubung ke Webhook Google Sheets. Pastikan URL benar & Web App diset akses "Anyone" (Siapa saja).'
        })
      }
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: `Koneksi gagal: ${err.message || 'Kesalahan jaringan'}`
      })
    } finally {
      setTesting(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Integrasi Real-time Google Sheets
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Sinkronkan penjualan item menu ke Google Spreadsheet secara otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Memuat pengaturan Google Sheets...</p>
            </div>
          ) : (
            <>
              {/* Alert Feedback */}
              {alert && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                    alert.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {alert.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 font-medium leading-relaxed">{alert.message}</div>
                </div>
              )}

              {/* Toggle Enable/Disable */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200/80">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-gray-900 block">
                    Status Sinkronisasi Otomatis
                  </label>
                  <p className="text-xs text-gray-500">
                    Kirim data transaksi ke Google Sheets setiap kali transaksi selesai di POS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enabled ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Input Webhook URL & Connection Test */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-900 flex items-center justify-between">
                  <span>URL Webhook Google Apps Script</span>
                  <span className="text-xs font-normal text-gray-500">Wajib diisi</span>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400 placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !url.trim()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-xl border border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Send className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>Tes Koneksi</span>
                  </button>
                </div>
              </div>

              {/* Step-by-step Setup Guide */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  <span>Panduan Setup Google Apps Script (5 Langkah Mudan)</span>
                </div>

                <ol className="space-y-2.5 text-xs text-gray-600 list-decimal list-inside font-medium leading-relaxed bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                  <li>
                    Buka <strong className="text-gray-900">Google Sheets</strong> baru atau spreadsheet yang sudah ada.
                  </li>
                  <li>
                    Klik menu <strong className="text-gray-900">Ekstensi (Extensions) &gt; Apps Script</strong> pada bilah menu atas.
                  </li>
                  <li>
                    Hapus seluruh isi kode default, lalu tempelkan skrip di bawah ini ke file <code className="bg-gray-100 text-amber-800 px-1 py-0.5 rounded font-mono">Code.gs</code>.
                  </li>
                  <li>
                    Klik <strong className="text-gray-900">Terapkan (Deploy) &gt; Penyebaran baru (New deployment)</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-gray-500">
                      <li>Jenis: <strong className="text-gray-700">Aplikasi Web (Web app)</strong></li>
                      <li>Jalankan sebagai: <strong className="text-gray-700">Saya (Me)</strong></li>
                      <li>Siapa yang memiliki akses: <strong className="text-gray-700">Siapa saja (Anyone)</strong></li>
                    </ul>
                  </li>
                  <li>
                    Klik <strong className="text-gray-900">Deploy</strong>, izinkan otorisasi Google, lalu salin <strong className="text-gray-900">URL Web App</strong> dan tempel di kolom di atas.
                  </li>
                </ol>

                {/* Code Block box with copy button */}
                <div className="relative rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/80 border-b border-gray-700/60 text-xs text-gray-300 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Code.gs (Google Apps Script Template)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-sans text-xs transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Kode</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-56 leading-relaxed">
                    {APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Pengaturan</span>
          </button>
        </div>

      </div>
    </div>
  )
}
