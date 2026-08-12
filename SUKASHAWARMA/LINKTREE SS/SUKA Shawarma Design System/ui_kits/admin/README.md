# SUKA Shawarma — Admin UI Kit

Mobile admin panel used by outlet staff and super-admins. Lives in the same
480px `.phone` shell as the customer app, with a bottom tab nav instead of a
floating cart bar.

## Screens

1. **Login** — emoji-driven brand block + email/password. Submit fakes a
   700ms auth round-trip then drops you into the panel.
2. **Dashboard** — 4 stat cards (orders today, revenue, pending,
   active outlets) + "Aktivitas Terbaru" list.
3. **Orders (default)** — primary workflow. Filter chips (`Aktif`, `Dibayar`,
   `Disiapkan`, `Siap Ambil`, `Selesai`, `Semua`), realtime pulse dot in the
   topbar, 1-tap status advance buttons (`Mulai Siapkan` → `Tandai Siap` →
   `Selesai`), plus secondary `Detail` and `Batalkan`.
4. **Order detail modal** — bottom sheet with customer info, WA link, item
   breakdown and total.
5. **Menu CRUD** — list of menu items with `Tersedia` / `Best` toggles per
   row. Toggling shows a toast.
6. **Outlets** — list of 19 outlets with status and owned/mitra type.
7. **Reports** — placeholder card pointing to `source/admin-reports.html`.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell + script loaders |
| `style.css` | Admin-only component CSS (imports `colors_and_type.css`) |
| `data.jsx` | Mock orders / menu / outlets + helpers |
| `Shell.jsx` | Topbar, BottomNav, Login, Dashboard |
| `Screens.jsx` | Orders, OrderDetail, MenuAdmin, OutletsAdmin, Reports |
| `App.jsx` | Root with auth gate + tab routing |

## Notes

- Two roles supported in the schema (`super_admin`, `outlet_staff`). The mock
  drops you in as super_admin; `outlet_staff` would scope orders + hide
  outlets/users/settings tabs.
- All numeric writes (status advance, toggle availability) update in-memory
  and toast a confirmation — the production version goes through Supabase
  with optimistic updates.
