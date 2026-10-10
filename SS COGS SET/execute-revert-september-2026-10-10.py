import urllib.request, json, sys

headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8',
    'Content-Type': 'application/json'
}

def api_get(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def api_rpc(name, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(f'https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/rpc/{name}', data=body, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def api_post(url, payload, prefer=None):
    hdrs = dict(headers)
    if prefer:
        hdrs['Prefer'] = prefer
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=hdrs)
    with urllib.request.urlopen(req) as resp:
        return resp.status

def api_patch(url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        return resp.status

def api_delete(url):
    req = urllib.request.Request(url, headers=headers, method='DELETE')
    with urllib.request.urlopen(req) as resp:
        return resp.status

print("=== LANGKAH 1: BASELINE CEK SEBELUM PERUBAHAN ===")
aug_before = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-08-01T00:00:00+07:00', 'p_to': '2026-08-31T23:59:59.999+07:00'})
sep_before = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-09-01T00:00:00+07:00', 'p_to': '2026-09-30T23:59:59.999+07:00'})
oct_before = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-10-01T00:00:00+07:00', 'p_to': '2026-10-10T23:59:59.999+07:00'})

print(f"Agustus COGS Sebelum: {aug_before.get('total_cogs')}")
print(f"September COGS Sebelum: {sep_before.get('total_cogs')}")
print(f"Oktober COGS Sebelum: {oct_before.get('total_cogs')}")

# Menu items matching
cats = {c['id']: c['name'] for c in api_get('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/categories?select=id,name')}
menus = api_get('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/menu_items?select=id,name,category_id')
menu_map = {(m['name'], cats.get(m['category_id'], '')): m['id'] for m in menus}

# 35 Menu: (Nama, Kategori, HPP File 2, SS File 2, HPP File XX, SS File XX, Hanya 1-18 Sep)
menu_data = [
    ('Original Ayam Sedang','Original Shawarma Ayam',14537.0,12284.0,15990.7,13512.4,False),
    ('Original Ayam Besar','Original Shawarma Ayam',18310.0,14022.0,20141.0,15424.2,False),
    ('Original Ayam Jumbo','Original Shawarma Ayam',21701.0,17098.0,23871.1,18807.8,False),
    ('Original Ayam Reguler','Original Shawarma Ayam',None,9379.0,None,10316.9,False),
    ('Original Sapi Sedang','Original Shawarma Sapi',14360.0,11892.0,15796.0,13081.2,False),
    ('Original Sapi Besar','Original Shawarma Sapi',17376.0,13647.0,19113.6,15011.7,False),
    ('Original Sapi Jumbo','Original Shawarma Sapi',20675.0,16693.0,22742.5,18362.3,False),
    ('Original Sapi Reguler','Original Shawarma Sapi',None,9632.0,None,10595.2,False),
    ('Best Seller 2','Original Shawarma Sapi',20675.0,None,22742.5,None,False),
    ('Original Mix Besar','Original Shawarma Mix',20166.0,17922.0,22182.6,19714.2,False),
    ('Original Mix Jumbo','Original Shawarma Mix',25600.0,23268.0,28160.0,25594.8,False),
    ('Original Mix Reguler','Original Shawarma Mix',None,11154.0,None,12269.4,False),
    ('Best Seller (Mix Jumbo)','Original Shawarma Mix',25600.0,None,28160.0,None,False),
    ('Suka Chicken','Suka Suka',15761.0,None,17337.1,None,False),
    ('Suka Beef','Suka Suka',17186.0,None,18904.6,None,False),
    ('Suka Fried Chicken','Suka Suka',16121.0,None,17733.1,None,False),
    ('Suka Samyang','Suka Suka',15861.0,None,17447.1,None,False),
    ('Extra Keju','Topping',3500.0,None,3850.0,None,False),
    ('Extra Kentang','Topping',3500.0,None,3850.0,None,False),
    ('Original Ayam Reguler (BOGO)','BUY 1 GET 1',7546.0,None,7546.0,None,False),
    ('Original Sapi Reguler (BOGO)','BUY 1 GET 1',7799.0,None,7799.0,None,False),
    ('Shawarmie Ayam','Original Shawarma Ayam',14591.0,None,16050.1,None,True),
    ('Shawarmie Sapi','Original Shawarma Sapi',14216.0,None,15637.6,None,True),
    ('Original Ayam Sedang','Voucher Pamulang 10%',14537.0,None,15990.7,None,False),
    ('Original Ayam Besar','Voucher Pamulang 10%',18310.0,None,20141.0,None,False),
    ('Original Ayam Jumbo','Voucher Pamulang 10%',21701.0,None,23871.1,None,False),
    ('Original Sapi Sedang','Voucher Pamulang 10%',14360.0,None,15796.0,None,False),
    ('Original Sapi Besar','Voucher Pamulang 10%',17376.0,None,19113.6,None,False),
    ('Original Sapi Jumbo','Voucher Pamulang 10%',20675.0,None,22742.5,None,False),
    ('Original Mix Besar','Voucher Pamulang 10%',20166.0,None,22182.6,None,False),
    ('Original Mix Jumbo','Voucher Pamulang 10%',25600.0,None,28160.0,None,False),
    ('Suka Chicken','Voucher Pamulang 10%',15761.0,None,17337.1,None,False),
    ('Suka Beef','Voucher Pamulang 10%',17186.0,None,18904.6,None,False),
    ('Suka Fried Chicken','Voucher Pamulang 10%',16121.0,None,17733.1,None,False),
    ('Suka Samyang','Voucher Pamulang 10%',15861.0,None,17447.1,None,False)
]

ss_keys = ['ss_online','tiktok_shop','shopee_shop','f3305089-b9e4-4b92-95da-14bf6e7fb6d5','d68eb5ec-d6bb-4d0a-8758-a2600c8f1584']

print("\n=== LANGKAH 2: EKSEKUSI REVERT HPP DI MENU_HPP_RIWAYAT ===")
riwayat_batch = []

alasan_sep = "Revert HPP September 2026 (Excel SS 2.0 HPP x 2026 (2), sheet UPDATED) - penyesuaian khusus September"
alasan_oct = "Kembalikan HPP ke file XX mulai 1 Oktober 2026 - acuan baku seterusnya"

for name, cat, f2_hpp, f2_ss, xx_hpp, xx_ss, hanya_1sep in menu_data:
    mid = menu_map[(name, cat)]
    
    # 1. Checkpoint 2026-09-01 (File 2)
    riwayat_batch.append({
        'menu_item_id': mid,
        'kunci': 'hpp_override',
        'nilai': f2_hpp,
        'berlaku_mulai': '2026-09-01',
        'sumber': 'layar',
        'alasan': alasan_sep
    })
    if f2_ss is not None:
        for k in ss_keys:
            riwayat_batch.append({
                'menu_item_id': mid,
                'kunci': k,
                'nilai': f2_ss,
                'berlaku_mulai': '2026-09-01',
                'sumber': 'layar',
                'alasan': alasan_sep
            })
            
    # 2. Checkpoint 2026-09-19 (File 2, tapi Shawarmie NULL)
    riwayat_batch.append({
        'menu_item_id': mid,
        'kunci': 'hpp_override',
        'nilai': None if hanya_1sep else f2_hpp,
        'berlaku_mulai': '2026-09-19',
        'sumber': 'layar',
        'alasan': alasan_sep
    })
    if f2_ss is not None:
        for k in ss_keys:
            riwayat_batch.append({
                'menu_item_id': mid,
                'kunci': k,
                'nilai': f2_ss,
                'berlaku_mulai': '2026-09-19',
                'sumber': 'layar',
                'alasan': alasan_sep
            })

    # 3. Checkpoint 2026-10-01 (Kembali ke File XX, Shawarmie tetap NULL)
    riwayat_batch.append({
        'menu_item_id': mid,
        'kunci': 'hpp_override',
        'nilai': None if hanya_1sep else xx_hpp,
        'berlaku_mulai': '2026-10-01',
        'sumber': 'layar',
        'alasan': alasan_oct
    })
    if xx_ss is not None:
        for k in ss_keys:
            riwayat_batch.append({
                'menu_item_id': mid,
                'kunci': k,
                'nilai': xx_ss,
                'berlaku_mulai': '2026-10-01',
                'sumber': 'layar',
                'alasan': alasan_oct
            })

print(f"Total baris riwayat HPP yang akan di-upsert: {len(riwayat_batch)}")
# Upsert in chunks of 100
chunk_size = 100
for i in range(0, len(riwayat_batch), chunk_size):
    chunk = riwayat_batch[i:i+chunk_size]
    st = api_post('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/menu_hpp_riwayat?on_conflict=menu_item_id,kunci,berlaku_mulai', chunk, prefer='resolution=merge-duplicates')
    print(f"  Chunk {i//chunk_size + 1} status: {st}")

print("\n=== LANGKAH 3: EKSEKUSI PENYESUAIAN JOIN EXPENSES SEPTEMBER ===")
# Target 11 internal outlets to UPDATE to 8,238,703
internal_targets = [
    '550e8400-e29b-41d4-a716-446655440001', # BNR
    '550e8400-e29b-41d4-a716-446655440002', # EMPANG
    '550e8400-e29b-41d4-a716-446655440004', # CIMANGGU
    '550e8400-e29b-41d4-a716-446655440005', # DEPOK SUKMAJAYA
    '550e8400-e29b-41d4-a716-446655440006', # JAGAKARSA
    '550e8400-e29b-41d4-a716-446655440007', # BEJI
    '550e8400-e29b-41d4-a716-446655440008', # SAWANGAN (INTERNAL)
    '550e8400-e29b-41d4-a716-446655440009', # PAJAJARAN
    '550e8400-e29b-41d4-a716-446655440010', # JATIWARINGIN
    '550e8400-e29b-41d4-a716-446655440011', # CIRENDEU
    '550e8400-e29b-41d4-a716-446655440013', # DRAMAGA
]

# Fetch current joint expenses for September
curr_joint = api_get('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/expenses?category=eq.joint_expense&period_month=eq.2026-09-01&select=id,outlet_id,amount')
print(f"Current September joint expenses count: {len(curr_joint)}")

updated_count = 0
deleted_count = 0

for j in curr_joint:
    jid = j['id']
    oid = j['outlet_id']
    if oid in internal_targets:
        st = api_patch(f'https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/expenses?id=eq.{jid}', {
            'amount': 8238703,
            'description': 'Joint Expense September 2026 (Alokasi 11 Outlet Internal)'
        })
        updated_count += 1
        print(f"  Updated internal {oid} -> Rp 8.238.703 (status: {st})")
    else:
        st = api_delete(f'https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/expenses?id=eq.{jid}')
        deleted_count += 1
        print(f"  Deleted non-target {oid} (status: {st})")

print(f"Total Internal Diupdate: {updated_count}, Total Non-Internal Dihapus: {deleted_count}")

print("\n=== LANGKAH 4: VERIFIKASI POST-EXECUTION ===")
aug_after = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-08-01T00:00:00+07:00', 'p_to': '2026-08-31T23:59:59.999+07:00'})
sep_after = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-09-01T00:00:00+07:00', 'p_to': '2026-09-30T23:59:59.999+07:00'})
oct_after = api_rpc('get_owner_dashboard_summary', {'p_from': '2026-10-01T00:00:00+07:00', 'p_to': '2026-10-10T23:59:59.999+07:00'})

print(f"Agustus COGS Sesudah: {aug_after.get('total_cogs')} (Harus persis sama: {aug_before.get('total_cogs')})")
print(f"September COGS Sesudah: {sep_after.get('total_cogs')} (Sebelum: {sep_before.get('total_cogs')})")
print(f"Oktober COGS Sesudah: {oct_after.get('total_cogs')} (Harus persis sama: {oct_before.get('total_cogs')})")

assert aug_after.get('total_cogs') == aug_before.get('total_cogs'), "GAGAL: Agustus bergeser!"
assert oct_after.get('total_cogs') == oct_before.get('total_cogs'), "GAGAL: Oktober bergeser!"

# Verifikasi Joint Expenses di database
final_joint = api_get('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/expenses?category=eq.joint_expense&period_month=eq.2026-09-01&select=id,outlet_id,amount')
print(f"Final September joint expenses count: {len(final_joint)}")
assert len(final_joint) == 11, f"Harus ada tepat 11 baris, ketemu {len(final_joint)}"
total_joint_val = sum(f['amount'] for f in final_joint)
print(f"Total Nilai Joint Expense September di Database: Rp {total_joint_val:,.0f}")

print("\n=== SEMUA ASSERTION BERHASIL! ===")
