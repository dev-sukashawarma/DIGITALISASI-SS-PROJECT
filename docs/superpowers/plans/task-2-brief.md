### Task 2: Integrasi UI di `ApprovalModal.tsx`

**Files:**
- Modify: `apps/stok/src/components/permintaan/ApprovalModal.tsx`

**Interfaces:**
- Consumes: `fetchCrosscheckStok` dari `apps/stok/src/app/actions/permintaan.ts`.

- [ ] **Step 1: Import action dan buat state di komponen**
Buka `apps/stok/src/components/permintaan/ApprovalModal.tsx`.
Di bagian atas, import:
```typescript
import { fetchCrosscheckStok } from '@/app/actions/permintaan'
```
Di dalam fungsi `ApprovalModal`, tambahkan state:
```typescript
  const [crosscheckData, setCrosscheckData] = useState<Record<string, { outletStok: number; gudangStok: number }> | null>(null)
  const [isFetchingCrosscheck, setIsFetchingCrosscheck] = useState(true)

  useEffect(() => {
    const fetchCrosscheck = async () => {
      try {
        const bahanBakuIds = permintaan.items.map(it => it.bahan_baku_id)
        const data = await fetchCrosscheckStok(permintaan.outlet_id, bahanBakuIds)
        setCrosscheckData(data)
      } catch (err) {
        console.error('Failed to fetch crosscheck data', err)
      } finally {
        setIsFetchingCrosscheck(false)
      }
    }
    fetchCrosscheck()
  }, [permintaan.outlet_id, permintaan.items])
```

- [ ] **Step 2: Hitung status peringatan (apakah ada yang melebihi gudang)**
Tepat di bawah state `qtys`, tambahkan:
```typescript
  const hasOverStock = permintaan.items.some(
    it => crosscheckData && crosscheckData[it.bahan_baku_id] && qtys[it.bahan_baku_id] > crosscheckData[it.bahan_baku_id].gudangStok
  )
```

- [ ] **Step 3: Render Info Stok dan UI Warning pada daftar item**
Cari render item mapping:
```typescript
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1e1b15] truncate">{it.nama ?? it.bahan_baku_id}</p>
                  <p className="text-[11px] font-semibold text-[#544437] mt-0.5">Diminta: <span className="font-bold text-[#701604]">{it.qty_diminta} {it.satuan ?? ''}</span></p>
```
Ubah menjadi:
```typescript
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1e1b15] truncate">{it.nama ?? it.bahan_baku_id}</p>
                  <p className="text-[11px] font-semibold text-[#544437] mt-0.5">Diminta: <span className="font-bold text-[#701604]">{it.qty_diminta} {it.satuan ?? ''}</span></p>
                  {isFetchingCrosscheck ? (
                    <p className="text-[10px] text-[#544437]/60 mt-0.5 animate-pulse">Memuat stok...</p>
                  ) : crosscheckData && crosscheckData[it.bahan_baku_id] ? (
                    <p className="text-[10px] text-[#544437] mt-0.5 font-medium">
                      Stok Outlet: {crosscheckData[it.bahan_baku_id].outletStok} | Stok Gudang: {crosscheckData[it.bahan_baku_id].gudangStok}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#544437]/60 mt-0.5">(Stok tidak dapat dimuat)</p>
                  )}
                </div>
```

- [ ] **Step 4: Beri warna merah & ikon ⚠️ pada input yang melebihi stok gudang**
Cari blok input qty:
```typescript
                  <input
                    type="number"
                    min={0}
                    value={qtys[it.bahan_baku_id] ?? 0}
                    ...
```
Tambahkan logic pengecekan di dalam item map:
```typescript
                {/* Qty Stepper */}
                <div className="flex items-center flex-shrink-0">
                  {crosscheckData && crosscheckData[it.bahan_baku_id] && (qtys[it.bahan_baku_id] ?? 0) > crosscheckData[it.bahan_baku_id].gudangStok && (
                    <span className="text-xs mr-2" title="Melebihi stok gudang">⚠️</span>
                  )}
                  <div className={`flex items-center border rounded-xl px-1 py-0.5 ${
                    crosscheckData && crosscheckData[it.bahan_baku_id] && (qtys[it.bahan_baku_id] ?? 0) > crosscheckData[it.bahan_baku_id].gudangStok
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-[#faf2e9] border-[#d9c2b2]/30'
                  }`}>
                    <button
...
                    <input
                      type="number"
                      min={0}
                      value={qtys[it.bahan_baku_id] ?? 0}
                      onChange={e => {
                        setQtys(prev => ({ ...prev, [it.bahan_baku_id]: Number(e.target.value) }))
                        setErrorMsg(null)
                      }}
                      className={`w-12 bg-transparent border-none text-center font-bold focus:ring-0 p-0 text-sm ${
                        crosscheckData && crosscheckData[it.bahan_baku_id] && (qtys[it.bahan_baku_id] ?? 0) > crosscheckData[it.bahan_baku_id].gudangStok
                          ? 'text-orange-600'
                          : 'text-[#1e1b15]'
                      }`}
                      disabled={loading}
                      aria-label={`Jumlah disetujui ${it.nama ?? it.bahan_baku_id}`}
                    />
...
```
*(Pastikan mengganti seluruh wrapper `<div className="flex items-center bg-[#faf2e9] border border-[#d9c2b2]/30 rounded-xl px-1 py-0.5 flex-shrink-0">` dengan snippet yang mengakomodasi dinamis style di atas).*

- [ ] **Step 5: Tambahkan Peringatan Global sebelum tombol Setujui**
Sebelum `<div className="flex gap-2 justify-end pt-2">`, tambahkan:
```typescript
        {/* Warning Melebihi Gudang */}
        {hasOverStock && (
          <p className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 p-2.5 rounded-xl mb-4 flex items-center gap-2" role="alert">
            <span>⚠️</span> Beberapa item melebihi stok gudang. Mohon periksa kembali.
          </p>
        )}
```

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/permintaan/ApprovalModal.tsx
git commit -m "feat: add real-time stock crosscheck to approval modal"
```
