'use client'

import { useState } from 'react'
import { formatRupiah } from '@/lib/validations'
import { Calculator, Users, TrendingUp } from 'lucide-react'

interface BonusSimulationCardProps {
  targetAmount: number;
  bonusAmount: number;
}

export default function BonusSimulationCard({ targetAmount, bonusAmount }: BonusSimulationCardProps) {
  const [crewCount, setCrewCount] = useState<number>(1)
  const [simulatedSales, setSimulatedSales] = useState<number>(targetAmount)

  // Maximum slider value (misal 2x target harian)
  const maxSales = Math.max(targetAmount * 2, 1000000)

  // Hitung bonus
  const isReached = simulatedSales >= targetAmount
  const totalBonus = isReached ? bonusAmount : 0
  const bonusPerPerson = crewCount > 0 ? Math.floor(totalBonus / crewCount) : 0

  return (
    <div className="card p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
          <Calculator className="w-5 h-5 text-blue-600" strokeWidth={2} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Simulasi Bonus Harian</h3>
          <p className="text-sm text-gray-500">Hitung perkiraan bonus berdasarkan target penjualan</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Kontrol Input */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Jumlah Crew Hadir
            </label>
            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
              <Users className="w-5 h-5 text-gray-400 mr-2" />
              <input
                type="number"
                min="1"
                value={crewCount || ''}
                onChange={(e) => setCrewCount(parseInt(e.target.value) || 0)}
                className="w-full bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 p-0"
                placeholder="Masukkan jumlah crew"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Simulasi Penjualan
              </label>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                {formatRupiah(simulatedSales)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={maxSales}
              step="10000"
              value={simulatedSales}
              onChange={(e) => setSimulatedSales(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
              <span>Rp 0</span>
              <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">Target: {formatRupiah(targetAmount)}</span>
              <span>{formatRupiah(maxSales)}</span>
            </div>
          </div>
        </div>

        {/* Hasil Simulasi */}
        <div className="card p-5 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden h-full">
          {/* Progress bar background for visual flair */}
          <div 
            className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ease-out ${isReached ? 'bg-green-500' : 'bg-gray-200'}`} 
            style={{ width: `${Math.min(100, (simulatedSales / targetAmount) * 100)}%` }}
          />
          
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 ${isReached ? 'bg-green-100' : 'bg-gray-100'} rounded-2xl flex items-center justify-center`}>
              <TrendingUp className={`w-5 h-5 ${isReached ? 'text-green-600' : 'text-gray-400'}`} strokeWidth={2} />
            </div>
            <span className="text-gray-400 font-semibold text-sm">Perkiraan Bonus</span>
          </div>
          <p className={`text-3xl font-bold ${isReached ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatRupiah(bonusPerPerson)}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {isReached 
              ? `Total bonus ${formatRupiah(totalBonus)} dibagi ${crewCount} orang` 
              : 'Target harian belum tercapai'}
          </p>
        </div>
      </div>
    </div>
  )
}
