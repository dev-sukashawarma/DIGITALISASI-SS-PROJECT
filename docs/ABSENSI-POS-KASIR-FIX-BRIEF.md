# Absensi & Pos-Kasir Fixes — Brief untuk New Session

**Status:** Teman sudah buat commits tapi ada issues. Kita fix di session ini.

**Commits dari teman:**
- `d62e074` fix(absensi): drop static export, aktifkan middleware SSO
- `5225d20` fix(pos-kasir): seragamkan cookie sesi ke @suka/auth

---

## Issues Found

### Absensi: 50+ Type Errors

**Error:** Cannot find module '@/lib/supabase', '@/lib/feedback/toast', '@/components/PageHeader', dll.

**Cause:** Path resolution (@/*) tidak bekerja. Tsconfig baseUrl ada, tapi imports masih fail.

**Files affected:**
- `src/app/api/outlet-presence/route.ts` (line 2)
- `src/app/dashboard/checklist-monitor/page.tsx` (line 7-8)
- `src/app/dashboard/checklist/page.tsx` (line 7-9)
- Dan 40+ file lainnya

**Fix steps:**
1. Check `apps/absensi/tsconfig.json` — pastikan `"baseUrl": "."` ada
2. Run `yarn install` di apps/absensi (mungkin node_modules belum sync)
3. Delete `.next` dan `node_modules` di apps/absensi
4. Run `yarn install` lagi
5. Run `yarn type-check` — harus 0 errors

**Alternative:** Jika masih fail, check `next.config.ts` — jangan ada `output: 'export'` (ADR-008 = Node server mode)

---

### Pos-Kasir: Missing type-check Script

**Error:** `yarn type-check` command not found

**Cause:** `package.json` tidak punya script `"type-check": "tsc --noEmit"`

**Fix:**
1. Open `apps/pos-kasir/package.json`
2. Add to `"scripts"`:
   ```json
   "type-check": "tsc --noEmit",
   ```
3. Run `yarn type-check` — check apakah ada errors
4. Jika ada errors, fix per error message

**Expected:** Pos-kasir type-check pass (atau minimal jelas error apa yang perlu di-fix)

---

## Deployment Plan

**After fixes:**
1. ✅ Portal → live di `app.sukashawarma.com` (Main session handle)
2. ✅ Stok → live di `stok.sukashawarma.com` (Main session handle)
3. ✅ Distribusi → live di `distribusi.sukashawarma.com` (Main session handle)
4. ✅ Owner-dashboard → live di `owner-dashboard.sukashawarma.com` (Main session handle)
5. ⏳ Absensi → live di `absensi.sukashawarma.com` (This session handle)
6. ⏳ Pos-kasir → live di `pos-kasir.sukashawarma.com` (This session handle)

---

## Quick Commands

```bash
# Absensi
cd apps/absensi
rm -rf node_modules .next
yarn install
yarn type-check

# Pos-kasir
cd ../pos-kasir
yarn type-check
# (or add script to package.json first)
```

---

**Ready? Create new session dan lanjutkan fixes!** 🚀
