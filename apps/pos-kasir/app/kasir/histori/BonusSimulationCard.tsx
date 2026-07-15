import { formatRupiah } from '@/lib/validations'
import { Calculator } from 'lucide-react'

interface BonusSimulationCardProps {
  targetAmount: number;
  bonusAmount: number;
}

export default function BonusSimulationCard({ targetAmount, bonusAmount }: BonusSimulationCardProps) {
  return (
    <div className="card p-5 shadow-sm border border-gray-100 bg-blue-50/30 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">Simulasi Bonus Harian</h3>
      </div>
      <div className="text-sm text-gray-500">
        Simulasikan pencapaian target dan perkiraan bonus per orang.
      </div>
    </div>
  )
}
