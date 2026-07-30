import React from 'react';
import { Check, X, Clock } from 'lucide-react';

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Persetujuan (Approvals)</h2>
      </div>
      
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
        <div className="p-4 border-b border-suka-brown/5 bg-suka-cream/30 flex justify-between items-center">
          <h3 className="font-bold text-suka-brown">Antrean Petty Cash</h3>
          <span className="bg-suka-orange/10 text-suka-orange text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">2 Menunggu</span>
        </div>
        
        <div className="divide-y divide-suka-brown/5">
          {/* Item 1 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-suka-orange/5 transition-colors group">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-black text-suka-brown">SS Empang</span>
                <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={12} /> 10 Menit lalu
                </span>
              </div>
              <p className="text-sm text-suka-gray-700 font-bold">Top Up Dana Operasional / Tukar Receh</p>
              <p className="text-[11px] font-semibold text-suka-gray-400 mt-1 uppercase tracking-wider">Requested by: Rina (Kasir)</p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-4 md:mt-0">
              <span className="text-2xl sm:text-xl font-black text-suka-brown">Rp 500.000</span>
              <div className="flex gap-3 sm:gap-2">
                <button className="flex items-center justify-center w-12 h-12 sm:w-10 sm:h-10 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-full transition-all shadow-sm shrink-0">
                  <X size={20} strokeWidth={3} />
                </button>
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-5 py-3 sm:py-2.5 bg-suka-orange text-white hover:bg-suka-orange/90 rounded-full text-sm sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-suka-orange/20 hover:shadow-md hover:shadow-suka-orange/30 min-h-[48px]">
                  <Check size={18} strokeWidth={3} /> Setujui
                </button>
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-suka-orange/5 transition-colors group">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-black text-suka-brown">SS Dramaga</span>
                <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={12} /> 1 Jam lalu
                </span>
              </div>
              <p className="text-sm text-suka-gray-700 font-bold">Beli Sabun Cuci & Kantong Plastik</p>
              <p className="text-[11px] font-semibold text-suka-gray-400 mt-1 uppercase tracking-wider">Requested by: Dodi (Kasir)</p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-4 md:mt-0">
              <span className="text-2xl sm:text-xl font-black text-suka-brown">Rp 50.000</span>
              <div className="flex gap-3 sm:gap-2">
                <button className="flex items-center justify-center w-12 h-12 sm:w-10 sm:h-10 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-full transition-all shadow-sm shrink-0">
                  <X size={20} strokeWidth={3} />
                </button>
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-5 py-3 sm:py-2.5 bg-suka-orange text-white hover:bg-suka-orange/90 rounded-full text-sm sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-suka-orange/20 hover:shadow-md hover:shadow-suka-orange/30 min-h-[48px]">
                  <Check size={18} strokeWidth={3} /> Setujui
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
