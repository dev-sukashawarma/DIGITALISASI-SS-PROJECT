-- Migration: Create Inbound Outbound tracking table

CREATE TABLE public.inbound_outbound (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
    tipe text NOT NULL CHECK (tipe IN ('IN', 'OUT')),
    kategori text NOT NULL, -- e.g., Pembelian, Pemakaian, Retur, Rusak
    qty numeric NOT NULL CHECK (qty > 0),
    harga_satuan numeric, -- snapshot of harga beli at the time of transaction
    catatan text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- RLS
ALTER TABLE public.inbound_outbound ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbound_outbound_read"
    ON public.inbound_outbound FOR SELECT
    USING (
        outlet_id IN (SELECT id FROM accessible_outlet_ids()) OR 
        (SELECT role FROM public.outlet_staff WHERE id = auth.uid()) IN ('admin', 'finance', 'purchasing')
    );

CREATE POLICY "inbound_outbound_insert"
    ON public.inbound_outbound FOR INSERT
    WITH CHECK (
        outlet_id IN (SELECT id FROM accessible_outlet_ids()) OR 
        (SELECT role FROM public.outlet_staff WHERE id = auth.uid()) IN ('admin', 'finance', 'purchasing', 'kitchen')
    );

-- Trigger to update stok_balance and insert into ledger_stok
CREATE OR REPLACE FUNCTION public.process_inbound_outbound()
RETURNS TRIGGER AS $$
DECLARE
    v_saldo_sebelum numeric;
    v_saldo_sesudah numeric;
    v_ledger_tipe text;
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

    -- Hitung saldo sesudah
    IF NEW.tipe = 'IN' THEN
        v_saldo_sesudah := v_saldo_sebelum + NEW.qty;
        IF NEW.kategori = 'Retur' THEN
            v_ledger_tipe := 'adjustment';
        ELSE
            v_ledger_tipe := 'terima_kiriman';
        END IF;
    ELSIF NEW.tipe = 'OUT' THEN
        v_saldo_sesudah := v_saldo_sebelum - NEW.qty;
        -- Prevent negative balance
        IF v_saldo_sesudah < 0 THEN
            RAISE EXCEPTION 'Saldo stok tidak mencukupi untuk bahan_baku_id % di outlet_id %', NEW.bahan_baku_id, NEW.outlet_id;
        END IF;
        
        IF NEW.kategori = 'Rusak' OR NEW.kategori = 'Expired' THEN
            v_ledger_tipe := 'waste';
        ELSE
            v_ledger_tipe := 'pemakaian';
        END IF;
    END IF;

    -- Update stok_balance
    UPDATE public.stok_balance
    SET saldo = v_saldo_sesudah, updated_at = now()
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;

    -- Insert ke ledger_stok untuk history utama
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
        NEW.qty,
        COALESCE(NEW.catatan, 'Inbound/Outbound: ' || NEW.kategori),
        NEW.created_by,
        NEW.created_at,
        v_saldo_sebelum,
        v_saldo_sesudah
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_inbound_outbound
    AFTER INSERT ON public.inbound_outbound
    FOR EACH ROW
    EXECUTE FUNCTION public.process_inbound_outbound();
