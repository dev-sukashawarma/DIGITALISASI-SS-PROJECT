import { usePrinterStore, WebBluetoothDevice } from './printerStore';
import { EscPosEncoder } from './escpos-encoder';
import { loadImageRaster } from './escpos-image';
import { type ReceiptData } from './printReceipt';
import { DEFAULT_PRINT_LAYOUT, type CustomerLayout, type KitchenLayout } from './printLayout';
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
  '000018f0-0000-1000-8000-00805f9b34fb', // commonly used generic 16-bit UUID
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART Service (sering dipakai printer thermal generik)
];

// @ts-ignore
async function connectToDevice(device: BluetoothDevice, store: any) {
  if (!device.gatt) throw new Error('Perangkat tidak mendukung GATT Bluetooth.');

  // Jika sudah konek (stale state), putuskan dulu untuk reset koneksi
  if (device.gatt.connected) {
    device.gatt.disconnect();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  let server;
  let connectAttempts = 0;
  const maxAttempts = 3;
  
  while (connectAttempts < maxAttempts) {
    try {
      server = await device.gatt.connect();
      break; // Berhasil konek, keluar dari loop
    } catch (err: any) {
      connectAttempts++;
      console.warn(`Percobaan koneksi ke-${connectAttempts} gagal:`, err);
      
      if (connectAttempts >= maxAttempts) {
        throw new Error(`Gagal menyambung ke perangkat setelah ${maxAttempts} percobaan. Pastikan printer menyala. (${err.message})`);
      }
      
      // Tunggu sebentar sebelum mencoba lagi (Backoff)
      await new Promise(resolve => setTimeout(resolve, 500 * connectAttempts));
    }
  }

  // WORKAROUND KRITIS: Android Chrome sering throw "GATT Server is disconnected" 
  // jika kita memanggil getPrimaryService() terlalu cepat setelah connect().
  await new Promise(resolve => setTimeout(resolve, 600));

  let targetCharacteristic = null;
  let lastError = null;

  for (const serviceUuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid.toLowerCase());
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay ekstra stabilitas
      
      const characteristics = await service.getCharacteristics();
      // @ts-ignore
      targetCharacteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      if (targetCharacteristic) break;
    } catch (err: any) {
      lastError = err;
      // Skip ke UUID berikutnya jika gagal
    }
  }

  if (!targetCharacteristic) {
    if (server.connected) {
      server.disconnect();
    }
    throw new Error('Layanan cetak tidak ditemukan pada printer ini. (' + (lastError?.message || 'Unknown Service') + ')');
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
    // @ts-ignore
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome versi terbaru.');
    }

    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        CUSTOM_SERVICE_UUID_1, 
        CUSTOM_SERVICE_UUID_2, 
        PRINTER_SERVICE_UUID, 
        '000018f0-0000-1000-8000-00805f9b34fb',
        // Tambahan UUID umum untuk printer thermal lain (Nordic UART, dll)
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', 
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
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
    const freshStore = usePrinterStore.getState();
    if (freshStore.isConnecting) {
      freshStore.setConnecting(false);
    }
  }
  return false;
}

export async function printViaBluetooth(
  data: ReceiptData,
  layout: CustomerLayout | KitchenLayout = DEFAULT_PRINT_LAYOUT.struk_customer,
) {
  const store = usePrinterStore.getState();
  if (!store.characteristic) {
    throw new Error('Printer belum terkoneksi');
  }

  const encoder = new EscPosEncoder();
  const isKitchen = data.receiptType === 'kitchen';
  // Layout terpusat (fallback = default = perilaku lama). 58mm=32 char, 80mm=48 char.
  const width = layout.paperWidth === 80 ? 48 : 32;
  const showCashier = !isKitchen && (layout as CustomerLayout).showCashier;
  const showCustomer = layout.showCustomer;
  const showItemNotes = isKitchen || (layout as CustomerLayout).showItemNotes;
  const showLogo = layout.showLogo;
  // Thermal cuma bisa ukuran kasar: >= ambang → dobel tinggi. Default (14/22) = normal.
  const bigText = (layout.fontSizePx ?? 0) >= (isKitchen ? 26 : 18);
  const boldText = layout.bold !== false;
  const footerText = 'footerText' in layout ? layout.footerText : 'Terima kasih & selamat menikmati!';
  const dateStr = new Date(data.dateISO).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // --- BEGIN RECEIPT GENERATION ---
  encoder.initialize();

  // Logo (raster bitmap) — opsional; guard agar kegagalan muat/CORS tak membatalkan cetak.
  // Lebar dibatasi ~1/3 lebar kertas (ikon kecil), bukan hampir sepenuh kertas.
  if (showLogo) {
    try {
      const logoUrl = data.logoUrl || (typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '');
      const maxDots = layout.paperWidth === 80 ? 170 : 120;
      const raster = logoUrl ? await loadImageRaster(logoUrl, maxDots) : null;
      if (raster) {
        encoder.alignCenter().raster(raster.bytes, raster.widthBytes, raster.height).newline();
      }
    } catch { /* lewati logo, lanjut cetak teks */ }
  }

  encoder.alignCenter().bold(true);

  if (isKitchen) {
    const kitchenTitle = layout.headerText || 'STRUK DAPUR';
    encoder.size(false, true).line(kitchenTitle).size(false, false).newline();
  } else {
    const custTitle = layout.headerText ? layout.headerText : data.outletName.toUpperCase();
    // Judul mengikuti setelan ukuran (dobel tinggi saja bila "besar"), bukan dipaksa dobel lebar+tinggi.
    encoder.size(false, bigText).line(custTitle).size(false, false).newline();
  }

  encoder.alignLeft().hr('-', width);
  encoder.row(dateStr, !isKitchen ? (data.paymentMethod === 'cash' ? 'TUNAI' : 'QRIS') : '', ' ', width);

  if (showCustomer && data.customerName) {
    encoder.line(`Pelanggan: ${data.customerName}`);
  }
  if (showCashier && data.cashierName) {
    encoder.line(`Kasir: ${data.cashierName}`);
  }

  encoder.alignCenter().newline().size(true, true).line(`No. ${data.orderNumber}`).size(false, false).newline();
  encoder.alignLeft().hr('-', width);

  // Ukuran & tebal item mengikuti setelan (dobel tinggi bila font besar; bold sesuai toggle).
  encoder.size(false, bigText).bold(boldText);

  // Items
  data.items.forEach(it => {
    if (it.isChild) {
      // Sembunyikan qty, indentasi 4 spasi, hilangkan duplikasi kata EXTRA
      const cleanName = it.name.toUpperCase().startsWith('EXTRA')
        ? it.name.substring(5).trim()
        : it.name;
      const name = `    |- EXTRA ${cleanName}`;
      const line1Right = !isKitchen ? formatRupiah(it.subtotal) : '';
      encoder.row(name, line1Right, ' ', width);
    } else {
      // Menu utama
      const line1Left = `${it.quantity}x ${it.name}`;
      const line1Right = !isKitchen ? formatRupiah(it.subtotal) : '';
      encoder.row(line1Left, line1Right, ' ', width);
    }

    if (it.note && showItemNotes) {
      // Note di-indent 2 spasi, atau 6 spasi jika ini adalah note untuk menu ekstra
      const indent = it.isChild ? '      ' : '  ';
      encoder.line(`${indent}- ${it.note}`);
    }
  });

  encoder.size(false, false).bold(false);
  encoder.hr('-', width);

  if (!isKitchen) {
    encoder.row('Subtotal', formatRupiah(data.subtotal), ' ', width);
    if (data.discount > 0) {
      encoder.row('Diskon', `-${formatRupiah(data.discount)}`, ' ', width);
    }
    // Hapus double height (size) untuk mencegah bug TOTALP pada printer thermal murah
    encoder.bold(true).row('TOTAL', formatRupiah(data.total), ' ', width).bold(false);


    if (data.paymentMethod === 'cash') {
      encoder.row('Tunai', formatRupiah(data.amountReceived ?? 0), ' ', width);
      encoder.row('Kembalian', formatRupiah(data.changeAmount ?? 0), ' ', width);
    }

    encoder.hr('-', width);
    encoder.alignCenter().newline();
    for (const ln of footerText.split('\n')) encoder.line(ln);
    encoder.newline();
  }

  encoder.cut();
  // --- END RECEIPT GENERATION ---

  const payload = encoder.encode();
  
  // Safe chunking logic: send small chunks to prevent buffer overflow or split \r\n
  // Diubah menjadi 64 bytes dan 50ms (ultra-safe) karena banyak printer murah
  // langsung memutus koneksi (disconnect) jika buffer BLE penuh.
  const maxChunkSize = 64; 
  try {
    for (let i = 0; i < payload.length; i += maxChunkSize) {
      const chunk = payload.slice(i, i + maxChunkSize);
      if (store.characteristic.properties.writeWithoutResponse && typeof store.characteristic.writeValueWithoutResponse === 'function') {
        await store.characteristic.writeValueWithoutResponse(chunk);
      } else if (store.characteristic.properties.write && typeof store.characteristic.writeValueWithResponse === 'function') {
        await store.characteristic.writeValueWithResponse(chunk);
      } else {
        await store.characteristic.writeValue(chunk);
      }
      // Increased delay to allow printer to process buffer properly
      await new Promise(r => setTimeout(r, 50)); 
    }
  } catch (err: any) {
    console.error('Print chunk failed:', err);
    throw new Error('Gagal mencetak: ' + err.message);
  }
}
