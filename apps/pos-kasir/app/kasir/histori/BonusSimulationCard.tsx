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
    <div className="card p-5 shadow-sm border border-blue-100 bg-blue-50/30 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">Simulasi Bonus Harian</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kontrol Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Jumlah Crew Hadir
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="number"
                min="1"
                value={crewCount || ''}
                onChange={(e) => setCrewCount(parseInt(e.target.value) || 0)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="flex justify-between block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span>Simulasi Penjualan</span>
              <span className="text-blue-600">{formatRupiah(simulatedSales)}</span>
            </label>
            <input
              type="range"
              min="0"
              max={maxSales}
              step="10000"
              value={simulatedSales}
              onChange={(e) => setSimulatedSales(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
              <span>Rp 0</span>
              <span>Target: {formatRupiah(targetAmount)}</span>
              <span>{formatRupiah(maxSales)}</span>
            </div>
          </div>
        </div>

        {/* Hasil Simulasi */}
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
          {/* Progress bar background for visual flair */}
          <div 
            className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ease-out ${isReached ? 'bg-green-500' : 'bg-gray-200'}`} 
            style={{ width: `${Math.min(100, (simulatedSales / targetAmount) * 100)}%` }}
          />
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 mb-3">
              <TrendingUp className={`w-5 h-5 ${isReached ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Perkiraan Bonus per Orang
            </p>
            <p className={`text-3xl font-black ${isReached ? 'text-green-600' : 'text-gray-400'}`}>
              {formatRupiah(bonusPerPerson)}
            </p>
            <p className="text-xs font-medium text-gray-400 mt-2">
              {isReached 
                ? `Total bonus ${formatRupiah(totalBonus)} dibagi ${crewCount} orang` 
                : 'Target harian belum tercapai'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
