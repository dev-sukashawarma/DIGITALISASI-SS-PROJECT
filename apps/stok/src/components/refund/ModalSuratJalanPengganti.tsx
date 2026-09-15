'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Printer,
  X,
  Loader2,
  Truck,
  CheckCircle2,
} from 'lucide-react'
import { fetchSuratJalanDetail } from '@/app/actions/retur'
import { ReturStok } from '@/types/retur'
import { toast } from 'sonner'

export function ModalSuratJalanPengganti({
  suratJalanId,
  retur,
  isOpen,
  onClose,
}: {
  suratJalanId: string
  retur?: ReturStok
  isOpen: boolean
  onClose: () => void
}) {
  const [isPrinting, setIsPrinting] = useState(false)

  const { data: sj, isLoading, error } = useQuery({
    queryKey: ['surat_jalan_detail', suratJalanId],
    queryFn: () => fetchSuratJalanDetail(suratJalanId),
    enabled: isOpen && !!suratJalanId,
    staleTime: 30000,
  })

  if (!isOpen) return null

  const handlePrint = () => {
    if (!sj) return
    setIsPrinting(true)

    try {
      const outletObj = Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
      const outletName = (outletObj as any)?.name ?? retur?.outlets?.name ?? 'Outlet Suka Shawarma'
      const docNumber = sj.document_number ?? 'SJ-PENGGANTI'
      const tanggal = new Date(sj.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const verificationCode = sj.verification_code ?? '—'
      const refRetur = retur?.nomor_retur ?? sj.ref_retur_id ?? '—'
      const driverInfo = retur?.driver_nama
        ? `${retur.jenis_logistik?.toUpperCase()} · ${retur.driver_nama} ${
            retur.driver_plat_kendaraan ? `(${retur.driver_plat_kendaraan})` : ''
          }`
        : 'Armada Internal Central Kitchen'

      const itemsHtml = (sj.items ?? [])
        .map(
          (item: any, idx: number) => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 11px;">${idx + 1}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-weight: bold; font-size: 11px;">${
                item.bahan_baku?.nama ?? 'Bahan'
              }</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; font-weight: bold; font-family: monospace; font-size: 12px;">
                ${item.qty_dikirim} ${item.bahan_baku?.satuan ?? ''}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; color: #166534; font-weight: 600;">
                Bahan Segar / Pengganti 100% Retur
              </td>
            </tr>
          `
        )
        .join('')

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Surat Jalan Pengganti - ${docNumber}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 15px;
            }
            .logo-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .brand-title {
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 0.5px;
              color: #544437;
              text-transform: uppercase;
              margin: 0;
            }
            .brand-sub {
              font-size: 10px;
              color: #64748b;
              margin: 2px 0 0 0;
              font-weight: 600;
            }
            .doc-title {
              font-size: 14px;
              font-weight: 800;
              color: #065f46;
              background: #d1fae5;
              padding: 4px 10px;
              border-radius: 6px;
              display: inline-block;
              margin-top: 6px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 16px;
              font-size: 11px;
            }
            .meta-card {
              border: 1px solid #e2e8f0;
              background: #f8fafc;
              border-radius: 6px;
              padding: 8px 12px;
            }
            .meta-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 2px;
            }
            .meta-val {
              font-weight: 700;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #334155;
            }
            .sign-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
              margin-top: 30px;
              text-align: center;
              font-size: 11px;
            }
            .sign-box {
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 8px 6px 8px;
              height: 100px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .sign-box span {
              font-size: 10px;
              color: #64748b;
              font-weight: 600;
            }
            .sign-line {
              border-top: 1px dashed #94a3b8;
              padding-top: 4px;
              font-weight: 700;
              color: #0f172a;
            }
            .note-box {
              background: #fefce8;
              border: 1px solid #fef08a;
              border-radius: 6px;
              padding: 8px 12px;
              font-size: 10px;
              color: #854d0e;
              margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-row">
              <div>
                <h1 class="brand-title">SUKA SHAWARMA INDONESIA</h1>
                <p class="brand-sub">Central Kitchen & Distribution Hub · Jakarta</p>
                <div class="doc-title">SURAT JALAN PENGGANTI (PENGGANTIAN BAHAN RETUR)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-family: monospace; font-weight: 900; font-size: 14px; color: #0f172a;">${docNumber}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Kode: <strong style="font-family: monospace; font-size: 11px;">${verificationCode}</strong></div>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">PENGIRIM (ORIGIN)</div>
              <div class="meta-val">Central Kitchen (HQ) — Gudang Pusat</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Diterbitkan: ${tanggal}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">TUJUAN (DESTINATION)</div>
              <div class="meta-val">${outletName}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Ref. Tiket Retur: <strong>${refRetur}</strong></div>
            </div>
          </div>

          <div class="meta-card" style="margin-bottom: 15px;">
            <div class="meta-label">INFORMASI EKSPEDISI / KURIR</div>
            <div class="meta-val">${driverInfo}</div>
          </div>

          <div class="note-box">
            <strong>PERHATIAN KEDATANGAN BARANG:</strong><br />
            Dokumen ini merupakan Surat Jalan resmi penggantian bahan baku retur 1:1. Harap kru outlet memeriksa kondisi fisik dan kuantitas barang saat kedatangan sebelum melakukan konfirmasi penerimaan di sistem.
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th style="text-align: left;">Nama Bahan Baku</th>
                <th style="width: 140px; text-align: right;">Kuantitas Pengganti</th>
                <th style="width: 180px; text-align: left;">Kondisi / Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="sign-grid">
            <div class="sign-box">
              <span>Diserahkan Oleh:</span>
              <div class="sign-line">Petugas Central Kitchen</div>
            </div>
            <div class="sign-box">
              <span>Kurir / Ekspedisi:</span>
              <div class="sign-line">Pengemudi Pengantar</div>
            </div>
            <div class="sign-box">
              <span>Diterima Oleh:</span>
              <div class="sign-line">Kru / Leader Outlet</div>
            </div>
          </div>
        </body>
        </html>
      `

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(printHtml)
        doc.close()
        iframe.contentWindow?.focus()
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => {
            document.body.removeChild(iframe)
            setIsPrinting(false)
          }, 1000)
        }, 400)
      }
    } catch (err: any) {
      console.error('Gagal mencetak Surat Jalan:', err)
      toast.error('Gagal memproses dokumen Surat Jalan untuk dicetak')
      setIsPrinting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-emerald-200/60 max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header Modal */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Dokumen Resmi
              </span>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Status: {sj?.status ?? 'dikirim'}
              </span>
            </div>
            <h3 className="font-extrabold text-[#1e1b15] text-lg mt-1">
              Surat Jalan Pengganti
            </h3>
            <p className="text-xs text-gray-500 font-mono font-bold">
              {sj?.document_number ?? 'Memuat nomor dokumen...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Memuat data dokumen Surat Jalan...
            </p>
          </div>
        ) : error || !sj ? (
          <div className="p-4 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 text-center">
            Gagal memuat dokumen Surat Jalan Pengganti.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta Info Box */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block">
                  Asal Pengiriman
                </span>
                <p className="font-extrabold text-gray-900">Central Kitchen (HQ) — Gudang Pusat</p>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Diterbitkan {new Date(sj.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block">
                  Outlet Tujuan (Penerima)
                </span>
                <p className="font-extrabold text-gray-900">
                  {(Array.isArray(sj.outlets) ? sj.outlets[0]?.name : (sj.outlets as any)?.name) ?? 'Outlet'}
                </p>
                <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">
                  Ref. Retur: {retur?.nomor_retur ?? sj.ref_retur_id ?? '—'}
                </span>
              </div>

              {retur?.driver_nama && (
                <div className="sm:col-span-2 pt-2 border-t border-emerald-100 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">
                      Ekspedisi / Kurir Pengantar
                    </span>
                    <p className="font-bold text-blue-950">
                      {retur.jenis_logistik.toUpperCase()} · {retur.driver_nama}{' '}
                      {retur.driver_plat_kendaraan ? `(${retur.driver_plat_kendaraan})` : ''}
                      {retur.nomor_resi_order ? ` (Resi: ${retur.nomor_resi_order})` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Verification Code Highlight */}
            {sj.verification_code && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">
                    Kode Verifikasi Penerimaan
                  </span>
                  <p className="text-[11px] text-amber-900">
                    Gunakan kode ini saat memverifikasi kedatangan fisik barang di outlet.
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-amber-200/70 border border-amber-300 rounded-lg font-mono font-black text-amber-950 text-sm tracking-wider">
                  {sj.verification_code}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h4 className="font-extrabold uppercase text-[11px] text-gray-600 mb-2">
                Daftar Bahan Baku Pengganti 100%
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 text-[10px] font-extrabold uppercase">
                    <tr>
                      <th className="p-2.5 text-center w-8">#</th>
                      <th className="p-2.5 text-left">Nama Bahan</th>
                      <th className="p-2.5 text-right">Qty Dikirim</th>
                      <th className="p-2.5 text-left">Kondisi / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(sj.items ?? []).map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-2.5 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-gray-900">
                          {item.bahan_baku?.nama ?? 'Bahan'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-950">
                          {item.qty_dikirim} {item.bahan_baku?.satuan ?? ''}
                        </td>
                        <td className="p-2.5 text-emerald-700 font-bold">
                          Segar / Pengganti 100% Retur
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note box */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <p>
                Surat Jalan Pengganti ini resmi tercatat di ledger sistem distribusi. Saldo stok outlet akan kembali pulih 100% setelah diverifikasi kedatangannya di outlet.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-wrap gap-2">
          <div className="text-[11px] text-gray-400 font-medium italic">
            Klik tombol Cetak untuk print fisik atau simpan format PDF.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              disabled={isLoading || !sj || isPrinting}
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Cetak / Unduh PDF SJ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
