'use client'

import { useState } from 'react'
import { formatRupiah } from '@/lib/validations'
import { Calculator, Users, TrendingUp, Minus, Plus } from 'lucide-react'

interface BonusSimulationCardProps {
  targetAmount: number;
  bonusAmount: number;
}

export default function BonusSimulationCard({ targetAmount, bonusAmount }: BonusSimulationCardProps) {
  const [crewCount, setCrewCount] = useState<number>(1)
  const [isTargetReached, setIsTargetReached] = useState<boolean>(true)
  const [additionalItems, setAdditionalItems] = useState<number>(0)

  // Maximum slider value for additional items
  const maxItems = 50
  const bonusPerItem = 5000

  // Hitung bonus
  const totalBonus = isTargetReached ? bonusAmount + (additionalItems * bonusPerItem) : 0
  const bonusPerPerson = crewCount > 0 ? Math.floor(totalBonus / crewCount) : 0

  return (
    <div className="card p-4 md:p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-blue-600" strokeWidth={2} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Simulasi Bonus Tambahan</h3>
          <p className="text-sm text-gray-500">Hitung bonus ekstra per item terjual di atas target</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        {/* Kontrol Input */}
        <div className="space-y-6 w-full min-w-0 flex flex-col justify-center">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Jumlah Crew Hadir
            </label>
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm max-w-[200px]">
              <button 
                onClick={() => setCrewCount(Math.max(1, crewCount - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border border-gray-100"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 px-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-gray-900 text-lg min-w-[2ch] text-center">
                  {crewCount}
                </span>
              </div>

              <button 
                onClick={() => setCrewCount(crewCount + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border border-gray-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-semibold text-gray-700">
                Target Harian Tercapai?
              </label>
              <button
                type="button"
                onClick={() => setIsTargetReached(!isTargetReached)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isTargetReached ? 'bg-blue-600' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={isTargetReached}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isTargetReached ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            <div className={`transition-opacity duration-200 ${isTargetReached ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Item Tambahan Terjual
                </label>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  {additionalItems} Item
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={maxItems}
                step="1"
                value={additionalItems}
                onChange={(e) => setAdditionalItems(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                disabled={!isTargetReached}
              />
              <div className="flex flex-wrap justify-between items-center gap-1 text-xs text-gray-500 mt-2 font-medium">
                <span>0 Item</span>
                <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md whitespace-nowrap">Target {formatRupiah(targetAmount)}</span>
                <span>{maxItems} Item</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hasil Simulasi */}
        <div className="card p-5 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden w-full min-w-0 mt-2 lg:mt-0">
          {/* Progress bar background for visual flair */}
          <div 
            className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ease-out ${isTargetReached ? 'bg-green-500' : 'bg-gray-200'}`} 
            style={{ width: isTargetReached ? `${Math.min(100, 10 + (additionalItems / maxItems) * 90)}%` : '0%' }}
          />
          
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 ${isTargetReached ? 'bg-green-100' : 'bg-gray-100'} rounded-2xl flex items-center justify-center`}>
              <TrendingUp className={`w-5 h-5 ${isTargetReached ? 'text-green-600' : 'text-gray-400'}`} strokeWidth={2} />
            </div>
            <span className="text-gray-400 font-semibold text-sm">Perkiraan Bonus</span>
          </div>
          <p className={`text-3xl font-bold ${isTargetReached ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatRupiah(bonusPerPerson)}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {isTargetReached 
              ? `Bonus dasar + Ekstra ${additionalItems} item dibagi ${crewCount} orang` 
              : 'Target harian belum tercapai'}
          </p>
        </div>
      </div>
    </div>
  )
}
