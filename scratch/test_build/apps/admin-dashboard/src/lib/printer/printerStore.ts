'use client'

import { useSyncExternalStore } from 'react'

export interface WebBluetoothDevice extends EventTarget {
  id: string
  name?: string
  gatt?: {
    connected: boolean
    disconnect: () => void
  }
}

export interface PrinterState {
  device: WebBluetoothDevice | null
  characteristic: any | null // BluetoothRemoteGATTCharacteristic
  isConnecting: boolean
  error: string | null
}

let state: PrinterState = {
  device: null,
  characteristic: null,
  isConnecting: false,
  error: null,
}

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function setState(patch: Partial<PrinterState>) {
  state = { ...state, ...patch }
  emit()
}

export const printerStore = {
  getState(): PrinterState {
    return state
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setDevice(device: WebBluetoothDevice, characteristic: any) {
    device.addEventListener('gattserverdisconnected', () => {
      setState({ device: null, characteristic: null })
    })
    setState({ device, characteristic, error: null, isConnecting: false })
  },
  disconnect() {
    if (state.device?.gatt?.connected) {
      state.device.gatt.disconnect()
    }
    setState({ device: null, characteristic: null, error: null })
  },
  setConnecting(status: boolean) {
    setState({ isConnecting: status })
  },
  setError(error: string | null) {
    setState({ error, isConnecting: false })
  },
}

/** Hook React untuk membaca state store (re-render saat berubah). */
export function usePrinterState(): PrinterState {
  return useSyncExternalStore(
    printerStore.subscribe,
    printerStore.getState,
    printerStore.getState, // server snapshot (SSR) = state awal
  )
}
