# Pre-Deployment Checklist — Suka Shawarma SSO Suite

**Project Status:** ✅ Code Complete | ✅ Security Hardened | ✅ Documentation Updated  
**Deployment Target:** cPanel (connectindo.net, IP: 103.77.106.237)  
**Date:** 2026-06-15  
**Deployer:** ___________

---

## ✅ STEP 1: Verify Code is Production-Ready

### 1a. Code Review ✅
- [x] 12 critical security findings fixed (commits cd8d0ef, aae79fd)
- [x] Code review passed: "READY TO DEPLOY"
- [x] Dead code removed
- [x] All auth imports unified (@suka/auth)
- [x] No merge conflicts
- [x] No uncommitted changes

**Verify:**
```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
git status              # Should be: "working tree clean"
git log --oneline -5   # Should show: d1e8e7d (last cleanup)
```

✅ Status: _________

### 1b. TypeScript Build ✅
- [x] No type errors in any app
- [x] All packages build successfully

**Verify:**
```bash
yarn type-check
yarn build
```

✅ Status: _________

### 1c. Dependencies ✅
- [x] No security vulnerabilities
- [x] All packages up-to-date

**Verify:**
```bash
npm audit
# or
yarn audit
```

✅ Status: _________

---

## ✅ STEP 2: Prepare Deployment Configuration

### 2a. Environment Files Prepared ✅
- [ ] Supabase credentials obtained from owner
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] .env.local files ready for each app (NOT committed to git):
  - [ ] `apps/portal/.env.local`
  - [ ] `apps/stok/.env.local`
  - [ ] `apps/absensi/.env.local`
  - [ ] `apps/distribusi/.env.local`
  - [ ] `apps/owner-dashboard/.env.local`
  - [ ] `apps/pos-kasir/.env.local`

**Template for each app:**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

✅ Status: _________

### 2b. cPanel Access ✅
- [ ] cPanel login credentials confirmed
- [ ] Domain: `sukashawarma.com` confirmed active
- [ ] DNS pointing to `103.77.106.237` confirmed
- [ ] Node.js 24.15.0 available on server verified

**Verify DNS:**
```bash
nslookup sukashawarma.com
# or
dig sukashawarma.com @dns1.connectindo.net
# Should return: 103.77.106.237
```

✅ Status: _________

---

## ✅ STEP 3: Execute Deployment (see DEPLOY-CPANEL.md)

### Timeline Estimate: **45 minutes**

```
Step 1: Upload .env.local files (FileZilla)        ~5 min
Step 2: Install dependencies (npm)                 ~5 min
Step 3: Build all 6 apps (Next.js build)          ~15 min
Step 4: Create server.cjs in each docroot         ~5 min
Step 5: Setup Node.js apps in cPanel              ~5 min
Step 6: DNS verification                           ~3 min
Step 7: Test via IP                                ~2 min
```

**Follow:** [`DEPLOY-CPANEL.md`](DEPLOY-CPANEL.md) (13 detailed steps)

✅ Deployment Start Time: _________  
✅ Deployment End Time: _________

---

## ✅ STEP 4: Verify SSO Flow (Post-Deployment)

### 4a. Portal Loads ✅
```bash
curl -sk --resolve app.sukashawarma.com:443:103.77.106.237 \
  https://app.sukashawarma.com/
# Expected: 200 OK, HTML login page
```

- [ ] Portal login page loads
- [ ] Form accepts email/password input
- [ ] Submit button works

✅ Status: _________

### 4b. Login Works ✅
- [ ] Test user can login (use test account from Supabase)
- [ ] Redirects to `/launcher` after successful login
- [ ] Launcher page displays role-filtered apps

✅ Status: _________

### 4c. SSO Cross-App ✅
- [ ] Click app card from launcher
- [ ] Loads corresponding app subdomain
- [ ] NO re-login required (SSO cookie works)
- [ ] User data displays correctly in app

**Test each app:**
- [ ] Stok (`stok.sukashawarma.com`)
- [ ] Absensi (`absensi.sukashawarma.com`)
- [ ] Distribusi (`distribusi.sukashawarma.com`)
- [ ] Owner Dashboard (`owner.sukashawarma.com`)
- [ ] POS Kasir (`kasir.sukashawarma.com`)

✅ Status: _________

### 4d. Role-Based Access ✅
- [ ] **Crew role:** Launcher shows only Absensi ✓
- [ ] **Kasir role:** Launcher shows Absensi + POS ✓
- [ ] **SPV role:** Launcher shows Absensi + Stok + Distribusi ✓
- [ ] **Kepala Outlet role:** Launcher shows Absensi + Stok + Distribusi + POS ✓
- [ ] **Admin role:** Launcher shows ALL apps ✓
- [ ] **Owner role:** Launcher shows only Owner Dashboard ✓

✅ Status: _________

### 4e. Direct URL Access Denied ✅
- [ ] Non-admin user tries direct URL to unauthorized app
  - Example: Crew user → `stok.sukashawarma.com`
  - Expected: Redirect to portal ✓

✅ Status: _________

### 4f. Staff Status Enforcement ✅
- [ ] Mark test user as `on_leave` in Supabase
- [ ] User cannot login (redirected to portal or error) ✓
- [ ] Mark user as `inactive`
- [ ] User cannot access apps ✓
- [ ] Revert to `active`
- [ ] User can access apps again ✓

✅ Status: _________

### 4g. SSL Certificates ✅
```bash
curl -v https://app.sukashawarma.com/
# Check output for: "SSL certificate verify ok"
```

- [ ] All 6 subdomains have valid HTTPS certificates
- [ ] No certificate warnings in browser

✅ Status: _________

### 4h. Cookies Configured Correctly ✅
- [ ] Open browser DevTools → Application → Cookies
- [ ] Cookie domain should be: `.sukashawarma.com`
- [ ] Cookie name should be: `sb-*` (Supabase standard)
- [ ] Secure flag: ✓ (HTTPS only)
- [ ] SameSite: Lax ✓

✅ Status: _________

---

## ✅ STEP 5: Monitor & Troubleshoot

### 5a. Error Logs ✅
```bash
# SSH to cPanel server
# Check Node.js error logs
tail -50 /home/sukashaw/logs/node.log
```

- [ ] No errors in app logs
- [ ] No auth-related errors
- [ ] No database connection errors

✅ Status: _________

### 5b. Performance ✅
- [ ] Portal loads in < 2 seconds
- [ ] Apps load in < 3 seconds (first time)
- [ ] Apps load in < 1 second (cached)
- [ ] No console errors in browser

✅ Status: _________

### 5c. Uptime ✅
- [ ] All 6 apps respond to health checks
- [ ] No "cPanel default page" appearing
- [ ] Apps stay up for 30 minutes without restart

✅ Status: _________

---

## ✅ STEP 6: Document Deployment Results

### 6a. Record Deployment Info
```
Deployment Date: ___________
Deployed By: ___________
cPanel User: ___________
Server: connectindo.net (grace)
IP: 103.77.106.237

Subdomains Created:
- [ ] app.sukashawarma.com
- [ ] stok.sukashawarma.com
- [ ] absensi.sukashawarma.com
- [ ] distribusi.sukashawarma.com
- [ ] owner.sukashawarma.com
- [ ] kasir.sukashawarma.com

Build Status:
- [ ] All 6 apps built successfully
- [ ] No build errors
- [ ] No type errors

Test Results:
- [ ] All SSO tests passed
- [ ] All role tests passed
- [ ] All app load tests passed
```

### 6b. Issues Encountered
```
Issue 1: ___________
Resolution: ___________

Issue 2: ___________
Resolution: ___________

Issue 3: ___________
Resolution: ___________
```

### 6c. Sign-Off
```
Deployment Status: [  ] SUCCESS  [  ] PARTIAL  [  ] FAILED

Verified By: ___________
Date: ___________
Time: ___________

Notes/Comments:
___________________________________________________________
___________________________________________________________
```

---

## ✅ STEP 7: Post-Deployment Tasks

### 7a. Inform Stakeholders ✅
- [ ] Notify outlet managers of go-live
- [ ] Share portal URL: `https://app.sukashawarma.com`
- [ ] Provide login credentials (test accounts)
- [ ] Share user guide (roles & app access)

### 7b. Enable Monitoring ✅
- [ ] Setup cPanel uptime monitoring
- [ ] Setup error alerting (if available)
- [ ] Schedule daily health checks (first 7 days)

### 7c. Rollback Plan ✅
- [ ] Document rollback procedure
- [ ] Test rollback on staging (not prod)
- [ ] Store backup of previous version

---

## ⚠️ CRITICAL VERIFICATION BEFORE "GO LIVE"

### Must Pass ALL These Tests:

```
┌─────────────────────────────────────────────────────────┐
│ DEPLOYMENT GO/NO-GO GATE                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ Portal login works                                  │
│ ✅ All 6 apps accessible via launcher                 │
│ ✅ SSO works across apps (no re-login)                │
│ ✅ Role-based access enforced                         │
│ ✅ Staff status prevents inactive user access         │
│ ✅ Direct URL access properly denied                  │
│ ✅ HTTPS/SSL working correctly                        │
│ ✅ Cookies use .sukashawarma.com domain              │
│ ✅ No errors in browser console                       │
│ ✅ No errors in server logs                           │
│                                                         │
│ If ANY of above is ❌:                                 │
│ → DO NOT GO LIVE                                        │
│ → Follow troubleshooting in DEPLOY-CPANEL.md          │
│ → Re-test before attempting again                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📞 Support & Escalation

| Issue | Contact | Action |
|-------|---------|--------|
| cPanel/hosting | connectindo.net support | Create ticket |
| Supabase database | Supabase support | Check project status |
| SSL certificate | cPanel (auto-renewed) | Wait 10 min, retry |
| Node.js app crash | Check logs, restart app | See DEPLOY-CPANEL.md troubleshooting |

---

## 🎯 Success Criteria

✅ **Deployment is successful when:**

1. Portal login page loads at `app.sukashawarma.com`
2. Users can login with valid Supabase credentials
3. Launcher displays role-filtered apps
4. Users can click an app and load it without re-login
5. Each app is accessible at its subdomain
6. Role-based access control is enforced
7. Inactive/on_leave staff cannot access apps
8. Browser shows HTTPS with valid SSL cert
9. No errors in browser console
10. No errors in server logs

---

## 📋 Handoff Checklist

When deployment is complete:

- [ ] All tests passed
- [ ] Documentation updated with actual URLs
- [ ] Stakeholders notified
- [ ] Support team trained
- [ ] Monitoring enabled
- [ ] Rollback procedure documented
- [ ] Sign-off completed

**Deployment Complete:** ✅ Date: ___________

**Next Step:** Monitor production for 7 days, watch for errors/issues.
