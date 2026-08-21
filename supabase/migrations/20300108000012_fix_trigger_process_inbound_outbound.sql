-- Migration: Fix process_inbound_outbound trigger function for ledger_stok sign

CREATE OR REPLACE FUNCTION public.process_inbound_outbound()
RETURNS TRIGGER AS $$
DECLARE
    v_saldo_sebelum numeric;
    v_saldo_sesudah numeric;
    v_ledger_tipe text;
    v_ledger_qty numeric;
BEGIN
    -- Dapatkan saldo sebelum
    SELECT COALESCE(saldo, 0) INTO v_saldo_sebelum
    FROM public.stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;

    IF NOT FOUND THEN
        v_saldo_sebelum := 0;
        INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
        VALUES (NEW.outlet_id, NEW.bahan_baku_id, 0, now());
    END IF;

    -- Hitung saldo sesudah dan tipe ledger
    IF NEW.tipe = 'IN' THEN
        v_saldo_sesudah := v_saldo_sebelum + NEW.qty;
        v_ledger_qty := NEW.qty;
        IF NEW.kategori = 'Retur' THEN
            v_ledger_tipe := 'adjustment';
        ELSIF NEW.kategori = 'Pembelian' THEN
            v_ledger_tipe := 'pembelian_supplier';
        ELSE
            v_ledger_tipe := 'terima_kiriman';
        END IF;
    ELSIF NEW.tipe = 'OUT' THEN
        v_saldo_sesudah := v_saldo_sebelum - NEW.qty;
        v_ledger_qty := -NEW.qty;
        -- Prevent negative balance
        IF v_saldo_sesudah < 0 THEN
            RAISE EXCEPTION 'Saldo stok tidak mencukupi untuk bahan_baku_id % di outlet_id %', NEW.bahan_baku_id, NEW.outlet_id;
        END IF;
        
        IF NEW.kategori = 'Rusak' OR NEW.kategori = 'Expired' THEN
            v_ledger_tipe := 'waste';
        ELSIF NEW.kategori = 'Transfer Keluar' THEN
            v_ledger_tipe := 'transfer_keluar';
        ELSE
            v_ledger_tipe := 'pemakaian';
        END IF;
    END IF;

    -- Update stok_balance
    UPDATE public.stok_balance
    SET saldo = v_saldo_sesudah, updated_at = now()
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;

    -- Insert ke ledger_stok untuk history kanonikal
    INSERT INTO public.ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        catatan,
        created_by,
        created_at,
        saldo_sebelum,
        saldo_sesudah
    ) VALUES (
        NEW.outlet_id,
        NEW.bahan_baku_id,
        v_ledger_tipe,
        v_ledger_qty,
        COALESCE(NEW.catatan, 'Inbound/Outbound: ' || NEW.kategori),
        NEW.created_by,
        NEW.created_at,
        v_saldo_sebelum,
        v_saldo_sesudah
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
