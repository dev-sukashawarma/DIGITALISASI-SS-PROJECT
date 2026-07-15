import { usePrinterStore, WebBluetoothDevice } from './printerStore';
import { EscPosEncoder } from './escpos-encoder';
import { type ReceiptData } from './printReceipt';
import { formatRupiah } from './validations';

// Standard UUIDs for Bluetooth Printers (SPP or custom GATT)
// Often thermal printers use this generic service UUID for data transfer:
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

// Some use these custom UUIDs (very common for Chinese thermal printers like PANDA PRJ-58D)
const CUSTOM_SERVICE_UUID_1 = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const CUSTOM_CHARACTERISTIC_UUID_1 = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const CUSTOM_SERVICE_UUID_2 = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const CUSTOM_CHARACTERISTIC_UUID_2 = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

const SERVICES = [
  PRINTER_SERVICE_UUID,
  CUSTOM_SERVICE_UUID_1,
  CUSTOM_SERVICE_UUID_2,
  '000018f0-0000-1000-8000-00805f9b34fb' // commonly used generic 16-bit UUID
];

async function connectToDevice(device: BluetoothDevice, store: any) {
  if (!device.gatt) throw new Error('Perangkat tidak mendukung GATT Bluetooth.');

  const server = await device.gatt.connect();
  let targetCharacteristic = null;

  for (const serviceUuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid.toLowerCase());
      const characteristics = await service.getCharacteristics();
      targetCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      if (targetCharacteristic) break;
    } catch (err) {
      // Skip
    }
  }

  if (!targetCharacteristic) {
    throw new Error('Tidak menemukan layanan cetak pada printer ini. Pastikan ini adalah printer thermal yang kompatibel.');
  }

  store.setDevice(device as WebBluetoothDevice, targetCharacteristic);
  
  // Simpan ID agar bisa auto-connect nantinya
  if (device.id) {
    localStorage.setItem('saved_printer_id', device.id);
  }
  
  return true;
}

export async function connectBluetoothPrinter() {
  const store = usePrinterStore.getState();
  store.setConnecting(true);

  try {
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome versi terbaru.');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [CUSTOM_SERVICE_UUID_1] },
        { services: [CUSTOM_SERVICE_UUID_2] },
        { services: [PRINTER_SERVICE_UUID] },
        { namePrefix: 'PANDA' },
        { namePrefix: 'PRJ' },
        { namePrefix: 'Printer' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'MTP' }
      ],
      optionalServices: [CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2, PRINTER_SERVICE_UUID, '000018f0-0000-1000-8000-00805f9b34fb']
    });

    return await connectToDevice(device, store);
  } catch (error: any) {
    console.error('Koneksi Bluetooth gagal:', error);
    store.setError(error.message);
    return false;
  }
}

export async function autoConnectBluetoothPrinter() {
  const store = usePrinterStore.getState();
  
  try {
    const savedId = localStorage.getItem('saved_printer_id');
    if (!savedId) return false;

    // @ts-ignore - getDevices is a newer Web Bluetooth API feature
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
      store.setConnecting(true);
      // @ts-ignore
      const devices = await navigator.bluetooth.getDevices();
      const device = devices.find((d: any) => d.id === savedId);
      
      if (device) {
        return await connectToDevice(device, store);
      }
    }
  } catch (error: any) {
    console.warn('Auto-connect Bluetooth gagal, abaikan saja:', error);
  } finally {
    if (store.isConnecting) {
      store.setConnecting(false);
    }
  }
  return false;
}

export async function printViaBluetooth(data: ReceiptData) {
  const store = usePrinterStore.getState();
  if (!store.characteristic) {
    throw new Error('Printer belum terkoneksi');
  }

  const encoder = new EscPosEncoder();
  const isKitchen = data.receiptType === 'kitchen';
  const dateStr = new Date(data.dateISO).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // --- BEGIN RECEIPT GENERATION ---
  encoder.initialize().alignCenter().bold(true);
  
  if (isKitchen) {
    encoder.size(true, true).line('STRUK DAPUR').size(false, false).newline();
  } else {
    encoder.size(true, true).line(data.outletName.toUpperCase()).size(false, false);
    encoder.bold(false).line('Suka Shawarma').newline();
  }

  encoder.alignLeft().hr();
  encoder.row(dateStr, !isKitchen ? (data.paymentMethod === 'cash' ? 'TUNAI' : 'QRIS') : '');
  
  if (data.customerName) {
    encoder.line(`Pelanggan: ${data.customerName}`);
  }
  if (data.cashierName && !isKitchen) {
    encoder.line(`Kasir: ${data.cashierName}`);
  }

  encoder.alignCenter().newline().size(true, true).line(`No. ${data.orderNumber}`).size(false, false).newline();
  encoder.alignLeft().hr();

  // Items
  data.items.forEach(it => {
    let name = it.name;
    if (it.isChild) name = `L_ ${name}`;
    
    // Qty x Price
    const line1Left = `${it.quantity}x ${name}`;
    const line1Right = !isKitchen ? formatRupiah(it.subtotal) : '';
    encoder.row(line1Left, line1Right);
    
    if (it.note) {
      encoder.line(` - ${it.note}`);
    }
  });

  encoder.hr();

  if (!isKitchen) {
    encoder.row('Subtotal', formatRupiah(data.subtotal));
    if (data.discount > 0) {
      encoder.row('Diskon', `-${formatRupiah(data.discount)}`);
    }
    encoder.bold(true).size(false, true).row('TOTAL', formatRupiah(data.total)).size(false, false).bold(false);
    
    if (data.paymentMethod === 'cash') {
      encoder.row('Tunai', formatRupiah(data.amountReceived ?? 0));
      encoder.row('Kembalian', formatRupiah(data.changeAmount ?? 0));
    }
    
    encoder.hr();
    encoder.alignCenter().newline().line('Terima kasih & selamat menikmati!').newline();
  }

  encoder.cut();
  // --- END RECEIPT GENERATION ---

  const payload = encoder.encode();
  const maxChunkSize = 256; // Send 256 bytes per chunk to avoid MTU limits on Android
  
  try {
    for (let i = 0; i < payload.length; i += maxChunkSize) {
      const chunk = payload.slice(i, i + maxChunkSize);
      await store.characteristic.writeValue(chunk);
      // Wait a tiny bit between chunks for printer buffer
      await new Promise(r => setTimeout(r, 20)); 
    }
  } catch (err: any) {
    console.error('Print chunk failed:', err);
    throw new Error('Gagal mencetak: ' + err.message);
  }
}
