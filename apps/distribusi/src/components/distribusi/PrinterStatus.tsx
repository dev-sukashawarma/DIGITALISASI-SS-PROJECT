// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { usePrinterStore } from '@/utils/printer/printerStore'
import { connectBluetoothPrinter, autoConnectBluetoothPrinter } from '@/utils/printer/bluetooth-printer'

export function PrinterStatus() {
  const { device, isConnecting, disconnect, error } = usePrinterStore()

  // Try auto-connecting to Bluetooth printer on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      autoConnectBluetoothPrinter();
      window.removeEventListener('click', handleFirstInteraction, true);
      window.removeEventListener('touchstart', handleFirstInteraction, true);
    };

    window.addEventListener('click', handleFirstInteraction, true);
    window.addEventListener('touchstart', handleFirstInteraction, true);

    return () => {
      window.removeEventListener('click', handleFirstInteraction, true);
      window.removeEventListener('touchstart', handleFirstInteraction, true);
    };
  }, []);

  return (
    <button
      onClick={() => {
        if (device) disconnect();
        else connectBluetoothPrinter();
      }}
      disabled={isConnecting}
      title={device ? 'Printer Terkoneksi' : 'Koneksikan Printer Bluetooth'}
      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-wait
        ${device 
          ? 'bg-suka-ink border border-suka-ink text-white hover:bg-suka-ink/80' 
          : 'bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5'
        }`}
    >
      <Printer size={16} className={isConnecting ? 'animate-pulse' : ''} />
    </button>
  )
}
