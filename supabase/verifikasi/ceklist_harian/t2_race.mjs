import { sql } from './h.mjs'
// Uji race: 3 koneksi paralel sungguhan. A memegang transaksi 4 detik lalu
// rollback; B menyerbu 1 detik kemudian; C (pengamat) memotret pg_locks di
// tengah-tengah. Semua transaksi berakhir RAISE -> rollback, tidak ada commit/push.
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const AM1 = '78cd9a59-ac3f-4e25-8766-75dcfdcc373f', AM2 = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f', RM = '1a7cd03c-c878-402d-9e55-1ed49830e00a'
const ITEMS = `'[{"kategori":"kebersihan","sub_item":"","nilai":"baik"},{"kategori":"stok","sub_item":"","nilai":"baik"},{"kategori":"seragam_crew","sub_item":"","nilai":"baik"},{"kategori":"peralatan","sub_item":"","nilai":"baik"},{"kategori":"rasa","sub_item":"sapi","nilai":"baik"},{"kategori":"rasa","sub_item":"ayam","nilai":"baik"},{"kategori":"rasa","sub_item":"kentang","nilai":"baik"},{"kategori":"rasa","sub_item":"tum","nilai":"baik"},{"kategori":"rasa","sub_item":"sayur","nilai":"baik"}]'::jsonb`
const foto = (u) => `(SELECT jsonb_agg(jsonb_build_object('kategori',k,'path','${u}/r/'||k||'.webp')) FROM unnest(ARRAY['kebersihan','stok','seragam_crew','rasa','peralatan']) k)`
const sebagai = (u) => `PERFORM set_config('request.jwt.claims', json_build_object('sub','${u}','role','authenticated')::text, true);`

const blok = (label, body, tahan = 0) => `DO $$ DECLARE t0 timestamptz := clock_timestamp(); hasil text; BEGIN
  BEGIN ${body} hasil := 'sukses';
  EXCEPTION WHEN OTHERS THEN hasil := '[' || SQLSTATE || '] ' || SQLERRM; END;
  ${tahan ? `PERFORM pg_sleep(${tahan});` : ''}
  RAISE EXCEPTION '${label}: % (tunggu % dtk)', hasil, round(extract(epoch FROM clock_timestamp() - t0)::numeric - ${tahan}, 2);
END $$;`

const pengamat = `DO $$ DECLARE v text; BEGIN
  SELECT string_agg(l.locktype || ' (granted=' || l.granted || ', ' || coalesce(a.wait_event,'-') || ')', ', ') INTO v
  FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
  WHERE NOT l.granted AND a.pid <> pg_backend_pid();
  RAISE EXCEPTION 'PENGAMAT: kunci yang sedang ditunggu -> %', coalesce(v,'(tidak ada)');
END $$;`

async function skenario(judul, a, b) {
  console.log(`\n=== ${judul}`)
  const pa = sql(a)
  await tidur(1000)
  const pb = sql(b)
  await tidur(1200)
  const pc = sql(pengamat)
  for (const r of await Promise.all([pa, pb, pc])) console.log('  ' + r.msg)
}

// R1: dua AM berbeda mengirim ceklist PERTAMA untuk outlet+hari yang sama bersamaan.
const OUT = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
await skenario('R1 kiriman pertama bersamaan (AM berbeda, outlet sama)',
  blok('A/RACE-R1 AM1', `${sebagai(AM1)} PERFORM submit_ceklist_harian('${OUT}', ${ITEMS}, ${foto(AM1)}, NULL,NULL,NULL,NULL);`, 4),
  blok('B/RACE-R1 AM2', `${sebagai(AM2)} PERFORM submit_ceklist_harian('${OUT}', ${ITEMS}, ${foto(AM2)}, NULL,NULL,NULL,NULL);`))

// R3/R4 memakai laporan nyata 24 Sep (dikunci maks ~4 dtk, lalu rollback).
const ID = '8d0eff63-7ad0-47b0-a279-533799a247c8'
const token = `(SELECT updated_at FROM ceklist_harian WHERE id='${ID}'), (SELECT ditinjau_pada FROM ceklist_harian WHERE id='${ID}')`
await skenario('R3 dua peninjau menyetujui bersamaan dengan token yang sama',
  blok('A/RACE-R3 RM', `${sebagai(RM)} PERFORM tinjau_ceklist_harian('${ID}', 'uji A', ${token});`, 4),
  blok('B/RACE-R3 RM', `${sebagai(RM)} PERFORM tinjau_ceklist_harian('${ID}', 'uji B', ${token});`))

// R4 (kirim ulang AM vs setujui RM) tidak bisa diuji pada laporan kemarin: kiriman
// selalu untuk hari ini. Keduanya mengunci baris yang sama (FOR UPDATE), sama seperti R3.
