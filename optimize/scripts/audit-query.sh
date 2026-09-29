#!/usr/bin/env bash
# Cari pola query berisiko di sebuah app (heuristik — tinjau tiap temuan manual).
# Pakai:  bash optimize/scripts/audit-query.sh apps/stok
set -uo pipefail
APP="${1:?pakai: audit-query.sh <folder app>}"
SRC="$APP/src"
[ -d "$SRC" ] || SRC="$APP"
g() { grep -rnE --include=*.ts --include=*.tsx "$@" "$SRC" 2>/dev/null | grep -v node_modules | grep -v '\.test\.'; }

echo "== 1. select dari tabel tanpa .range()/.limit()/.single()/head:true di 12 baris berikutnya"
grep -rlE --include=*.ts --include=*.tsx "\.from\('[a-z_]+'\)" "$SRC" 2>/dev/null | grep -v node_modules | while read -r f; do
  awk -v F="$f" '
    /\.from\(\x27[a-z_]+\x27\)/ { start=NR; line=$0; buf=""; n=0; open=1 }
    open { buf=buf $0; n++ }
    open && n>=12 {
      if (buf ~ /\.select\(/ && buf !~ /\.range\(|\.limit\(|\.single\(|maybeSingle\(|head: *true|\.insert\(|\.update\(|\.upsert\(|\.delete\(/)
        print F ":" start ": " line
      open=0
    }' "$f"
done

echo; echo "== 2. .limit(N) besar (sering dipakai sebagai 'pengaman' yang diam-diam memotong)"
g "\.limit\((5[0-9]{2}|[6-9][0-9]{2}|[0-9]{4,})\)"

echo; echo "== 3. .in() dengan daftar id dinamis (risiko URL > 8KB / HTTP 414)"
g "\.in\('[a-z_]*id'," | grep -vE "\.in\('[a-z_]+', \["

echo; echo "== 4. 'hari ini' dari UTC (salah sebelum 07.00 WIB)"
g "toISOString\(\)\.(split\('T'\)|slice\(0, ?10\))"

echo; echo "== 5. Jam/tanggal ditampilkan tanpa timeZone Asia/Jakarta"
g "toLocale(Time|Date)String\([^)]*\)" | grep -v "Asia/Jakarta"

echo; echo "== 6. Polling agresif (< 60 detik)"
g "refetchInterval: *([0-9]{1,4}|[1-5][0-9]_?000)\b"

echo; echo "== 7. Error ditelan jadi data kosong"
g "if \(error\) *(\{)? *(return \[\]|return null)"

echo; echo "== 8. Nama channel realtime statis (tabrakan bila dua komponen mount)"
g "\.channel\('[^'\$]+'\)"
