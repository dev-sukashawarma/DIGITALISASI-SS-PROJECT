-- Buka kunci perubahan tipe outlet (internal <-> mitra) kapan saja dari Admin Dashboard.
-- Data historis investasi mitra tetap aman tersimpan; bila outlet internal diubah menjadi
-- mitra dan belum memiliki baris mitra_investments, baris bawaan otomatis dibuat.

CREATE OR REPLACE FUNCTION public.outlets_jaga_persiapan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status IS DISTINCT FROM 'pending'
     AND coalesce(current_setting('app.pembukaan_outlet', true), '') <> 'on' THEN
    RAISE NOTICE 'Outlet % masih Persiapan: status hanya berubah lewat Go-Live atau Batalkan pembukaan', OLD.name;
    NEW.status := 'pending';
    NEW.is_active := false;
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_mitra_investment_on_outlet_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'mitra' THEN
    UPDATE public.mitra_investments
    SET is_profit_sharing_active = true,
        updated_at = now()
    WHERE outlet_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO public.mitra_investments (
        outlet_id,
        nilai_investasi,
        tanggal_mulai,
        persentase_bagi_hasil,
        management_fee,
        is_profit_sharing_active
      )
      VALUES (
        NEW.id,
        0,
        coalesce(NEW.tanggal_grand_opening, (now() AT TIME ZONE 'Asia/Jakarta')::date),
        100,
        3,
        true
      );
    END IF;
  ELSE
    UPDATE public.mitra_investments
    SET is_profit_sharing_active = false,
        updated_at = now()
    WHERE outlet_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_sync_mitra_investment_on_type_change
  AFTER UPDATE OF type ON public.outlets
  FOR EACH ROW
  WHEN (OLD.type IS DISTINCT FROM NEW.type AND NEW.type IN ('internal', 'mitra'))
  EXECUTE FUNCTION public.sync_mitra_investment_on_outlet_type_change();
