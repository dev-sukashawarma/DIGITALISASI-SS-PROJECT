'use client';

import React, { useState } from 'react';

export default function GlobalOutletFilter() {
  const [selected, setSelected] = useState('all');
  
  // Dummy outlets data for now
  const outlets = [
    { id: '1', name: 'SS Empang' },
    { id: '2', name: 'SS Bcc' },
    { id: '3', name: 'SS Dramaga' },
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="outlet-filter" className="text-xs font-bold text-suka-brown hidden sm:block uppercase tracking-wider">
        Outlet
      </label>
      <select
        id="outlet-filter"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
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
