'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useStokBalance } from '@/hooks/useStokBalance';
import { submitInboundOutboundAction } from '@/app/actions/inboundOutboundActions';
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit';
import { toast } from 'sonner';
import { InboundOutboundTipe } from '@/types/stok';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outletId: string;
  onSuccess: () => void;
}

const INBOUND_CATEGORIES = ['Pembelian', 'Transfer Masuk', 'Retur', 'Lainnya'];
const OUTBOUND_CATEGORIES = ['Pemakaian', 'Rusak', 'Expired', 'Transfer Keluar', 'Lainnya'];

export function InboundOutboundDrawer({ isOpen, onClose, outletId, onSuccess }: Props) {
  const { bahanBaku } = useBahanBaku();
  const { balances: balance } = useStokBalance(outletId);
  
  const [tipe, setTipe] = useState<InboundOutboundTipe>('IN');
  const [bahanBakuId, setBahanBakuId] = useState('');
  const [selectedUnitType, setSelectedUnitType] = useState<'besar' | 'tengah' | 'kecil'>('besar');
  const [kategori, setKategori] = useState(INBOUND_CATEGORIES[0]);
  const [qty, setQty] = useState('');
  const [catatan, setCatatan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cari bahan baku yang dipilih dan stoknya
  const selectedBahan = useMemo(() => bahanBaku?.find(b => b.id === bahanBakuId), [bahanBaku, bahanBakuId]);
  
  const currentStock = useMemo(() => {
    if (!bahanBakuId || !balance) return 0;
    const item = balance.find(b => b.bahan_baku_id === bahanBakuId);
    return item?.saldo || 0;
  }, [balance, bahanBakuId]);

  const numInputQty = parseFloat(qty) || 0;

  // Konversi input ke skala basis (satuan kecil / gram)
  const convertedBaseQty = useMemo(() => {
    if (!selectedBahan || numInputQty <= 0) return 0;
    
    if (selectedUnitType === 'kecil') {
      return numInputQty;
    }
    if (selectedUnitType === 'tengah' && selectedBahan.faktor_tengah && selectedBahan.faktor_tampilan) {
      const perTengah = selectedBahan.faktor_tampilan / selectedBahan.faktor_tengah;
      return numInputQty * perTengah;
    }
    if (selectedUnitType === 'besar') {
      return numInputQty * (selectedBahan.faktor_tampilan || 1);
    }
    return numInputQty;
  }, [selectedBahan, numInputQty, selectedUnitType]);

  const projectedStock = useMemo(() => {
    if (!bahanBakuId) return currentStock;
    return tipe === 'IN' ? currentStock + convertedBaseQty : currentStock - convertedBaseQty;
  }, [currentStock, convertedBaseQty, tipe, bahanBakuId]);

  const isWarning = tipe === 'OUT' && projectedStock < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletId) {
      toast.error('Pilih outlet terlebih dahulu');
      return;
    }
    if (!bahanBakuId) {
      toast.error('Pilih bahan baku');
      return;
    }
    if (numInputQty <= 0 || convertedBaseQty <= 0) {
      toast.error('Jumlah harus lebih dari 0');
      return;
    }
    if (isWarning) {
      toast.error('Stok tidak mencukupi untuk pengeluaran sebesar ini');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitInboundOutboundAction({
        outlet_id: outletId,
        bahan_baku_id: bahanBakuId,
        tipe,
        kategori,
        qty: convertedBaseQty,
        catatan: catatan || undefined
      });
      toast.success('Berhasil mencatat mutasi stok');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setBahanBakuId('');
    setQty('');
    setCatatan('');
    setSelectedUnitType('besar');
    setKategori(tipe === 'IN' ? INBOUND_CATEGORIES[0] : OUTBOUND_CATEGORIES[0]);
  };

  const handleTipeChange = (newTipe: InboundOutboundTipe) => {
    setTipe(newTipe);
    setKategori(newTipe === 'IN' ? INBOUND_CATEGORIES[0] : OUTBOUND_CATEGORIES[0]);
  };

  const formatSaldo = (val: number) => {
    if (!selectedBahan) return `${val}`;
    if (selectedBahan.faktor_tampilan && selectedBahan.faktor_tampilan > 1) {
      return formatTriUnitSaldoFromGram(
        val,
        selectedBahan.satuan,
        selectedBahan.satuan_tengah,
        selectedBahan.faktor_tengah,
        selectedBahan.satuan_kecil,
        selectedBahan.faktor_tampilan
      );
    }
    return `${val.toLocaleString('id-ID')} ${selectedBahan.satuan}`;
  };

  return (
    <Transition show={isOpen}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-[#1e1b15]/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <TransitionChild
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <DialogPanel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-2xl">
                    <div className={`px-6 py-5 sm:px-8 border-b flex items-center justify-between transition-colors ${tipe === 'IN' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                      <DialogTitle className="text-lg font-extrabold text-suka-brown flex items-center gap-2">
                        {tipe === 'IN' ? (
                          <><ArrowDownCircle className="w-5 h-5 text-green-600" /> Catat Barang Masuk (Inbound)</>
                        ) : (
                          <><ArrowUpCircle className="w-5 h-5 text-red-600" /> Catat Barang Keluar (Outbound)</>
                        )}
                      </DialogTitle>
                      <button
                        type="button"
                        className="rounded-full p-2 hover:bg-black/5 transition-colors cursor-pointer"
                        onClick={onClose}
                      >
                        <X className="w-5 h-5 text-suka-brown/60" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6">
                      {/* Tipe Mutasi Toggle */}
                      <div className="flex bg-suka-brown/5 rounded-xl p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => handleTipeChange('IN')}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tipe === 'IN' ? 'bg-green-600 text-white shadow-xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                        >
                          Inbound (Masuk)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTipeChange('OUT')}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tipe === 'OUT' ? 'bg-red-600 text-white shadow-xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                        >
                          Outbound (Keluar)
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Bahan Baku */}
                        <div>
                          <label className="block text-xs font-bold text-suka-brown/70 uppercase tracking-wider mb-2">
                            Pilih Bahan Baku
                          </label>
                          <select
                            value={bahanBakuId}
                            onChange={(e) => {
                              setBahanBakuId(e.target.value);
                              setSelectedUnitType('besar');
                            }}
                            required
                            className="w-full bg-white border border-suka-brown/20 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-suka-orange focus:border-transparent outline-none transition-all cursor-pointer"
                          >
                            <option value="">-- Pilih Bahan Baku --</option>
                            {bahanBaku?.filter(b => b.is_active).map(b => (
                              <option key={b.id} value={b.id}>{b.nama}</option>
                            ))}
                          </select>
                        </div>

                        {/* Pilihan Satuan (Jika tersedia satuan bertingkat) */}
                        {selectedBahan && (
                          <div>
                            <label className="block text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider mb-2">
                              Pilih Satuan Input
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedUnitType('besar')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                                  selectedUnitType === 'besar'
                                    ? 'bg-suka-orange text-white border-suka-orange shadow-xs'
                                    : 'bg-white text-suka-brown/70 border-suka-brown/20 hover:bg-suka-cream/50'
                                }`}
                              >
                                {selectedBahan.satuan} (Utama)
                              </button>

                              {selectedBahan.satuan_tengah && selectedBahan.faktor_tengah && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedUnitType('tengah')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                                    selectedUnitType === 'tengah'
                                      ? 'bg-suka-orange text-white border-suka-orange shadow-xs'
                                      : 'bg-white text-suka-brown/70 border-suka-brown/20 hover:bg-suka-cream/50'
                                  }`}
                                >
                                  {selectedBahan.satuan_tengah}
                                </button>
                              )}

                              {selectedBahan.satuan_kecil && selectedBahan.faktor_tampilan && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedUnitType('kecil')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                                    selectedUnitType === 'kecil'
                                      ? 'bg-suka-orange text-white border-suka-orange shadow-xs'
                                      : 'bg-white text-suka-brown/70 border-suka-brown/20 hover:bg-suka-cream/50'
                                  }`}
                                >
                                  {selectedBahan.satuan_kecil}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Jumlah Input */}
                        <div>
                          <label className="block text-xs font-bold text-suka-brown/70 uppercase tracking-wider mb-2">
                            Jumlah ({selectedUnitType === 'kecil' ? selectedBahan?.satuan_kecil : selectedUnitType === 'tengah' ? selectedBahan?.satuan_tengah : selectedBahan?.satuan || 'Satuan'})
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            required
                            placeholder="0"
                            className={`w-full bg-white border rounded-xl px-4 py-3 text-lg font-black focus:ring-2 focus:outline-none transition-all ${
                              isWarning 
                                ? 'border-red-300 text-red-600 focus:ring-red-500' 
                                : 'border-suka-brown/20 focus:ring-suka-orange focus:border-transparent'
                            }`}
                          />
                        </div>

                        {/* Live Projection Box */}
                        {bahanBakuId && (
                          <div className={`p-4 rounded-xl border ${isWarning ? 'bg-red-50 border-red-200' : 'bg-suka-cream/60 border-suka-brown/10'}`}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-medium text-suka-brown/70">Stok Saat Ini:</span>
                              <span className="text-xs font-extrabold text-suka-brown">{formatSaldo(currentStock)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-suka-brown/10">
                              <span className="text-xs font-medium text-suka-brown/70">Proyeksi Stok Akhir:</span>
                              <span className={`text-xs font-black ${isWarning ? 'text-red-600' : 'text-green-700'}`}>
                                {formatSaldo(projectedStock)}
                              </span>
                            </div>
                            {isWarning && (
                              <div className="mt-2.5 flex items-start gap-1.5 text-red-600 text-[10px] font-bold uppercase tracking-wider leading-tight">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Peringatan: Stok tidak mencukupi untuk outbound ini!</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Kategori */}
                        <div>
                          <label className="block text-xs font-bold text-suka-brown/70 uppercase tracking-wider mb-2">
                            Kategori {tipe}
                          </label>
                          <select
                            value={kategori}
                            onChange={(e) => setKategori(e.target.value)}
                            required
                            className="w-full bg-white border border-suka-brown/20 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-suka-orange focus:border-transparent outline-none transition-all cursor-pointer"
                          >
                            {(tipe === 'IN' ? INBOUND_CATEGORIES : OUTBOUND_CATEGORIES).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        {/* Catatan */}
                        <div>
                          <label className="block text-xs font-bold text-suka-brown/70 uppercase tracking-wider mb-2">
                            Catatan / Keterangan (Opsional)
                          </label>
                          <textarea
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            rows={2}
                            placeholder="Tulis alasan, referensi surat jalan, atau keterangan..."
                            className="w-full bg-white border border-suka-brown/20 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-suka-orange focus:border-transparent outline-none transition-all resize-none"
                          />
                        </div>
                        
                        {tipe === 'IN' && (
                          <div className="text-[10px] text-suka-brown/60 italic px-1">
                            * Harga beli akan secara otomatis disesuaikan dari data Master Harga Bahan Baku.
                          </div>
                        )}
                      </div>
                    </form>

                    <div className="border-t border-suka-brown/10 p-6 bg-[#fcfaf8]">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || isWarning || !bahanBakuId || numInputQty <= 0}
                        className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                          isSubmitting || isWarning || !bahanBakuId || numInputQty <= 0
                            ? 'bg-suka-brown/10 text-suka-brown/40 cursor-not-allowed'
                            : tipe === 'IN'
                              ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                              : 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
                        }`}
                      >
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Mutasi'}
                      </button>
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
