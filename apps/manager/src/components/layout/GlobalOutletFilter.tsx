'use client';

import React, { useState } from 'react';
import { useAuth } from '@suka/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, Check } from 'lucide-react';

/**
 * Mempersingkat nama outlet untuk UI mobile dengan menghapus prefiks
 * seperti "Suka Shawarma", "SukaShawarma", "Mitra", "SS", dsb.
 */
export function formatShortOutletName(name: string): string {
  if (!name) return '';
  if (name === 'Semua Outlet') return 'Semua Outlet';

  const cleaned = name
    .replace(/^(suka\s*shawarma|sukashawarma|mitra\s*ss|mitra|ss\s*-?|outlet)\s*[-–—:]*\s*/i, '')
    .replace(/^[-–—:\s]+/, '')
    .trim();

  return cleaned || name;
}

export default function GlobalOutletFilter({ outlets }: { outlets: { id: string; name: string }[] }) {
  const { outletStaff } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const selected = searchParams.get('outlet_id') || 'all';
  const selectedOutlet = outlets.find(o => o.id === selected);
  const rawLabel = selected === 'all' ? 'Semua Outlet' : (selectedOutlet?.name ?? 'Outlet');
  const shortLabel = formatShortOutletName(rawLabel);

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
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all text-[11px] sm:text-xs font-bold shadow-sm cursor-pointer ${
          selected !== 'all'
            ? 'bg-suka-orange text-white border-suka-orange shadow-[0_2px_8px_rgba(249,115,22,0.3)]'
            : 'bg-white text-suka-brown border-suka-brown/20 hover:border-suka-brown/40'
        }`}
        title={rawLabel}
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="inline max-w-[100px] sm:max-w-[180px] truncate">{shortLabel}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 bg-white border border-suka-brown/10 rounded-2xl shadow-xl py-2 z-50 w-56 sm:w-64 max-h-80 overflow-y-auto animate-fade-in">
            <p className="px-4 py-1.5 text-[10px] font-black text-suka-gray-400 uppercase tracking-wider border-b border-suka-brown/5 mb-1 sticky top-0 bg-white">
              Filter Outlet
            </p>
            {[{ id: 'all', name: 'Semua Outlet' }, ...outlets].map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelect(o.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm transition-colors text-left cursor-pointer ${
                  selected === o.id
                    ? 'bg-suka-orange/10 text-suka-orange font-black'
                    : 'text-suka-gray-600 hover:bg-suka-gray-50 font-bold'
                }`}
              >
                <span className="truncate">{formatShortOutletName(o.name)}</span>
                {selected === o.id && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
