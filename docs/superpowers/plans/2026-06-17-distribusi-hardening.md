# Distribusi Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/distribusi` to the same clean, type-safe, auth-consistent state as `apps/stok`, fixing the config + auth bugs found in audit, as the reference for the next production re-upload.

**Architecture:** Mirror-stok sequential hardening in 5 phases (config → tsconfig/types → auth → hydration → tests). Each phase has `yarn type-check` / `yarn build` verification gates. Deploy mode is Node server (ADR-008), so `output: 'export'` is removed and `middleware.ts` is kept.

**Tech Stack:** Next.js 16 (Node server), TypeScript, Supabase (`@supabase/ssr`), `@suka/auth`, vitest + @testing-library.

**Reference:** `apps/stok` commit `ad58169`; spec `docs/superpowers/specs/2026-06-15-distribusi-hardening-design.md`.

**Working dir for all commands:** `D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\apps\distribusi` (referred to below as `apps/distribusi`).

---

## Task 1: Config hazards (next.config + cleanup)

**Files:**
- Delete: `apps/distribusi/next.config.js`
- Modify: `apps/distribusi/next.config.ts`
- Delete (artifact): `apps/distribusi/out/`

- [ ] **Step 1: Delete the stale duplicate config**

There are two configs (`next.config.js` Jun 10 + `next.config.ts` Jun 15). Next.js loads `.ts` and ignores `.js`, but the duplicate is a hazard. Remove the `.js`:

```bash
cd "apps/distribusi"
rm -f next.config.js
```

- [ ] **Step 2: Rewrite next.config.ts to the clean Node-server form**

Replace the entire contents of `apps/distribusi/next.config.ts` with (matches stok, removes `output: 'export'` per ADR-008 and the invalid `eslint` key):

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
```

- [ ] **Step 3: Remove the stale static-export artifact**

```bash
cd "apps/distribusi"
rm -rf out
```

- [ ] **Step 4: Verify config is valid (build starts, no eslint-key error)**

Run:
```bash
cd "apps/distribusi"
yarn build 2>&1 | head -20
```
Expected: build begins compiling. It MAY still fail later on type errors (fixed in Task 2) — that's OK. It must NOT print the `'eslint' does not exist in type 'NextConfig'` error, and must NOT mention `output: export` / `out/` generation.

- [ ] **Step 5: Commit**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git add -A apps/distribusi/next.config.ts apps/distribusi/next.config.js
git commit -m "fix(distribusi): single clean next.config, remove output:export per ADR-008"
```
(`git add -A` on the deleted `next.config.js` path stages its removal; the `.ts` path stages the rewrite.)

---

## Task 2: tsconfig baseUrl + type errors → 0

**Files:**
- Modify: `apps/distribusi/tsconfig.json`
- Modify: `apps/distribusi/src/hooks/useSuratJalan.ts`
- Modify: `apps/distribusi/src/components/distribusi/PengirimanList.tsx`
- Modify: `apps/distribusi/src/components/distribusi/RiwayatList.tsx`
- Modify: `apps/distribusi/src/components/distribusi/RiwayatDetail.tsx`
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanList.tsx`
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx`
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx`
- Modify: `apps/distribusi/src/components/distribusi/TerimaList.tsx`
- Modify: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx`

- [ ] **Step 1: Add baseUrl to tsconfig**

In `apps/distribusi/tsconfig.json`, the `compilerOptions` currently has `paths` but no `baseUrl`, so `@/*` resolves against the ROOT tsconfig's baseUrl (wrong dir). Add `"baseUrl": "."` directly above `"paths"`:

```json
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [ ] **Step 2: Re-run type-check to get the real (post-baseUrl) error list**

Run:
```bash
cd "apps/distribusi"
rm -f tsconfig.tsbuildinfo && yarn type-check 2>&1 | grep "error TS"
```
Expected: the 16 "Cannot find module '@/...'" errors are GONE. Remaining errors are implicit-`any` (TS7006/TS7031). Use this fresh list as the source of truth; the annotations below cover the known set.

- [ ] **Step 3: Annotate Supabase callback params (apply this mapping)**

These are all callback/destructure params over Supabase results inferred as `any`. Import the relevant type at the top of each file if not already imported (`import type { SuratJalan, SuratJalanItem } from '@/types/distribusi'`), then annotate. Mapping (file → line context → fix):

`src/hooks/useSuratJalan.ts:19` — typed `.then` destructure:
```ts
      .then(({ data, error }: { data: SuratJalan[] | null; error: unknown }) => {
        if (error) throw error
        setData((data as SuratJalan[]) ?? [])
      })
      .catch((err: unknown) => {
        console.error('Error fetching surat_jalan:', err)
        setData([])
      })
```

`src/components/distribusi/PengirimanList.tsx:67` — `.map((sj) => ...)` → `.map((sj: SuratJalan) => ...)`

`src/components/distribusi/RiwayatList.tsx:52` — `(sj)` → `(sj: SuratJalan)`

`src/components/distribusi/RiwayatDetail.tsx:60` and `:111` — `(item)` → `(item: SuratJalanItem)`

`src/components/distribusi/SuratJalanList.tsx:41` — `(item)` → `(item: SuratJalanItem)`
`src/components/distribusi/SuratJalanList.tsx:52` — `(d)` → `(d: SuratJalan)`
`src/components/distribusi/SuratJalanList.tsx:143` — `(sj)` → `(sj: SuratJalan)`

`src/components/distribusi/SuratJalanDetail.tsx:201` — `(it)` → `(it: SuratJalanItem)`
`src/components/distribusi/SuratJalanDetail.tsx:288` — `(item)` → `(item: SuratJalanItem)`

`src/components/distribusi/SuratJalanForm.tsx:117` — `(outlet)` → `(outlet: { id: string; name: string })`
`src/components/distribusi/SuratJalanForm.tsx:142` — `(bahan)` → `(bahan: { id: string; nama: string; satuan: string })`
`src/components/distribusi/SuratJalanForm.tsx:181` — `(b)` → `(b: { id: string; nama: string; satuan: string })`

`src/components/distribusi/TerimaList.tsx:57` — `(sj)` → `(sj: SuratJalan)`

`src/components/distribusi/VerifikasiForm.tsx:195` — `.catch((error) => ...)` or destructure → `(error: unknown)`

> Note: if Step 2's fresh list shows a param not in this mapping, apply the same rule — annotate with the matching type from `@/types/distribusi`, or `unknown` for caught errors. For `outlet`/`bahan` shapes, confirm field names against the actual `.select(...)` columns in that file.

- [ ] **Step 4: Verify type-check is clean**

Run:
```bash
cd "apps/distribusi"
rm -f tsconfig.tsbuildinfo && yarn type-check
```
Expected: `Done` with exit 0, no `error TS` lines.

- [ ] **Step 5: Verify build succeeds**

Run:
```bash
cd "apps/distribusi"
yarn build 2>&1 | tail -15
```
Expected: build completes (Compiled successfully / route list). No `out/` directory created.

- [ ] **Step 6: Commit**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git add apps/distribusi/tsconfig.json apps/distribusi/src
git commit -m "fix(distribusi): add tsconfig baseUrl + annotate Supabase callback types (type-check 0)"
```

---

## Task 3: Auth consolidation → @suka/auth browser client

**Files (replace local `createClient` import + call):**
- Modify (16 files): all importing `from '@/lib/supabase'` — `src/hooks/{useBahanBaku,useFileUpload,useOutlets,usePengirimanList,useRiwayatList,useSuratJalan,useSuratJalanDetail,useSuratJalanList,useTerimaList}.ts` and `src/components/distribusi/{QRScanner,ReceiptSignatureStep,SignatureFlow,SuratJalanDetail,SuratJalanForm,SuratJalanList,VerifikasiForm}.tsx`
- Delete: `apps/distribusi/src/lib/supabase.ts`

- [ ] **Step 1: Confirm no remaining server-client usage before deleting**

Run:
```bash
cd "apps/distribusi"
grep -rn "createServerSupabaseClient\|SUPABASE_SERVICE_ROLE" src/
```
Expected: matches ONLY inside `src/lib/supabase.ts` (the dead definition). If any OTHER file imports it, STOP and handle that file separately (do not route service-role through the browser).

- [ ] **Step 2: Replace the import in every consumer**

In each of the 16 files, change:
```ts
import { createClient } from '@/lib/supabase'
```
to:
```ts
import { createSupabaseBrowserClient } from '@suka/auth'
```

- [ ] **Step 3: Replace every call site**

In those files, change each `const supabase = createClient()` to:
```ts
const supabase = createSupabaseBrowserClient()
```
There are multiple call sites in some files (e.g. `useSuratJalan.ts` has 3, `SignatureFlow.tsx` has 2). Replace all. Quick check for stragglers:
```bash
cd "apps/distribusi"
grep -rn "createClient()" src/
```
Expected after edits: no matches.

- [ ] **Step 4: Delete the local supabase module (browser dup + service-role footgun)**

```bash
cd "apps/distribusi"
rm -f src/lib/supabase.ts
```

- [ ] **Step 5: Verify no dangling imports**

Run:
```bash
cd "apps/distribusi"
grep -rn "@/lib/supabase" src/ ; echo "exit:$?"
```
Expected: no matches (grep exit 1 = good).

- [ ] **Step 6: Verify type-check + build**

Run:
```bash
cd "apps/distribusi"
rm -f tsconfig.tsbuildinfo && yarn type-check && yarn build 2>&1 | tail -8
```
Expected: type-check exit 0; build completes.

- [ ] **Step 7: Commit**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git add apps/distribusi/src
git commit -m "fix(distribusi): use @suka/auth browser client everywhere, delete local supabase.ts (cookie-domain SSO + service-role footgun)"
```

---

## Task 4: Hydration-safe date formatting

**Files:**
- Create: `apps/distribusi/src/hooks/useFormattedDate.ts`
- Modify: `src/components/distribusi/{PengirimanList,RiwayatList,RiwayatDetail,SuratJalanList,SuratJalanDetail,TerimaList,VerifikasiForm}.tsx`

> Rationale: `new Date(x).toLocaleDateString('id-ID', ...)` rendered directly in JSX can differ between the Node server render and the client (timezone/locale), causing hydration warnings. Compute the formatted string after mount.

- [ ] **Step 1: Create the shared helper**

Create `apps/distribusi/src/hooks/useFormattedDate.ts`:

```ts
'use client'
import { useEffect, useState } from 'react'

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

/**
 * Format an ISO date string for display, client-side only, to avoid
 * server/client hydration mismatches from locale/timezone differences.
 * Returns '' on the server render and first paint, then the formatted
 * value after mount.
 */
export function useFormattedDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS
): string {
  const [formatted, setFormatted] = useState('')
  useEffect(() => {
    if (!iso) {
      setFormatted('')
      return
    }
    setFormatted(new Date(iso).toLocaleDateString('id-ID', opts))
  }, [iso, opts])
  return formatted
}
```

- [ ] **Step 2: Find every direct date-format render to migrate**

Run:
```bash
cd "apps/distribusi"
grep -rn "toLocaleDateString('id-ID'" src/components
```
Expected: the sites in PengirimanList, RiwayatList, RiwayatDetail, SuratJalanList, SuratJalanDetail, TerimaList, VerifikasiForm.

- [ ] **Step 3: Migrate inline renders to the helper**

For each site where the formatted date is rendered in JSX (not where it's part of a `.update({...})` payload — leave `new Date().toISOString()` writes alone): call the helper at the top of the component and render its result.

Pattern — in a component that maps a list, the per-row date must be computed in a child component (hooks can't run in a `.map` callback). Where the current code is e.g.:
```tsx
{new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
```
inside a `.map((sj) => ...)`, extract a small row/date component:
```tsx
function FormattedDate({ iso }: { iso: string | null | undefined }) {
  const text = useFormattedDate(iso)
  return <>{text}</>
}
```
and replace the inline expression with `<FormattedDate iso={sj.created_at} />`. For single (non-mapped) renders (e.g. `SuratJalanDetail.tsx:274` on `data.created_at`), call `useFormattedDate(data.created_at)` directly in the component body and render the variable.

> Do NOT change server-write timestamps: `SuratJalanDetail.tsx:95` (`updated_at: new Date().toISOString()`) and `VerifikasiForm.tsx:189` (`verified_at: new Date().toISOString()`) are data payloads, not renders — leave them.

- [ ] **Step 4: Verify type-check + build**

Run:
```bash
cd "apps/distribusi"
rm -f tsconfig.tsbuildinfo && yarn type-check && yarn build 2>&1 | tail -8
```
Expected: type-check exit 0; build completes.

- [ ] **Step 5: Commit**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git add apps/distribusi/src
git commit -m "fix(distribusi): client-only date formatting via useFormattedDate (hydration-safe)"
```

---

## Task 5 (optional): Test infrastructure

**Files:**
- Modify: `apps/distribusi/package.json`
- Create: `apps/distribusi/vitest.config.ts`
- Create: `apps/distribusi/vitest.setup.ts`
- Create: `apps/distribusi/src/hooks/__tests__/useFormattedDate.test.ts`

- [ ] **Step 1: Add scripts + devDependencies to package.json**

In `apps/distribusi/package.json`, add to `scripts`:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
and add to `devDependencies` (versions match the rest of the monorepo / stok):
```json
    "vitest": "^2.1.0",
    "jsdom": "^25.0.1",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.6.3"
```

- [ ] **Step 2: Install**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
yarn install
```
Expected: `@testing-library/jest-dom` resolves under root `node_modules`. (A Windows EPERM on `next-swc...node` while a dev server runs is non-fatal — verify the package landed with `ls node_modules/@testing-library/jest-dom`.)

- [ ] **Step 3: Create vitest config**

Create `apps/distribusi/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Create vitest setup**

Create `apps/distribusi/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
```

- [ ] **Step 5: Add the vitest/jest-dom types to tsconfig**

In `apps/distribusi/tsconfig.json` `compilerOptions`, add:
```json
    "types": ["vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 6: Write a real test for the date helper**

Create `apps/distribusi/src/hooks/__tests__/useFormattedDate.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react'
import { useFormattedDate } from '../useFormattedDate'

describe('useFormattedDate', () => {
  it('returns empty string before mount effect for nullish input', () => {
    const { result } = renderHook(() => useFormattedDate(null))
    expect(result.current).toBe('')
  })

  it('formats an ISO date to id-ID after mount', async () => {
    const { result } = renderHook(() => useFormattedDate('2026-06-15T00:00:00Z'))
    await waitFor(() => expect(result.current).not.toBe(''))
    expect(result.current).toMatch(/2026/)
  })
})
```

- [ ] **Step 7: Run the tests**

```bash
cd "apps/distribusi"
yarn test 2>&1 | tail -15
```
Expected: 2 passed.

- [ ] **Step 8: Verify type-check still clean**

```bash
cd "apps/distribusi"
rm -f tsconfig.tsbuildinfo && yarn type-check
```
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git add apps/distribusi/package.json apps/distribusi/vitest.config.ts apps/distribusi/vitest.setup.ts apps/distribusi/tsconfig.json apps/distribusi/src package.json yarn.lock
git commit -m "test(distribusi): add vitest + @testing-library, useFormattedDate test"
```

---

## Final Verification

- [ ] `cd apps/distribusi && rm -f tsconfig.tsbuildinfo && yarn type-check` → exit 0, no `error TS`.
- [ ] `cd apps/distribusi && yarn build` → completes, no `out/` dir, no eslint-key error.
- [ ] `grep -rn "@/lib/supabase\|createClient()" apps/distribusi/src` → no matches.
- [ ] (if Task 5 done) `cd apps/distribusi && yarn test` → all pass.
- [ ] Manual smoke (when re-uploading): SSO login works cross-subdomain, `middleware.ts` guard runs, surat-jalan create + verifikasi penerimaan flow intact.
