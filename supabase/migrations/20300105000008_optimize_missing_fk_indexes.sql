-- Migration: 20260728000000_optimize_missing_fk_indexes.sql
-- Description: Non-destructive optimization adding 17 high-impact composite & foreign key indexes for Case 1
-- Safe to apply: Only creates B-Tree indexes (IF NOT EXISTS), zero data alteration or locking risk.

-- 1. Orders & Order Items (POS Kasir & Sales Analytics)
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created 
  ON public.orders(outlet_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_menu 
  ON public.order_items(order_id, menu_item_id);

-- 2. Ledger Stok (Inventory Reporting & Balance Tracking)
CREATE INDEX IF NOT EXISTS idx_ledger_outlet_bahan_created 
  ON public.ledger_stok(outlet_id, bahan_baku_id, created_at DESC);

-- 3. Attendance & Absensi Checklist
CREATE INDEX IF NOT EXISTS idx_attendance_staff_outlet_ts 
  ON public.attendance(outlet_staff_id, outlet_id, ts_server DESC);

CREATE INDEX IF NOT EXISTS idx_daily_checklist_records_outlet_date 
  ON public.daily_checklist_records(outlet_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_checklist_ticks_rec_item 
  ON public.daily_checklist_ticks(record_id, item_id);

-- 4. Petty Cash & Finance
CREATE INDEX IF NOT EXISTS idx_petty_expenses_created_by 
  ON public.petty_cash_expenses(created_by);

CREATE INDEX IF NOT EXISTS idx_petty_topups_created_by 
  ON public.petty_cash_topups(created_by);

CREATE INDEX IF NOT EXISTS idx_staff_outlets_staff_outlet 
  ON public.staff_outlets(staff_id, outlet_id);

-- 5. Mutasi Antar Outlet
CREATE INDEX IF NOT EXISTS idx_mutasi_from_to_status 
  ON public.mutasi_antar_outlet(outlet_asal_id, outlet_tujuan_id, status);

-- 6. Purchase Order & Procurement
CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier_status 
  ON public.purchase_order(supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_purchase_order_item_po_bahan 
  ON public.purchase_order_item(purchase_order_id, bahan_baku_id);

-- 7. Stok Waste & Pricing & Thresholds
CREATE INDEX IF NOT EXISTS idx_stok_waste_bahan_outlet 
  ON public.stok_waste_reports(bahan_baku_id, outlet_id);

CREATE INDEX IF NOT EXISTS idx_bahan_baku_harga_bahan 
  ON public.bahan_baku_harga(bahan_baku_id);

-- 8. Permintaan Bahan & Surat Jalan Items
CREATE INDEX IF NOT EXISTS idx_permintaan_bahan_sj_dibuat 
  ON public.permintaan_bahan(surat_jalan_id, dibuat_oleh);

CREATE INDEX IF NOT EXISTS idx_permintaan_bahan_item_bahan 
  ON public.permintaan_bahan_item(bahan_baku_id);
