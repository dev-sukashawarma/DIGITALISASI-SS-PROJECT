select b.nama, round(sb.saldo::numeric,4) saldo_dus, round((sb.saldo*16500)::numeric,0) gram
from stok_balance sb join bahan_baku b on b.id=sb.bahan_baku_id
where sb.outlet_id='550e8400-e29b-41d4-a716-446655440009' and b.nama='SAOS TOMAT';
