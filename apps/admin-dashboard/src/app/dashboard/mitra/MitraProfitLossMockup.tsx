'use client'

import React from 'react'

export function MitraProfitLossMockup({ realData }: any) {
  const { curOutletKpi, hppRate, expenses } = realData || {}
  
  // Hitung Omzet
  const omzet = (curOutletKpi || []).reduce((sum: number, r: any) => sum + r.omzet, 0)
  
  // Hitung HPP
  const hppValue = omzet * ((hppRate || 45) / 100)
  
  // Laba Kotor
  const labaKotor = omzet - hppValue

  // Hitung Pengeluaran
  const expList = expenses || []
  let gaji = 0
  let lembur = 0
  let sewa = 0
  let listrik = 0
  let bahanBaku = 0
  let marketing = 0
  let lainnya = 0

  expList.forEach((e: any) => {
    const cat = (e.category || '').toLowerCase()
    const amt = Number(e.amount) || 0
    if (cat.includes('salary') || cat.includes('gaji')) {
      gaji += amt
    } else if (cat.includes('overtime') || cat.includes('lembur')) {
      lembur += amt
    } else if (cat.includes('outlet') || cat.includes('sewa')) {
      sewa += amt
    } else if (cat.includes('utilities') || cat.includes('listrik') || cat.includes('air')) {
      listrik += amt
    } else if (cat.includes('bb') || cat.includes('bahan')) {
      bahanBaku += amt
    } else if (cat.includes('ads') || cat.includes('marketing')) {
      marketing += amt
    } else {
      lainnya += amt
    }
  })

  const totalOpex = gaji + lembur + sewa + listrik + bahanBaku + marketing + lainnya
  const labaBersih = labaKotor - totalOpex
  
  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 p-6 sm:p-8 hover:bg-white/90 transition-colors duration-500 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-suka-orange/5 rounded-bl-full -z-10"></div>
      
      <div className="flex items-center gap-3 mb-8">
        <div className="w-2 h-8 rounded-full bg-suka-orange"></div>
        <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Laporan Laba Rugi</h2>
      </div>

      <div className="space-y-6">
        
        {/* Pemasukan */}
        <div>
          <h3 className="text-sm font-extrabold text-suka-gray-400 uppercase tracking-wider mb-3">Pendapatan</h3>
          <div className="bg-white rounded-2xl p-4 border border-suka-gray-100 flex justify-between items-center shadow-sm">
            <span className="font-semibold text-suka-brown">Omzet Penjualan</span>
            <span className="font-black text-suka-brown text-lg">{formatRp(omzet)}</span>
          </div>
        </div>

        {/* HPP */}
        <div>
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex justify-between items-center">
            <div>
              <span className="font-semibold text-suka-orange block">HPP (Harga Pokok Penjualan)</span>
              <span className="text-xs text-orange-600/70 font-medium">Estimasi {hppRate}% dari Omzet</span>
            </div>
            <span className="font-black text-suka-orange text-lg">-{formatRp(hppValue)}</span>
          </div>
        </div>

        {/* Laba Kotor */}
        <div className="bg-gradient-to-r from-suka-brown to-suka-brown/90 rounded-2xl p-5 shadow-md flex justify-between items-center">
          <span className="font-bold text-white/90 uppercase tracking-widest text-sm">Laba Kotor</span>
          <span className="font-black text-white text-xl">{formatRp(labaKotor)}</span>
        </div>

        {/* OPEX */}
        <div>
          <h3 className="text-sm font-extrabold text-suka-gray-400 uppercase tracking-wider mb-3 mt-6">Biaya Operasional (OPEX)</h3>
          <div className="bg-white rounded-2xl border border-suka-gray-100 overflow-hidden shadow-sm divide-y divide-suka-gray-50">
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Gaji Karyawan</span>
              <span className="font-bold text-suka-brown">{formatRp(gaji)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Lembur & Insentif</span>
              <span className="font-bold text-suka-brown">{formatRp(lembur)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Sewa Outlet / Lapak</span>
              <span className="font-bold text-suka-brown">{formatRp(sewa)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Listrik, Air & Internet</span>
              <span className="font-bold text-suka-brown">{formatRp(listrik)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Bahan Baku Tambahan</span>
              <span className="font-bold text-suka-brown">{formatRp(bahanBaku)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Marketing & Iklan</span>
              <span className="font-bold text-suka-brown">{formatRp(marketing)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Lain-lain</span>
              <span className="font-bold text-suka-brown">{formatRp(lainnya)}</span>
            </div>
          </div>
          <div className="mt-3 bg-red-50 rounded-xl p-4 border border-red-100 flex justify-between items-center">
            <span className="font-semibold text-red-600">Total Pengeluaran</span>
            <span className="font-black text-red-600">-{formatRp(totalOpex)}</span>
          </div>
        </div>

        {/* Laba Bersih */}
        <div className={`mt-8 rounded-[24px] p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl ${
          labaBersih >= 0 
            ? 'bg-gradient-to-br from-suka-green to-green-600 shadow-green-600/20' 
            : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20'
        }`}>
          <div>
            <span className="block text-white/80 font-bold uppercase tracking-widest text-xs mb-1">Laba Bersih Outlet</span>
            <span className="block text-white/90 text-sm">Estimasi keuntungan bersih periode ini</span>
          </div>
          <span className="font-black text-white text-3xl sm:text-4xl tracking-tighter tabular-nums drop-shadow-sm">
            {formatRp(labaBersih)}
          </span>
        </div>

      </div>
    </div>
  )
}
