'use client';

import React from 'react';
import { useAuth } from '@suka/auth';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GlobalOutletFilter({ outlets }: { outlets: {id: string, name: string}[] }) {
  const { outletStaff } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const selected = searchParams.get('outlet_id') || 'all';
  
  // Jika role adalah regional manager, sembunyikan dropdown outlet
  if (outletStaff?.role === 'regional_manager') {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') {
      params.delete('outlet_id');
    } else {
      params.set('outlet_id', val);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="outlet-filter" className="text-xs font-bold text-suka-brown hidden sm:block uppercase tracking-wider">
        Outlet
      </label>
      <select
        id="outlet-filter"
        value={selected}
        onChange={handleChange}
        className="block w-full sm:w-48 rounded-full border border-suka-brown/20 bg-white/50 py-1.5 pl-3 pr-8 text-suka-brown text-xs font-bold ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all cursor-pointer shadow-sm appearance-none"
      >
        <option value="all">Semua Outlet (Agregat)</option>
        {outlets.map(outlet => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
    </div>
  );
}
