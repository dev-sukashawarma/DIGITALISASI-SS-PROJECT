import { sql } from './h.mjs'
// Seluruh tes berjalan dalam SATU transaksi dan diakhiri RAISE -> rollback total
// (termasuk antrean pg_net, jadi tidak ada push yang terkirim).
const q = String.raw`
DO $$
DECLARE
  am1 uuid := '78cd9a59-ac3f-4e25-8766-75dcfdcc373f';  -- Muhtar Arifin
  am2 uuid := 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f';  -- Mulyadi
  rm  uuid := '1a7cd03c-c878-402d-9e55-1ed49830e00a';  -- Indra Adam Sami
  otes uuid := 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'; -- outlet tes
  oluar uuid;
  items jsonb := '[{"kategori":"kebersihan","sub_item":"","nilai":"baik","keterangan":"  Sudah baik  "},
    {"kategori":"stok","sub_item":"","nilai":"perhatian","keterangan":null},
    {"kategori":"seragam_crew","sub_item":"","nilai":"baik"},
    {"kategori":"peralatan","sub_item":"","nilai":"buruk","keterangan":"Ada peralatan rusak"},
    {"kategori":"rasa","sub_item":"sapi","nilai":"baik"},{"kategori":"rasa","sub_item":"ayam","nilai":"baik"},
    {"kategori":"rasa","sub_item":"kentang","nilai":"baik"},{"kategori":"rasa","sub_item":"tum","nilai":"baik"},
    {"kategori":"rasa","sub_item":"sayur","nilai":"baik"}]';
  foto jsonb; id1 uuid; id2 uuid; c record; n int; q0 bigint; out text := '';
  lulus int := 0; gagal int := 0;
  nama text[]; pi text[]; pf text[]; i int;
BEGIN
  INSERT INTO staff_outlets (staff_id, outlet_id) VALUES (am1, otes), (am2, otes) ON CONFLICT DO NOTHING;
  SELECT id INTO oluar FROM outlets WHERE is_active AND type='outlet'
    AND id NOT IN (SELECT outlet_id FROM staff_outlets WHERE staff_id=am1)
    AND id IS DISTINCT FROM (SELECT outlet_id FROM outlet_staff WHERE id=am1) LIMIT 1;
  DELETE FROM ceklist_harian WHERE outlet_id = otes;

  foto := jsonb_build_array(
    jsonb_build_object('kategori','kebersihan','path',am1||'/x/a.webp'),
    jsonb_build_object('kategori','stok','path',am1||'/x/b.webp'),
    jsonb_build_object('kategori','seragam_crew','path',am1||'/x/c.webp'),
    jsonb_build_object('kategori','rasa','path',am1||'/x/d.webp'),
    jsonb_build_object('kategori','rasa','path',am1||'/x/d2.webp'),
    jsonb_build_object('kategori','peralatan','path',am1||'/x/e.webp'),
    jsonb_build_object('kategori','online_review','path',am1||'/x/f.webp'));

  SELECT count(*) INTO q0 FROM net.http_request_queue;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',am1,'role','authenticated')::text, true);

  BEGIN
    id1 := submit_ceklist_harian(otes, items, foto, ARRAY['  temuan 1 ','',' '], ARRAY['fix'], '   ', ARRAY['Google Maps ok']);
    SELECT count(*) INTO n FROM ceklist_harian_item WHERE ceklist_id=id1;
    SELECT * INTO c FROM ceklist_harian WHERE id=id1;
    IF n=9 AND c.temuan = ARRAY['temuan 1'] AND c.catatan IS NULL AND c.online_review=ARRAY['Google Maps ok']
       AND (SELECT count(*) FROM ceklist_harian_foto WHERE ceklist_id=id1)=7
       AND (SELECT keterangan FROM ceklist_harian_item WHERE ceklist_id=id1 AND kategori='kebersihan')='Sudah baik'
       AND c.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
    THEN lulus:=lulus+1; out:=out||E'\nOK  T01 kirim valid (9 item, 7 foto, trim teks, catatan kosong->NULL, tanggal WIB)';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T01 isi tersimpan tidak sesuai'; END IF;
  EXCEPTION WHEN OTHERS THEN gagal:=gagal+1; out:=out||E'\nBAD T01 '||SQLERRM; END;

  SELECT count(*) - q0 INTO n FROM net.http_request_queue;
  out := out || E'\nINFO T02 push terantre dalam transaksi (ikut rollback): ' || n || ' (RM aktif: ' ||
    (SELECT count(*) FROM outlet_staff WHERE role='regional_manager' AND status='active' AND COALESCE(is_active,true)) || ')';

  BEGIN
    id2 := submit_ceklist_harian(otes, items, foto, ARRAY['t2'], ARRAY[]::text[], 'catatan', ARRAY[]::text[]);
    IF id2=id1 AND (SELECT count(*) FROM ceklist_harian_item WHERE ceklist_id=id1)=9
       AND (SELECT count(*) FROM ceklist_harian_foto WHERE ceklist_id=id1)=7
       AND (SELECT count(*) FROM ceklist_harian WHERE outlet_id=otes)=1
    THEN lulus:=lulus+1; out:=out||E'\nOK  T03 kirim ulang: id sama, item & foto tidak ganda';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T03 kirim ulang menggandakan data'; END IF;
  EXCEPTION WHEN OTHERS THEN gagal:=gagal+1; out:=out||E'\nBAD T03 '||SQLERRM; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',am2,'role','authenticated')::text, true);
  BEGIN
    PERFORM submit_ceklist_harian(otes, items, replace(foto::text, am1::text, am2::text)::jsonb, NULL, NULL, NULL, NULL);
    gagal:=gagal+1; out:=out||E'\nBAD T04 AM kedua bisa menimpa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%sudah diisi oleh%' THEN lulus:=lulus+1; out:=out||E'\nOK  T04 AM kedua ditolak: '||SQLERRM;
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T04 '||SQLERRM; END IF; END;

  BEGIN
    PERFORM submit_ceklist_harian(otes, items, foto, NULL, NULL, NULL, NULL);
    gagal:=gagal+1; out:=out||E'\nBAD T05 path foto orang lain diterima';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Path foto%' THEN lulus:=lulus+1; out:=out||E'\nOK  T05 path foto milik orang lain ditolak';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T05 '||SQLERRM; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',rm,'role','authenticated')::text, true);
  SELECT * INTO c FROM ceklist_harian WHERE id=id1;
  BEGIN
    PERFORM tinjau_ceklist_harian(id1, '  mantap  ', c.updated_at, c.ditinjau_pada);
    IF (SELECT ditinjau_oleh=rm AND tanggapan_rm='mantap' FROM ceklist_harian WHERE id=id1)
    THEN lulus:=lulus+1; out:=out||E'\nOK  T06 RM setujui (token cocok, tanggapan di-trim)';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T06 tinjau tidak tersimpan'; END IF;
  EXCEPTION WHEN OTHERS THEN gagal:=gagal+1; out:=out||E'\nBAD T06 '||SQLERRM; END;

  BEGIN
    PERFORM tinjau_ceklist_harian(id1, 'menimpa', c.updated_at, NULL);
    gagal:=gagal+1; out:=out||E'\nBAD T07 token basi diterima (tanggapan tertimpa)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%baru saja diperbarui%' THEN lulus:=lulus+1; out:=out||E'\nOK  T07 peninjau kedua (token basi) ditolak';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T07 '||SQLERRM; END IF; END;

  BEGIN
    PERFORM tinjau_ceklist_harian(id1, 'x', c.updated_at - interval '1 second', (SELECT ditinjau_pada FROM ceklist_harian WHERE id=id1));
    gagal:=gagal+1; out:=out||E'\nBAD T08 updated_at basi diterima';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%baru saja diperbarui%' THEN lulus:=lulus+1; out:=out||E'\nOK  T08 versi laporan basi (AM kirim ulang) ditolak';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T08 '||SQLERRM; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',am1,'role','authenticated')::text, true);
  BEGIN
    PERFORM submit_ceklist_harian(otes, items, foto, NULL, NULL, NULL, NULL);
    IF (SELECT ditinjau_pada IS NULL AND tanggapan_rm IS NULL AND ditinjau_oleh IS NULL FROM ceklist_harian WHERE id=id1)
    THEN lulus:=lulus+1; out:=out||E'\nOK  T09 kirim ulang membatalkan persetujuan lama';
    ELSE gagal:=gagal+1; out:=out||E'\nBAD T09 persetujuan lama tertinggal'; END IF;
  EXCEPTION WHEN OTHERS THEN gagal:=gagal+1; out:=out||E'\nBAD T09 '||SQLERRM; END;

  BEGIN PERFORM tinjau_ceklist_harian(id1, NULL, NULL, NULL); gagal:=gagal+1; out:=out||E'\nBAD T10a AM bisa menyetujui';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Hanya regional%' THEN lulus:=lulus+1; out:=out||E'\nOK  T10a AM tidak bisa menyetujui'; ELSE gagal:=gagal+1; out:=out||E'\nBAD T10a '||SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',rm,'role','authenticated')::text, true);
  BEGIN PERFORM submit_ceklist_harian(otes, items, replace(foto::text, am1::text, rm::text)::jsonb, NULL, NULL, NULL, NULL); gagal:=gagal+1; out:=out||E'\nBAD T10b RM bisa mengisi';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Hanya area%' THEN lulus:=lulus+1; out:=out||E'\nOK  T10b RM tidak bisa mengisi'; ELSE gagal:=gagal+1; out:=out||E'\nBAD T10b '||SQLERRM; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  BEGIN PERFORM submit_ceklist_harian(otes, items, foto, NULL, NULL, NULL, NULL); gagal:=gagal+1; out:=out||E'\nBAD T11 tanpa sesi lolos';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Sesi login%' THEN lulus:=lulus+1; out:=out||E'\nOK  T11 tanpa sesi ditolak'; ELSE gagal:=gagal+1; out:=out||E'\nBAD T11 '||SQLERRM; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',am1,'role','authenticated')::text, true);
  BEGIN PERFORM submit_ceklist_harian(oluar, items, foto, NULL, NULL, NULL, NULL); gagal:=gagal+1; out:=out||E'\nBAD T12 outlet luar binaan lolos';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Outlet di luar%' THEN lulus:=lulus+1; out:=out||E'\nOK  T12 outlet luar binaan ditolak'; ELSE gagal:=gagal+1; out:=out||E'\nBAD T12 '||SQLERRM; END IF; END;

  nama := ARRAY['T13 hanya 8 penilaian','T14 penilaian ganda','T15 nilai tak dikenal','T16 nilai null',
    'T17 sub_item rasa tak dikenal','T18 kategori wajib tanpa foto','T19 4 foto satu kategori',
    'T20 4 foto online_review','T21 kategori foto tak dikenal','T22 path foto null',
    'T23 p_items bukan array','T24 p_foto bukan array','T25 p_items null'];
  pi := ARRAY[(items - 8)::text,
    ((items - 8) || '[{"kategori":"stok","sub_item":"","nilai":"baik"}]'::jsonb)::text,
    replace(items::text,'"buruk"','"jelek"'), replace(items::text,'"buruk"','null'),
    replace(items::text,'"tum"','"sambal"'), items::text, items::text, items::text, items::text, items::text,
    '{"a":1}', items::text, NULL];
  pf := ARRAY[foto::text, foto::text, foto::text, foto::text, foto::text, (foto - 5)::text,
    (foto || jsonb_build_array(jsonb_build_object('kategori','rasa','path',am1||'/x/3.webp'),jsonb_build_object('kategori','rasa','path',am1||'/x/4.webp')))::text,
    (foto || jsonb_build_array(jsonb_build_object('kategori','online_review','path',am1||'/1.webp'),jsonb_build_object('kategori','online_review','path',am1||'/2.webp'),jsonb_build_object('kategori','online_review','path',am1||'/3.webp')))::text,
    (foto || jsonb_build_array(jsonb_build_object('kategori','xyz','path',am1||'/x/z.webp')))::text,
    (foto || '[{"kategori":"temuan","path":null}]'::jsonb)::text,
    foto::text, '{"a":1}', foto::text];
  FOR i IN 1..array_length(nama,1) LOOP
    BEGIN
      PERFORM submit_ceklist_harian(otes, pi[i]::jsonb, pf[i]::jsonb, NULL, NULL, NULL, NULL);
      gagal:=gagal+1; out:=out||E'\nBAD '||nama[i]||' LOLOS (seharusnya ditolak)';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = 'P0001' THEN lulus:=lulus+1; out:=out||E'\nOK  '||nama[i]||' -> '||SQLERRM;
      ELSE gagal:=gagal+1; out:=out||E'\nBAD '||nama[i]||' error mentah ['||SQLSTATE||'] '||SQLERRM; END IF;
    END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',rm,'role','authenticated')::text, true);
  BEGIN PERFORM tinjau_ceklist_harian(gen_random_uuid(), NULL, NULL, NULL); gagal:=gagal+1; out:=out||E'\nBAD T26';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Ceklist tidak ditemukan%' THEN lulus:=lulus+1; out:=out||E'\nOK  T26 tinjau id tak ada ditolak'; ELSE gagal:=gagal+1; out:=out||E'\nBAD T26 ['||SQLSTATE||'] '||SQLERRM; END IF; END;

  BEGIN PERFORM tinjau_ceklist_harian(id1, NULL); lulus:=lulus+1; out:=out||E'\nOK  T27 tinjau 2 argumen (klien lama) tetap jalan';
  EXCEPTION WHEN OTHERS THEN gagal:=gagal+1; out:=out||E'\nBAD T27 '||SQLERRM; END;

  RAISE EXCEPTION 'HASIL lulus=% gagal=% %', lulus, gagal, out;
END $$;`
import fs from 'node:fs'
const pra = process.env.PRA ? fs.readFileSync(process.env.PRA, 'utf8') + String.fromCharCode(10) : ''
const r = await sql(pra + q)
console.log(r.msg)
