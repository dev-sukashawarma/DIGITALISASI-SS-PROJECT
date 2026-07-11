### Task 1: Server Action `fetchCrosscheckStok`

**Files:**
- Modify: `apps/stok/src/app/actions/permintaan.ts`

**Interfaces:**
- Consumes: Supabase database connection.
- Produces: `fetchCrosscheckStok(outletId: string, bahanBakuIds: string[]): Promise<Record<string, { outletStok: number; gudangStok: number }>>`

- [ ] **Step 1: Write minimal implementation in `apps/stok/src/app/actions/permintaan.ts`**
Tambahkan fungsi berikut di bagian bawah `apps/stok/src/app/actions/permintaan.ts`:

```typescript
// ---------------------------------------------------------------------------
// fetchCrosscheckStok — ambil sisa stok peminta dan stok gudang
// ---------------------------------------------------------------------------
export async function fetchCrosscheckStok(
  outletId: string,
  bahanBakuIds: string[]
): Promise<Record<string, { outletStok: number; gudangStok: number }>> {
  if (!bahanBakuIds.length) return {}
  const supabase = makeServiceClient()

  // 1. Cari ID Gudang Pusat
  const { data: gudang } = await supabase
    .from('outlets')
    .select('id')
    .ilike('name', '%GUDANG PUSAT%')
    .single()

  const gudangId = gudang?.id

  // 2. Fetch stok outlet peminta
  const { data: outletStok } = await supabase
    .from('stok_balance')
    .select('bahan_baku_id, qty')
    .eq('outlet_id', outletId)
    .in('bahan_baku_id', bahanBakuIds)

  // 3. Fetch stok gudang pusat
  let gudangStok: any[] = []
  if (gudangId) {
    const { data } = await supabase
      .from('stok_balance')
      .select('bahan_baku_id, qty')
      .eq('outlet_id', gudangId)
      .in('bahan_baku_id', bahanBakuIds)
    gudangStok = data || []
  }

  // 4. Map hasil
  const result: Record<string, { outletStok: number; gudangStok: number }> = {}
  for (const id of bahanBakuIds) {
    result[id] = { outletStok: 0, gudangStok: 0 }
  }

  outletStok?.forEach(s => {
    if (result[s.bahan_baku_id]) result[s.bahan_baku_id].outletStok = s.qty
  })

  gudangStok.forEach(s => {
    if (result[s.bahan_baku_id]) result[s.bahan_baku_id].gudangStok = s.qty
  })

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/stok/src/app/actions/permintaan.ts
git commit -m "feat: add fetchCrosscheckStok server action"
```
