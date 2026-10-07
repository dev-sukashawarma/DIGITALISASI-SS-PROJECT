# Laporan pagi CEO: ambil teks template dari API Suka Shawarma (TANPA AI), cetak ke stdout.
# Hermes cron --no-agent mengirim stdout apa adanya ke Telegram.
#
# Pasang di VPS (user suka-hermes): ~/.hermes/profiles/ceo/scripts/laporan_pagi.py
# Jadwal (VPS = UTC, 07:00 WIB = 00:00 UTC):
#   ceo cron create --name "Laporan Pagi CEO" --no-agent --script laporan_pagi.py \
#     --deliver telegram:<chat_id_grup> '0 0 * * *'
# Uji: HERMES_HOME=~/.hermes/profiles/ceo ~/.hermes/tools/python-*/bin/python3 <path skrip>
import json, os, pathlib, urllib.request

HOME = pathlib.Path(os.environ.get('HERMES_HOME') or pathlib.Path.home() / '.hermes/profiles/ceo')
URL = 'https://admin.sukashawarma.com/api/hermes/mcp'

def gagal(pesan):
    print(f'⚠️ Laporan pagi gagal dibuat: {pesan}')
    raise SystemExit(0)

kunci = None
for baris in (HOME / '.env').read_text().splitlines():
    if baris.startswith('SUKA_MCP_KEY='):
        kunci = baris.split('=', 1)[1].strip()
if not kunci:
    gagal('SUKA_MCP_KEY tidak ditemukan')

badan = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
         'params': {'name': 'laporan_pagi_ceo', 'arguments': {}}}
req = urllib.request.Request(URL, data=json.dumps(badan).encode(), headers={
    'Authorization': f'Bearer {kunci}', 'Content-Type': 'application/json', 'User-Agent': 'suka-hermes/1.0'})
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
except Exception as e:
    gagal(f'{type(e).__name__}: {e}')

hasil = j.get('result') or {}
if j.get('error') or hasil.get('isError'):
    gagal((j.get('error') or {}).get('message') or hasil.get('content', [{}])[0].get('text', 'galat'))
print(json.loads(hasil['content'][0]['text'])['teks'])
