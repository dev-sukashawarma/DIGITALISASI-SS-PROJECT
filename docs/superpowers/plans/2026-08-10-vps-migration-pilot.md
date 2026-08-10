# VPS Migration Pilot (admin-dashboard → Hostinger + Coolify) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `admin-dashboard` off cPanel shared hosting onto a Hostinger VPS KVM 2 managed by Coolify, while it keeps talking to the same Supabase Cloud project it uses today — with a working rollback path at every step.

**Architecture:** A custom multi-stage-free `Dockerfile` builds the whole npm workspace monorepo (root deps + `packages/auth`, `packages/design-system`, `packages/realtime` source + `apps/admin-dashboard`), then runs the existing `server.cjs` entrypoint — the same boot mechanism already used in production on cPanel, so `middleware.ts` keeps enforcing auth (this repo has a documented incident where Next's `output: 'standalone'` mode silently broke auth enforcement — see `next.config.mjs` comment). Coolify builds this Dockerfile from the monorepo root on every git push and deploys it behind its bundled Traefik reverse proxy with automatic Let's Encrypt TLS. DNS cutover is staged through a throwaway test subdomain before touching the production `admin.sukashawarma.com` record, so rollback is always "flip the A record back."

**Tech Stack:** Docker, Coolify (self-hosted PaaS), Hostinger VPS KVM 2 (Ubuntu 24.04, Indonesia data center), Next.js 16 / npm workspaces (existing), Supabase Cloud (unchanged), Cloudflare (DNS zone authority for `sukashawarma.com`, moved off cPanel/connectindo as Task 0 of this plan).

## Global Constraints

- `admin-dashboard` MUST keep connecting to the **existing Supabase Cloud project** — no database migration, no new Supabase project, no schema changes. (Spec §1, §2)
- `output: 'standalone'` MUST NOT be used or reintroduced anywhere in the Docker build — it silently breaks `middleware.ts` auth enforcement in production. (`apps/admin-dashboard/next.config.mjs` comment, ADR-008)
- `NEXT_PUBLIC_*` env vars MUST be supplied as Docker **build arguments** (baked in at `next build` time), not only as runtime environment variables — Next.js inlines them at build time. (CLAUDE.md "Gotcha penting")
- `NEXT_PUBLIC_COOKIE_DOMAIN` MUST be set to `.sukashawarma.com` at build time so SSO cookies keep working across cPanel (other apps) and the VPS (admin-dashboard). (CLAUDE.md, memory `sso-cookie-domain-gotcha`)
- Production DNS for `admin.sukashawarma.com` MUST NOT be changed until the full smoke-test checklist (Task 6) passes on the throwaway test subdomain. (Spec §6)
- cPanel's existing `admin-dashboard` deployment MUST stay running and untouched until the VPS deployment has been stable in production for at least 1–2 weeks. (Spec §6, §9)
- The VPS MUST be hardened (SSH key-only, `ufw`, no plaintext secrets in git) before any Supabase credential is placed on it — same standard as the current production server. (Spec §3)
- `sukashawarma.com` has **live email** (self-hosted on the same cPanel/connectindo server — MX priority 0 points at `sukashawarma.com` itself, with SPF/DKIM/DMARC configured). Every DNS record inventoried in Task 0 Step 1 MUST be reproduced exactly in Cloudflare before nameservers are switched, or mail delivery breaks. Mail records (MX, and any record referenced by SPF/DKIM) MUST be set to Cloudflare's "DNS only" (not proxied) mode.
- The portal/launcher app's real production hostname is `app.sukashawarma.com` — **not** `portal.sukashawarma.com` (verified by direct DNS lookup; `portal.sukashawarma.com` does not resolve at all). Use `app.sukashawarma.com` in every SSO/login-flow reference in this plan.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/admin-dashboard/Dockerfile` (new) | Builds the monorepo + admin-dashboard and defines the container runtime command (`node server.cjs`). |
| `apps/admin-dashboard/.dockerignore` (new) | Keeps `node_modules`, `.next`, git metadata, and the many scratch/check `.mjs`/`.cjs` files out of the Docker build context. |
| `docs/superpowers/plans/runbook-admin-dashboard-vps.md` (new, written in Task 8) | Durable record of VPS IP, Coolify project URL, DNS records, and rollback commands — for whoever operates this next, not just this session. |
| `docs/superpowers/plans/runbook-dns-cloudflare.md` (new, written in Task 0) | Durable record of every DNS record migrated to Cloudflare, so nothing gets silently dropped in a future edit. |

No other repo files change. Supabase schema, RLS, and app code are untouched — this plan is pure infrastructure.

---

## Task 0: Migrate the DNS zone for sukashawarma.com from cPanel to Cloudflare

**Why this comes first:** the DNS zone for `sukashawarma.com` currently lives *inside* the cPanel/connectindo account itself (nameservers are `dns1-4.connectindo.net`) — confirmed by direct lookup, not assumed. As long as that's true, DNS authority is coupled to that one hosting account. Doing this now, before any app moves to the VPS, means Task 5 and Task 7 (below) edit records in Cloudflare instead of cPanel Zone Editor, and the eventual full decommission of cPanel (out of scope of this plan, but the stated long-term goal) won't also take the domain's DNS down with it.

**This task does NOT touch email hosting itself** — mail keeps running on the same cPanel server exactly as today. Only the *records that point to it* move to a new authority. Migrating the mail server itself (if cPanel is ever fully decommissioned) is a separate, future project — flagged here, not solved here.

**Files:**
- Create: `docs/superpowers/plans/runbook-dns-cloudflare.md`

- [ ] **Step 1: Export the authoritative zone file from cPanel — do not rely on guessing subdomains**

Log into cPanel (connectindo) → **Zone Editor** → `sukashawarma.com` → **Export Zone File** (or **Raw Zone Editor**, whichever the cPanel theme calls it). Save the raw zone file. This is the authoritative source — DNS lookups from outside (like the ones used to draft this plan) can only find records for names someone thought to guess; the zone file lists every record that actually exists, including any that were never probed for.

- [ ] **Step 2: Cross-check the export against the records already confirmed for this plan**

At minimum, the exported zone file must account for all of these (already verified by direct lookup while writing this plan):

| Record | Type | Value |
|---|---|---|
| `sukashawarma.com` | A | `103.77.106.237` |
| `sukashawarma.com` | MX (priority 0) | `sukashawarma.com` |
| `sukashawarma.com` | TXT (SPF) | `v=spf1 ip4:103.77.106.237 +a +mx +ip4:103.65.237.110 ~all` |
| `_dmarc.sukashawarma.com` | TXT | `v=DMARC1; p=none;` |
| `default._domainkey.sukashawarma.com` | TXT (DKIM) | (RSA public key — copy verbatim from the zone export, it's long) |
| `www.sukashawarma.com` | A | `103.77.106.237` |
| `mail.sukashawarma.com` | A | `103.77.106.237` |
| `webmail.sukashawarma.com` | A | `103.77.106.237` |
| `cpanel.sukashawarma.com` | A | `103.77.106.237` |
| `ftp.sukashawarma.com` | A | `103.77.106.237` |
| `autodiscover.sukashawarma.com` | A | `103.77.106.237` |
| `autoconfig.sukashawarma.com` | A | `103.77.106.237` |
| `app.sukashawarma.com` (portal/launcher) | A | `103.77.106.237` |
| `stok.sukashawarma.com` | A | `103.77.106.237` |
| `distribusi.sukashawarma.com` | A | `103.77.106.237` |
| `absensi.sukashawarma.com` | A | `103.77.106.237` |
| `admin.sukashawarma.com` | A | `103.77.106.237` |
| `finance.sukashawarma.com` | A | `103.77.106.237` |
| `manager.sukashawarma.com` | A | `103.77.106.237` |

If the zone export contains records not in this table (it likely will — this plan's lookups only checked names someone thought to try), add them to the table before continuing. **Do not proceed to Step 5 (nameserver switch) until this table is confirmed complete against the actual export.**

- [ ] **Step 3: Create the Cloudflare site and import records**

Sign up / log into Cloudflare → **Add a Site** → enter `sukashawarma.com` → select the Free plan. Cloudflare will attempt to auto-scan existing DNS records. **Do not trust the auto-scan alone** — after it finishes, manually compare Cloudflare's imported record list against the table from Step 2, field by field, and add anything missing.

- [ ] **Step 4: Set proxy status correctly per record**

In Cloudflare's DNS tab, for each record, set the orange-cloud/grey-cloud toggle:
- `mail`, `webmail`, `cpanel`, `ftp`, `autodiscover`, `autoconfig`, and the bare `sukashawarma.com` A record used by MX → **DNS only (grey cloud)**. Mail and cPanel protocols do not work through Cloudflare's HTTP(S) proxy.
- `www`, `app`, `stok`, `distribusi`, `absensi`, `admin`, `finance`, `manager` → **DNS only (grey cloud) for now**. Leave proxying (orange cloud) off during this migration — turning it on changes the IP clients see (Cloudflare's edge IP instead of the origin), which is a separate decision with its own testing, not something to bundle into a DNS-authority migration.
- MX and TXT records don't have a proxy toggle — they're DNS-only by nature.

- [ ] **Step 5: Note Cloudflare's assigned nameservers**

Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`) after the site is added. Write them down — needed for Step 6.

- [ ] **Step 6: Change nameservers at the registrar (IDWebHost)**

Log into IDWebHost's client panel → find the `sukashawarma.com` domain → **Nameservers** / **DNS Management** section → replace the current nameservers (`dns1-4.connectindo.net`) with the two Cloudflare nameservers from Step 5. Save.

- [ ] **Step 7: Wait for propagation, then verify from outside your own resolver's cache**

Nameserver changes propagate slower than a single record change (up to 24–48 hours, though often faster). Check periodically:

```powershell
Resolve-DnsName -Name sukashawarma.com -Type NS -Server 8.8.8.8
```

Expected: eventually shows `*.ns.cloudflare.com` entries instead of `dns*.connectindo.net`.

- [ ] **Step 8: Verify every record from the Step 2 table still resolves correctly**

```powershell
foreach ($h in @("sukashawarma.com","www.sukashawarma.com","mail.sukashawarma.com","app.sukashawarma.com","stok.sukashawarma.com","distribusi.sukashawarma.com","absensi.sukashawarma.com","admin.sukashawarma.com","finance.sukashawarma.com","manager.sukashawarma.com")) {
  Write-Output "$h -> $((Resolve-DnsName -Name $h -Type A -Server 8.8.8.8 -ErrorAction SilentlyContinue).IPAddress -join ',')"
}
Resolve-DnsName -Name sukashawarma.com -Type MX -Server 8.8.8.8
Resolve-DnsName -Name sukashawarma.com -Type TXT -Server 8.8.8.8
Resolve-DnsName -Name _dmarc.sukashawarma.com -Type TXT -Server 8.8.8.8
Resolve-DnsName -Name default._domainkey.sukashawarma.com -Type TXT -Server 8.8.8.8
```

Expected: every hostname still resolves to `103.77.106.237`, and MX/SPF/DMARC/DKIM values match the Step 2 table exactly.

- [ ] **Step 9: Verify email still works**

Send a test email to an `@sukashawarma.com` address from an external account (e.g. Gmail), and send one from an `@sukashawarma.com` account to an external address. Confirm both arrive, and check the received message's headers for `SPF: PASS` and `DKIM: PASS`. **If either fails, do not proceed with the rest of this plan until email is confirmed working** — this is the one class of regression from this task that would be a business-critical outage, not just an inconvenience.

- [ ] **Step 10: Write the DNS runbook**

```markdown
# Runbook: DNS zone for sukashawarma.com

## Authority
DNS zone authority: **Cloudflare** (moved from cPanel/connectindo on <date>).
Domain registrar: IDWebHost (unchanged — only nameservers were repointed, the domain itself is still registered there).
Cloudflare account: <account email/owner>

## Editing records going forward
All A/CNAME/MX/TXT record changes for sukashawarma.com and its subdomains happen in the
Cloudflare dashboard now — cPanel's Zone Editor is no longer authoritative and edits made
there will have no effect once the nameserver switch has propagated.

## Full record inventory at time of migration
(copy the final, verified table from Task 0 Step 2 here)

## Known coupling
Email (MX -> sukashawarma.com itself, SPF/DKIM/DMARC configured) is still physically
hosted on the cPanel/connectindo server. Decommissioning that server in the future
requires migrating mail hosting FIRST or in parallel — this DNS migration does not
solve that, it only decouples DNS lookups from that server's continued existence.
```

- [ ] **Step 11: Commit the DNS runbook**

```bash
git add docs/superpowers/plans/runbook-dns-cloudflare.md
git commit -m "docs: record DNS zone migration from cPanel to Cloudflare"
```

---

## Task 1: Dockerfile for admin-dashboard, verified locally

**Files:**
- Create: `apps/admin-dashboard/Dockerfile`
- Create: `apps/admin-dashboard/.dockerignore`

**Interfaces:**
- Consumes: existing `apps/admin-dashboard/server.cjs` (unmodified, already production-proven on cPanel), existing `apps/admin-dashboard/src/middleware.ts` (unmodified).
- Produces: a Docker image that Task 4 (Coolify) builds from directly — no other task depends on internals beyond "the image runs `server.cjs` on `$PORT` and serves the app".

This task runs entirely on the developer's own machine with Docker installed — no VPS involved yet. It exists to catch the `standalone`-breaks-auth class of bug (and the `NEXT_PUBLIC_*` build-arg gotcha) *before* it costs a VPS deploy cycle to discover.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# apps/admin-dashboard/Dockerfile
#
# Build context MUST be the monorepo root (not this directory) — this app
# depends on npm workspace packages (@suka/auth, @suka/design-system,
# @suka/realtime) that live at packages/*/src and are resolved via npm
# workspace symlinks in the root node_modules.
#
# Runtime uses server.cjs (same entrypoint as the cPanel production deploy)
# instead of `next start` on a `standalone` build — see
# apps/admin-dashboard/next.config.mjs for why `output: 'standalone'` is
# banned in this repo (it silently disables middleware.ts auth enforcement).

FROM node:24-bookworm-slim

WORKDIR /repo

# --- Layer 1: manifests only, so `npm install` is cached unless deps change ---
COPY package.json package-lock.json .npmrc ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY apps/admin-dashboard/package.json apps/admin-dashboard/package.json

RUN npm install

# --- Layer 2: full source ---
COPY packages/auth packages/auth
COPY packages/design-system packages/design-system
COPY packages/realtime packages/realtime
COPY apps/admin-dashboard apps/admin-dashboard

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time —
# they MUST be passed as --build-arg, a runtime-only env var is too late.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN

# Throttle the build — Hostinger KVM 2 is only 2 vCPU, and this repo has a
# documented history of OOM/EAGAIN during unthrottled Next builds on
# constrained hosts (see apps/admin-dashboard/package.json "build:cpanel").
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

RUN npm run build --workspace=apps/admin-dashboard

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /repo/apps/admin-dashboard
CMD ["node", "server.cjs"]
```

- [ ] **Step 2: Write the .dockerignore**

```
# apps/admin-dashboard/.dockerignore
# NOTE: build context is the monorepo root, so these paths are root-relative.
**/node_modules
**/.next
**/.git
.claude
mobile
apps/*/node_modules
!apps/admin-dashboard
apps/admin-dashboard/*.sql
apps/admin-dashboard/*.mjs
apps/admin-dashboard/*.cjs
apps/admin-dashboard/*.ts
!apps/admin-dashboard/src/**/*.ts
!apps/admin-dashboard/next.config.mjs
!apps/admin-dashboard/postcss.config.mjs
!apps/admin-dashboard/vitest.config.ts
apps/admin-dashboard/*.txt
apps/admin-dashboard/*.md
apps/admin-dashboard/tsconfig.tsbuildinfo
```

- [ ] **Step 3: Build the image locally**

From the **monorepo root** (not `apps/admin-dashboard`):

```bash
docker build \
  -f apps/admin-dashboard/Dockerfile \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$(grep NEXT_PUBLIC_SUPABASE_URL apps/admin-dashboard/.env.local | cut -d= -f2-)" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/admin-dashboard/.env.local | cut -d= -f2-)" \
  --build-arg NEXT_PUBLIC_PORTAL_URL="$(grep NEXT_PUBLIC_PORTAL_URL apps/admin-dashboard/.env.local | cut -d= -f2-)" \
  --build-arg NEXT_PUBLIC_COOKIE_DOMAIN="$(grep NEXT_PUBLIC_COOKIE_DOMAIN apps/admin-dashboard/.env.local | cut -d= -f2-)" \
  -t admin-dashboard-vps-pilot \
  .
```

Expected: build finishes with `naming to docker.io/library/admin-dashboard-vps-pilot` and exit code 0. This command intentionally reads values out of the existing `.env.local` via shell substitution so no secret is ever typed or pasted into the plan itself.

- [ ] **Step 4: Run the container**

```bash
docker run --rm -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY apps/admin-dashboard/.env.local | cut -d= -f2-)" \
  --name admin-dashboard-pilot \
  admin-dashboard-vps-pilot
```

Expected stdout: `> Ready on port 3000` (from `server.cjs`).

- [ ] **Step 5: Verify auth middleware is NOT silently disabled**

`middleware.ts` explicitly skips enforcement when `request.nextUrl.hostname === 'localhost'`, so a plain `curl localhost:3000` would pass even if auth were broken. Force a non-localhost hostname via the `Host` header to get a real signal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: admin.sukashawarma.com" http://localhost:3000/dashboard
```

Expected: `307` or `302` (redirect to `/login` — proves `enforceAppAccess` ran). **A `200` here means the standalone-style auth bypass has regressed — stop and fix the Dockerfile before continuing to any other task.**

- [ ] **Step 6: Verify a public route still works**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: admin.sukashawarma.com" http://localhost:3000/public/form-bahan-baku
```

Expected: `200`.

- [ ] **Step 7: Stop the container**

```bash
docker stop admin-dashboard-pilot
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin-dashboard/Dockerfile apps/admin-dashboard/.dockerignore
git commit -m "build: add Docker image for admin-dashboard VPS pilot deployment"
```

---

## Task 2: Provision the Hostinger VPS

No repo files change in this task — it is entirely done in the Hostinger control panel and over SSH. Recorded here so the next person doing this has exact steps, not "set up a VPS."

- [ ] **Step 1: Order the VPS**

In Hostinger's VPS panel: select **KVM 2**, OS template **Ubuntu 24.04 LTS**, data center location **Indonesia** (must be selected explicitly — it is not the default). Note the assigned public IPv4 address once provisioning finishes.

- [ ] **Step 2: First SSH login and non-root user**

```bash
ssh root@<VPS_IP>
adduser deploy
usermod -aG sudo deploy
```

Expected: new user created without error.

- [ ] **Step 3: Copy your SSH public key to the new user, disable password auth**

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Then edit `/etc/ssh/sshd_config` on the VPS: set `PasswordAuthentication no` and `PermitRootLogin no`, then:

```bash
systemctl restart ssh
```

- [ ] **Step 4: Verify key-only login as the new user from your own machine**

```bash
ssh deploy@<VPS_IP>
```

Expected: logs in without a password prompt. Then, still as `deploy`, confirm root password login is now rejected:

```bash
ssh -o PreferredAuthentications=password root@<VPS_IP>
```

Expected: connection refused/denied (not a password prompt).

- [ ] **Step 5: Firewall**

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8000
sudo ufw enable
sudo ufw status
```

Expected output includes `22/tcp ALLOW`, `80/tcp ALLOW`, `443/tcp ALLOW`, `8000/tcp ALLOW` (8000 is Coolify's default dashboard port, closed later in Task 3 Step 4 once a domain+TLS is set up for it).

No commit for this task — infrastructure state, not repo state.

---

## Task 3: Install Coolify

- [ ] **Step 1: Run the Coolify installer**

```bash
ssh deploy@<VPS_IP>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Expected: script completes and prints a URL like `http://<VPS_IP>:8000` to finish setup.

- [ ] **Step 2: Complete first-run setup in the browser**

Visit `http://<VPS_IP>:8000`, create the admin account (use a real password manager — this is a production credential, not a throwaway one).

- [ ] **Step 3: Verify Coolify sees the server's resources**

In Coolify UI → Servers → localhost: confirm it shows the VPS's CPU/RAM (2 vCPU / 8GB) and status "Reachable".

- [ ] **Step 4: (Later, after Task 5 gives Coolify's own dashboard a real domain+TLS) restrict port 8000**

Deferred to Task 5 — noted here so it isn't forgotten. Leaving 8000 open to the world indefinitely is the kind of gap this plan's §Global Constraints on hardening exists to prevent.

No commit — infrastructure state.

---

## Task 4: Deploy admin-dashboard on Coolify from the Dockerfile

**Interfaces:**
- Consumes: the Dockerfile from Task 1 (`apps/admin-dashboard/Dockerfile`), the GitHub repo this project already lives in.
- Produces: a running container reachable at Coolify's auto-generated preview URL — Task 5 points a real subdomain at it.

- [ ] **Step 1: Connect the GitHub repo to Coolify**

Coolify UI → Sources → Add → GitHub. Authorize access to the `dev-sukashawarma/DIGITALISASI-SS-PROJECT` repo (same repo already cloned on the cPanel server per CLAUDE.md's Deployment section).

- [ ] **Step 2: Create a new resource**

Coolify UI → Projects → New → Application → select the connected repo, branch `main`.

- [ ] **Step 3: Set build configuration**

- Build Pack: **Dockerfile**
- Base Directory (build context): `/` (repo root — required, see Task 1's Dockerfile header comment)
- Dockerfile Location: `apps/admin-dashboard/Dockerfile`
- Port: `3000`

- [ ] **Step 4: Set Build Variables (baked into the image at build time)**

In Coolify's "Build Variables" section (NOT plain "Environment Variables" — these must reach the `docker build --build-arg` step):

| Key | Value source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same value as `apps/admin-dashboard/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same value as `apps/admin-dashboard/.env.local` |
| `NEXT_PUBLIC_PORTAL_URL` | same value as `apps/admin-dashboard/.env.local` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.sukashawarma.com` |

- [ ] **Step 5: Set runtime Environment Variables**

| Key | Value source |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | same value as `apps/admin-dashboard/.env.local` |
| `SUPABASE_JWT_SECRET` | **set this one even though it's commented out in the local `.env.local`** — without it, every request falls back to a slow `getUser()` round-trip instead of local JWT verification (see project memory on portal nav perf: this is a known silent-perf-degradation gotcha, not optional for a production deploy). |

- [ ] **Step 6: Deploy**

Click Deploy in Coolify UI. Watch the build log.

Expected: log ends with the container reported healthy/running, and Coolify shows a working preview URL (something like `http://<random>.sslip.io`).

- [ ] **Step 7: Verify from the preview URL**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: admin.sukashawarma.com" https://<coolify-preview-url>/dashboard
```

Expected: `307`/`302` redirect to login — same check as Task 1 Step 5, now proving it holds on the real VPS build too, not just the local one.

No commit — Coolify configuration lives in Coolify's own database, not in this repo.

---

## Task 5: Test subdomain + TLS, and lock down Coolify's own dashboard

**Interfaces:**
- Consumes: the running Coolify application from Task 4.
- Produces: `admin-vps.sukashawarma.com` serving the app over HTTPS — this is what Task 6's smoke test checklist runs against.

- [ ] **Step 1: Create the DNS record in Cloudflare**

In the Cloudflare dashboard (DNS zone authority as of Task 0) → `sukashawarma.com` → DNS → Add record:

```
Type: A
Name: admin-vps
Target: <VPS_IP>
Proxy status: DNS only (grey cloud)
```

TTL can be left at "Auto" — this is a new, disposable test record, not the production one.

- [ ] **Step 2: Verify DNS propagation**

```powershell
Resolve-DnsName -Name admin-vps.sukashawarma.com -Type A -Server 8.8.8.8
```

Expected: returns `<VPS_IP>`.

- [ ] **Step 3: Attach the domain in Coolify**

Coolify UI → the admin-dashboard application → Domains → add `admin-vps.sukashawarma.com`. Coolify's bundled Traefik will request a Let's Encrypt certificate automatically.

- [ ] **Step 4: Verify HTTPS works**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://admin-vps.sukashawarma.com/dashboard
```

Expected: `307`/`302` to `/login` (unauthenticated), with no TLS certificate warning.

- [ ] **Step 5: Give Coolify's own dashboard a domain too, then close port 8000**

Repeat Steps 1–4 for a subdomain like `coolify.sukashawarma.com` pointed at the Coolify UI itself (Coolify has a setting for this under Server → Coolify URL). Once `https://coolify.sukashawarma.com` works:

```bash
ssh deploy@<VPS_IP>
sudo ufw delete allow 8000
sudo ufw status
```

Expected: `8000` no longer listed as allowed.

No commit — DNS and Coolify UI state.

---

## Task 6: Full smoke test on the test subdomain

All checks run against `https://admin-vps.sukashawarma.com` (not production yet). No repo changes in this task.

- [ ] **Step 1: SSO login flow**

Log in via the existing portal (`app.sukashawarma.com`, still on cPanel) as an `owner` or `admin` account, and confirm the portal redirects into `https://admin-vps.sukashawarma.com/dashboard` **already authenticated** (no second login prompt). This is the cross-server cookie check — confirms `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` was baked in correctly in Task 4 Step 4.

Expected: lands on the dashboard, logged in, no redirect loop.

- [ ] **Step 2: Role coverage**

Repeat login for each role that uses admin-dashboard: `owner`, `admin`, `mitra`, `admin_finance`, `admin_hr`. For each, confirm the nav only shows the sections that role should see (cross-check against `navConfig` behavior already documented in CLAUDE.md's Mitra Role session).

- [ ] **Step 3: Core feature pass**

Click through, on the test subdomain: sales dashboard (`/dashboard/owner`), expenses (`/dashboard/owner/expenses`), waste analytics (`/dashboard/owner/waste`), profit page, printer settings (`/dashboard/printer`). For each: open browser devtools, confirm no red console errors and no failed (4xx/5xx) network requests to `/api/*` or Supabase.

- [ ] **Step 4: Performance note**

Record page load time (browser devtools Network tab, "Load" event) for `/dashboard/owner` on the test subdomain, and compare against the same page on the current cPanel production URL. Write the numbers down — this is the concrete evidence the pilot is meant to produce (spec §10).

- [ ] **Step 5: Mobile check**

Open `https://admin-vps.sukashawarma.com` on a phone browser, confirm login and one core page render correctly.

If any check in this task fails: fix the underlying issue (Dockerfile, env vars, or Coolify config) and re-run Task 4 Step 6 onward before proceeding to Task 7. **Do not proceed to DNS cutover with a failing smoke test.**

---

## Task 7: DNS cutover for admin.sukashawarma.com

- [ ] **Step 1: Confirm the TTL is already low**

Already verified while drafting this plan: `admin.sukashawarma.com`'s A record TTL is already `300` seconds (5 minutes) — no separate TTL-lowering wait needed. Confirm this still holds in Cloudflare's DNS tab (TTL "Auto" in Cloudflare effectively serves at a low value, or set it explicitly to 300 if it shows something higher after the Task 0 import).

- [ ] **Step 2: Cut over, in Cloudflare**

Cloudflare dashboard → `sukashawarma.com` → DNS → find the `admin` A record → edit the target from `103.77.106.237` (cPanel) to `<VPS_IP>`. Leave proxy status as **DNS only (grey cloud)**, consistent with Task 0 Step 4's decision to defer proxying as a separate concern.

- [ ] **Step 3: Verify from outside your own DNS cache**

```bash
curl -s -o /dev/null -w "%{http_code}\n" --resolve admin.sukashawarma.com:443:<VPS_IP> https://admin.sukashawarma.com/dashboard
```

Expected: `307`/`302` redirect — confirms the VPS answers correctly for the real production hostname (not just the test subdomain), independent of whether your local machine's DNS cache has caught up yet.

- [ ] **Step 4: Confirm real propagation**

```powershell
Resolve-DnsName -Name admin.sukashawarma.com -Type A -Server 8.8.8.8
```

Expected (once propagated, may take a few minutes given the already-low TTL): `<VPS_IP>`.

- [ ] **Step 5: Rollback command, ready but not run**

Keep this on hand for the next 24–48 hours (Task 8):

```
In Cloudflare DNS: change the admin.sukashawarma.com A record back to 103.77.106.237 (cPanel — still running, untouched).
```

No commit — DNS state.

---

## Task 8: Post-cutover monitoring, runbook, and cPanel decommission

**Files:**
- Create: `docs/superpowers/plans/runbook-admin-dashboard-vps.md`

- [ ] **Step 1: Monitor for 24–48 hours**

Check Coolify's application logs (UI → application → Logs) at least twice during this window. Ask owner/SPV users actively using admin-dashboard whether anything looks wrong. If any P1 issue appears, execute the rollback command from Task 7 Step 6 immediately — that is the entire rollback procedure, no data is at risk because Supabase Cloud was never touched (spec §9).

- [ ] **Step 2: Create the off-site backup bucket (spec §8 requirement)**

Sign up for Backblaze B2 (or reuse an existing account), create a bucket named `suka-shawarma-coolify-backup`, and generate an application key scoped to that bucket only. Note the `keyID` and `applicationKey` — these go on the VPS in the next step, never in git.

- [ ] **Step 3: Install rclone and configure the B2 remote on the VPS**

```bash
ssh deploy@<VPS_IP>
curl https://rclone.org/install.sh | sudo bash
rclone config create suka-b2 b2 account=<keyID> key=<applicationKey>
```

Expected: `rclone config create` prints the new remote's config with `type = b2`.

- [ ] **Step 4: Add the daily backup cron job**

```bash
sudo crontab -e
```

Add this line (Coolify's own data directory, containing its SQLite/Postgres config store and deployed app definitions, lives at `/data/coolify` by default):

```
0 4 * * * tar -czf /tmp/coolify-backup-$(date +\%Y\%m\%d).tar.gz -C /data coolify && rclone copy /tmp/coolify-backup-$(date +\%Y\%m\%d).tar.gz suka-b2:suka-shawarma-coolify-backup/ && rm /tmp/coolify-backup-$(date +\%Y\%m\%d).tar.gz
```

- [ ] **Step 5: Verify the backup job manually once, don't wait for 4am**

```bash
sudo tar -czf /tmp/coolify-backup-test.tar.gz -C /data coolify
rclone copy /tmp/coolify-backup-test.tar.gz suka-b2:suka-shawarma-coolify-backup/
rclone ls suka-b2:suka-shawarma-coolify-backup/
```

Expected: the `ls` output lists `coolify-backup-test.tar.gz` with a non-zero size.

- [ ] **Step 6: Test restore once, so the backup is trusted (spec §8 "backup yang tak pernah dicoba restore tidak bisa dipercaya")**

```bash
mkdir /tmp/restore-test
rclone copy suka-b2:suka-shawarma-coolify-backup/coolify-backup-test.tar.gz /tmp/restore-test/
tar -tzf /tmp/restore-test/coolify-backup-test.tar.gz | head -5
rm -rf /tmp/restore-test /tmp/coolify-backup-test.tar.gz
```

Expected: `tar -tzf` lists file paths from inside the archive without error (proves the archive is valid and extractable, without actually overwriting the live Coolify install).

- [ ] **Step 7: Write the runbook**

```markdown
# Runbook: admin-dashboard on VPS

## Infrastructure
- Provider: Hostinger VPS KVM 2, Indonesia data center
- VPS IP: <VPS_IP>
- SSH: `ssh deploy@<VPS_IP>` (key-only, root login disabled)
- Coolify UI: https://coolify.sukashawarma.com
- App domain: https://admin.sukashawarma.com (cut over on <date from Task 7>)

## Rollback
In Cloudflare DNS (dash.cloudflare.com → sukashawarma.com → DNS), change the `admin.sukashawarma.com` A record back to `103.77.106.237` (cPanel).
cPanel copy of admin-dashboard is left running and untouched until <date + 1-2 weeks>.

## Deploy
`git push` to `main` → Coolify webhook rebuilds and redeploys automatically.
Manual redeploy / rollback to a previous build: Coolify UI → application → Deployments → pick a previous one → Redeploy.

## Env vars
Build Variables (baked at build time — changing these requires a redeploy, not just a restart):
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_PORTAL_URL, NEXT_PUBLIC_COOKIE_DOMAIN

Runtime Environment Variables:
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET

## Backup
- Hostinger KVM 2 includes weekly full-VPS snapshot backups (provider-side).
- Coolify's own config (`/data/coolify` on the VPS) is backed up daily at 4am via cron → `rclone` → Backblaze B2 bucket `suka-shawarma-coolify-backup` (set up in this task, Steps 2–6). Restore: `rclone copy suka-b2:suka-shawarma-coolify-backup/<latest-file> /tmp/` then extract with `tar -xzf`.
- Database: unaffected — production data lives entirely in Supabase Cloud, which is backed up under its own plan, not by anything on this VPS.

## Known gotcha
Do NOT enable `output: 'standalone'` in apps/admin-dashboard/next.config.mjs — it silently disables middleware.ts auth enforcement. See the comment in that file and Task 1 Step 5 of the migration plan for the verification method.
```

- [ ] **Step 8: Commit the runbook**

```bash
git add docs/superpowers/plans/runbook-admin-dashboard-vps.md
git commit -m "docs: add operational runbook for admin-dashboard on VPS"
```

- [ ] **Step 9: After 1–2 weeks stable — decommission the cPanel copy**

Only after Step 1's monitoring window has passed with no rollback needed: in cPanel, stop the `admin-dashboard` Node.js app (Setup Node.js App → Stop). **Do not delete the app or its files yet** — stopped-but-present is the safer intermediate state; deletion is a separate, later decision once the VPS deployment has a longer track record.

- [ ] **Step 10: Update CLAUDE.md**

Add a line under the Deployment section's Status list: `admin-dashboard.sukashawarma.com — LIVE on Hostinger VPS (Coolify), migrated <date>`. This keeps the project's own architecture doc accurate for the next session that reads it.

```bash
git add CLAUDE.md
git commit -m "docs: record admin-dashboard VPS migration in deployment status"
```

---

## Out of Scope (per design spec §11)

- Migrating any other app (stok, distribusi, absensi, etc.) to the VPS — same pattern repeats per-app once this pilot is proven.
- Supabase self-host as a production candidate (cron dump/restore track) — separate, independent plan, not part of this one.
- pos-kasir — going native Android instead, not part of any web hosting migration.
- **Migrating the mail server itself off cPanel/connectindo** — Task 0 only moves DNS record authority to Cloudflare; email keeps being physically hosted and processed by the cPanel server. Full cPanel decommission (the stated long-term goal) requires a separate mail-hosting migration project first — flagged in Task 0's runbook, not solved here.
- Enabling Cloudflare's proxy (orange cloud) for app subdomains — Task 0 deliberately leaves every migrated record in "DNS only" mode to keep this a pure authority change. Turning on proxying, CDN, and WAF features is a separate future decision with its own testing needs.
