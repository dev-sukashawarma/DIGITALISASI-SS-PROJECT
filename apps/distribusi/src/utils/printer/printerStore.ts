import { create } from 'zustand';

// Mendefinisikan tipe dasar Web Bluetooth yang mungkin belum ada di TypeScript standard lib
export interface WebBluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    disconnect: () => void;
  };
}

interface PrinterState {
  device: WebBluetoothDevice | null;
  characteristic: any | null; // BluetoothRemoteGATTCharacteristic
  isConnecting: boolean;
  error: string | null;
  setDevice: (device: WebBluetoothDevice, characteristic: any) => void;
  disconnect: () => void;
  setConnecting: (status: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  device: null,
  characteristic: null,
  isConnecting: false,
  error: null,

  setDevice: (device, characteristic) => {
    // Dengarkan event disconnect dari device
    device.addEventListener('gattserverdisconnected', () => {
      console.log('Bluetooth Printer disconnected');
      set({ device: null, characteristic: null });
    });
    set({ device, characteristic, error: null, isConnecting: false });
  },

  disconnect: () => {
    const { device } = get();
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    set({ device: null, characteristic: null, error: null });
  },

  setConnecting: (status) => set({ isConnecting: status }),
  
  setError: (error) => set({ error, isConnecting: false }),
}));
