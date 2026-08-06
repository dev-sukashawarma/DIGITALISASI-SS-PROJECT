'use client';

import React, { useState } from 'react';
import { useAuth } from '@suka/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, Check } from 'lucide-react';

export default function GlobalOutletFilter({ outlets }: { outlets: { id: string; name: string }[] }) {
  const { outletStaff } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const selected = searchParams.get('outlet_id') || 'all';
  const selectedOutlet = outlets.find(o => o.id === selected);
  const label = selected === 'all' ? 'Semua Outlet' : (selectedOutlet?.name ?? 'Outlet');

  // Staff yang terikat ke 1 outlet tidak perlu filter
  if (outletStaff?.role === 'regional_manager') return null;
  if (!outlets || outlets.length <= 1) return null;

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') {
      params.delete('outlet_id');
    } else {
      params.set('outlet_id', val);
    }
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm ${
          selected !== 'all'
            ? 'bg-suka-orange text-white border-suka-orange shadow-[0_2px_8px_rgba(249,115,22,0.3)]'
            : 'bg-white text-suka-brown border-suka-brown/20 hover:border-suka-brown/40'
        }`}
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline max-w-[130px] truncate">{label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 bg-white border border-suka-brown/10 rounded-2xl shadow-xl py-2 z-50 w-56 animate-fade-in overflow-hidden">
            <p className="px-4 py-1.5 text-[10px] font-black text-suka-gray-400 uppercase tracking-wider border-b border-suka-brown/5 mb-1">
              Filter Outlet
            </p>
            {[{ id: 'all', name: 'Semua Outlet' }, ...outlets].map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelect(o.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                  selected === o.id
                    ? 'bg-suka-orange/10 text-suka-orange font-black'
                    : 'text-suka-gray-600 hover:bg-suka-gray-50 font-bold'
                }`}
              >
                <span className="truncate">{o.name}</span>
                {selected === o.id && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
