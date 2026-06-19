import type { LeaderboardEntry } from '@/lib/leaderboard'
import { rupiah } from '@/lib/format'

export function OutletLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <h2 className="font-semibold text-suka-brown mb-3">Leaderboard Outlet</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b">
          <tr><th className="py-1">#</th><th>Outlet</th><th className="text-right">Omzet</th><th className="text-right">Order</th><th className="text-right">AOV</th><th className="text-right">vs lalu</th></tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.outlet_id} className="border-b last:border-0">
              <td className="py-1">{i + 1}</td>
              <td>{e.outlet_name}</td>
              <td className="text-right">{rupiah(e.omzet)}</td>
              <td className="text-right">{e.orders}</td>
              <td className="text-right">{rupiah(e.aov)}</td>
              <td className={'text-right ' + (e.deltaPct == null ? 'text-gray-400' : e.deltaPct >= 0 ? 'text-green-600' : 'text-red-600')}>
                {e.deltaPct == null ? '—' : `${e.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(e.deltaPct)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
