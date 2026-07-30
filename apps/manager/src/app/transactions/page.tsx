import React from 'react';
import { ArrowRight, Search } from 'lucide-react';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Live Transaksi Area</h2>
        <div className="relative w-full sm:w-64">
          <input 
            type="text" 
            placeholder="Cari no. order..." 
            className="w-full pl-10 pr-4 py-3 min-h-[48px] bg-white border border-suka-brown/10 rounded-full text-sm font-bold text-suka-brown placeholder:text-suka-gray-300 focus:outline-none focus:ring-2 focus:ring-suka-orange/50 focus:border-suka-orange shadow-sm"
          />
          <Search className="absolute left-4 top-3.5 text-suka-gray-300 w-5 h-5" />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
        <div className="p-4 border-b border-suka-brown/5 flex justify-between items-center">
          <h3 className="font-bold text-suka-brown">5 Transaksi Terakhir</h3>
          <button className="text-xs text-suka-orange font-black uppercase tracking-wider flex items-center gap-1 hover:text-suka-brown transition-colors">
            Lihat Semua <ArrowRight size={14} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-suka-brown/5">
            {[
              { time: '14:32', outlet: 'SS Empang', order: 'ORD-001', total: 'Rp 45.000', method: 'QRIS', color: 'bg-suka-green/10 text-suka-green' },
              { time: '14:28', outlet: 'SS Bcc', order: 'ORD-089', total: 'Rp 120.000', method: 'Cash', color: 'bg-suka-gray-100 text-suka-gray-500' },
              { time: '14:15', outlet: 'SS Dramaga', order: 'ORD-042', total: 'Rp 30.000', method: 'QRIS', color: 'bg-suka-green/10 text-suka-green' },
            ].map((tx, idx) => (
              <div key={idx} className="p-4 hover:bg-suka-orange/5 transition-colors cursor-pointer group flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-black text-suka-brown">{tx.outlet}</span>
                    <div className="text-xs font-bold text-suka-gray-400 font-mono mt-1">{tx.order}</div>
                  </div>
                  <span className="text-sm font-bold text-suka-gray-400 group-hover:text-suka-orange transition-colors">{tx.time}</span>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-lg font-black text-suka-brown">{tx.total}</span>
                  <span className={`px-2.5 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-full ${tx.color}`}>
                    {tx.method}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table min-w-full divide-y divide-suka-brown/5">
            <thead className="bg-suka-cream/50">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">Waktu</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">Outlet</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">No. Order</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">Total</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">Metode</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-suka-brown/5">
              <tr className="hover:bg-suka-orange/5 transition-colors cursor-pointer group">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-suka-gray-400 group-hover:text-suka-orange transition-colors">14:32</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">SS Empang</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-suka-gray-400 font-mono bg-suka-gray-50 rounded px-2 py-1 inline-flex mt-3 ml-4">ORD-001</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">Rp 45.000</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-full bg-suka-green/10 text-suka-green">QRIS</span>
                </td>
              </tr>
              <tr className="hover:bg-suka-orange/5 transition-colors cursor-pointer group">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-suka-gray-400 group-hover:text-suka-orange transition-colors">14:28</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">SS Bcc</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-suka-gray-400 font-mono bg-suka-gray-50 rounded px-2 py-1 inline-flex mt-3 ml-4">ORD-089</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">Rp 120.000</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-full bg-suka-gray-100 text-suka-gray-500">Cash</span>
                </td>
              </tr>
              <tr className="hover:bg-suka-orange/5 transition-colors cursor-pointer group">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-suka-gray-400 group-hover:text-suka-orange transition-colors">14:15</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">SS Dramaga</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-suka-gray-400 font-mono bg-suka-gray-50 rounded px-2 py-1 inline-flex mt-3 ml-4">ORD-042</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-suka-brown">Rp 30.000</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-full bg-suka-green/10 text-suka-green">QRIS</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
