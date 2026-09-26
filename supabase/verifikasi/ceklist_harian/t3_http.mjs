import crypto from 'node:crypto'
import { U, K, ANON, JWTS } from './h.mjs'
// Lapisan HTTP persis seperti yang dipakai web (PostgREST + Storage) dengan JWT
// sungguhan per role. Hanya baca + satu unggahan kecil yang langsung dihapus.
const AM1 = '78cd9a59-ac3f-4e25-8766-75dcfdcc373f', AM2 = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'
const RM = '1a7cd03c-c878-402d-9e55-1ed49830e00a', CREW = '875f5723-62ec-4f32-bdc1-50b99896ff02'
const ID_24 = '8d0eff63-7ad0-47b0-a279-533799a247c8', OUTLET_24 = '550e8400-e29b-41d4-a716-446655440009'
const BUCKET = 'ceklist-harian-foto'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub) {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub, role: 'authenticated', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })
  return `${h}.${p}.${crypto.createHmac('sha256', JWTS).update(`${h}.${p}`).digest('base64url')}`
}
const hdr = (tok) => ({ apikey: ANON, Authorization: `Bearer ${tok ?? ANON}` })
const get = async (tok, path) => { const r = await fetch(`${U}/rest/v1/${path}`, { headers: hdr(tok) }); return { s: r.status, j: await r.json().catch(() => null) } }
const rpc = async (tok, fn, body) => { const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...hdr(tok), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) } }

let lulus = 0, gagal = 0
const cek = (ok, nama, info = '') => { ok ? lulus++ : gagal++; console.log(`${ok ? 'OK ' : 'BAD'} ${nama}${info ? ' — ' + info : ''}`) }

const T = { am1: jwt(AM1), am2: jwt(AM2), rm: jwt(RM), crew: jwt(CREW) }
const KOLOM = 'id,outlet_id,submitted_by,nama_am,tanggal,temuan,perbaikan,online_review,catatan,nama_peninjau,ditinjau_pada,tanggapan_rm,created_at,updated_at,ceklist_harian_item(kategori,sub_item,nilai,keterangan),ceklist_harian_foto(kategori,path,urutan)'

// H01-H05: RLS baca laporan (kueri persis milik web)
let r = await get(T.rm, `ceklist_harian?select=${KOLOM}&tanggal=eq.2026-09-24`)
cek(r.s === 200 && r.j.some((x) => x.id === ID_24) && r.j[0].ceklist_harian_item?.length === 9, 'H01 RM membaca laporan + item/foto ter-embed', `${r.s}, ${r.j?.length} laporan, ${r.j?.[0]?.ceklist_harian_item?.length} item, ${r.j?.[0]?.ceklist_harian_foto?.length} foto`)
r = await get(T.am1, `ceklist_harian?select=id&id=eq.${ID_24}`)
cek(r.s === 200 && r.j.length === 1, 'H02 AM pemilik membaca laporannya')
r = await get(T.am2, `ceklist_harian?select=id&id=eq.${ID_24}`)
cek(r.s === 200 && r.j.length === 0, 'H03 AM lain TIDAK bisa membaca laporan outlet di luar binaannya', `${r.j?.length} baris`)
r = await get(T.crew, `ceklist_harian?select=id&tanggal=gte.2026-09-01`)
cek(r.s === 200 && r.j.length === 0, 'H04 crew tidak bisa membaca ceklist', `${r.j?.length} baris`)
r = await get(null, `ceklist_harian?select=id&limit=1`)
cek(r.s !== 200 || r.j.length === 0, 'H05 anon tidak bisa membaca ceklist', `${r.s}`)
r = await get(T.crew, `ceklist_harian_item?select=id&limit=1`)
cek(r.s === 200 && r.j.length === 0, 'H06 crew tidak bisa membaca item (RLS turunan)', `${r.j?.length}`)

// H07-H08: daftar outlet sesuai pemanggilan web
r = await get(T.am1, `staff_outlets?select=outlet_id&staff_id=eq.${AM1}`)
cek(r.s === 200 && r.j.length > 0, 'H07 AM membaca pemetaan binaannya (staff_outlets)', `${r.j?.length} outlet`)
const ids = (r.j ?? []).map((x) => x.outlet_id)
r = await get(T.am1, `outlets?select=id,name&is_active=eq.true&type=in.(outlet,mitra)&id=in.(${ids.join(',')})&order=name`)
cek(r.s === 200 && r.j.length > 0, 'H08 AM membaca outlet binaan tipe outlet/mitra', r.j?.map((x) => x.name).join(', '))
r = await get(T.rm, `outlets?select=id&is_active=eq.true&type=in.(outlet,mitra)`)
cek(r.s === 200 && r.j.length > 0, 'H09 RM membaca seluruh outlet toko', `${r.j?.length} outlet`)

// H10-H13: RPC lewat PostgREST dengan bentuk payload web — payload sengaja cacat
// (8 penilaian) supaya validasi menolak sebelum ada yang tertulis.
const items8 = ['kebersihan', 'stok', 'seragam_crew', 'peralatan'].map((k) => ({ kategori: k, sub_item: '', nilai: 'baik', keterangan: null }))
  .concat(['sapi', 'ayam', 'kentang', 'tum'].map((s) => ({ kategori: 'rasa', sub_item: s, nilai: 'baik', keterangan: null })))
const bodyWeb = { p_outlet_id: OUTLET_24, p_items: items8, p_foto: [], p_temuan: [], p_perbaikan: [], p_online_review: [], p_catatan: null }
r = await rpc(T.am1, 'submit_ceklist_harian', bodyWeb)
cek(r.s === 400 && r.j?.message === 'Penilaian ceklist belum lengkap', 'H10 submit (7 argumen bernama, bentuk web) ter-resolve & tervalidasi', `${r.s} ${r.j?.message}`)
r = await rpc(null, 'submit_ceklist_harian', bodyWeb)
cek(r.s === 401 || r.s === 403 || /permission denied/.test(r.j?.message ?? ''), 'H11 anon tidak bisa memanggil submit', `${r.s} ${r.j?.message}`)
r = await rpc(T.rm, 'tinjau_ceklist_harian', { p_ceklist_id: ID_24, p_tanggapan: null, p_diperbarui_pada: '2000-01-01T00:00:00+07:00', p_ditinjau_pada: null })
cek(r.s === 400 && /baru saja diperbarui/.test(r.j?.message ?? ''), 'H12 tinjau (4 argumen bernama) ter-resolve; token basi ditolak', `${r.s} ${r.j?.message}`)
r = await rpc(null, 'exec_sql', { sql: 'SELECT 1' })
cek(r.s === 401 || r.s === 403 || /permission denied/.test(r.j?.message ?? ''), 'H13 anon TIDAK bisa memanggil exec_sql', `${r.s} ${r.j?.message}`)
r = await rpc(T.crew, 'exec_sql', { sql: 'SELECT 1' })
cek(r.s === 401 || r.s === 403 || /permission denied/.test(r.j?.message ?? ''), 'H14 pengguna login TIDAK bisa memanggil exec_sql', `${r.s} ${r.j?.message}`)

// H15-H19: Storage
const png = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64') // webp 1x1
const up = async (tok, path) => { const res = await fetch(`${U}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...hdr(tok), 'Content-Type': 'image/webp', 'x-upsert': 'false' }, body: png }); return { s: res.status, t: await res.text() } }
const milik = `${AM1}/uji-backend/${crypto.randomUUID()}.webp`
let u = await up(T.am1, milik)
cek(u.s === 200, 'H15 AM mengunggah ke foldernya sendiri', `${u.s}`)
u = await up(T.am1, `${AM2}/uji-backend/${crypto.randomUUID()}.webp`)
cek(u.s >= 400, 'H16 AM TIDAK bisa mengunggah ke folder orang lain', `${u.s}`)
u = await up(T.am1, milik)
cek(u.s >= 400, 'H17 tidak bisa menimpa berkas yang sudah ada', `${u.s}`)
const sign = async (tok) => { const res = await fetch(`${U}/storage/v1/object/sign/${BUCKET}`, { method: 'POST', headers: { ...hdr(tok), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600, paths: [milik] }) }); return { s: res.status, j: await res.json().catch(() => null) } }
let sg = await sign(T.rm)
const urlRm = sg.j?.[0]?.signedURL
cek(sg.s === 200 && Boolean(urlRm), 'H18 RM membuat signed URL (createSignedUrls, 1 request banyak path)', `${sg.s}`)
if (urlRm) { const img = await fetch(`${U}/storage/v1${urlRm}`); cek(img.status === 200, 'H19 signed URL bisa dibuka', `${img.status}`) }
sg = await sign(T.crew)
cek(!sg.j?.[0]?.signedURL, 'H20 crew TIDAK bisa membuat signed URL foto ceklist', `${sg.s} ${JSON.stringify(sg.j?.[0]?.error ?? sg.j?.message ?? '')}`)

// bersihkan unggahan uji (service key)
const del = await fetch(`${U}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [milik] }) })
cek(del.status === 200, 'H21 berkas uji dihapus', `${del.status}`)

console.log(`\nHASIL HTTP lulus=${lulus} gagal=${gagal}`)
