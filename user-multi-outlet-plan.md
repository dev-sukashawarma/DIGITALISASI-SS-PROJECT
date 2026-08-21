# Implementation Plan: Multi-Outlet Selection for Users

## Overview
Enhance the user management interface (`UsersView.tsx`) to display all available roles from the database (`crew`, `kiosk`, `spv`, `regional_manager`, `owner`, `leader`, `admin`, `kitchen`). For roles that can manage multiple outlets (e.g., `admin`, `owner`, `regional_manager`, `leader`), allow the admin to select multiple specific outlets or "Semua Outlet". Update the API to handle the multiple `outlet_ids` and persist them to `staff_outlets`.

## Architecture Decisions
- **Form State**: Add `selectedOutlets: string[]` to `UsersView.tsx` to hold multiple IDs.
- **UI Element**: Modify the outlet selection dropdown to support checkboxes (multi-select) and an "Pilih Semua" option.
- **API Payload**: Send `outlet_ids` (array of strings) instead of a single `outlet_id` when the role supports multiple outlets.
- **API Handling (`POST` & `PUT`)**: 
  - Save the first `outlet_id` to `outlet_staff.outlet_id` for backward compatibility.
  - Delete old mappings in `staff_outlets` and insert new mappings for all IDs in `outlet_ids`.
- **"Semua Outlet" Handling**: If all outlets are selected, we can just insert all outlet IDs from the `initialOutlets` list into `staff_outlets`.

## Task List

### Phase 1: Update API Endpoints
- [x] **Task 1: Update `PUT /api/users/[id]/route.ts`**
  - Extract `outlet_ids` from request body.
  - Use `outlet_ids[0]` for `outlet_staff.outlet_id`.
  - Delete existing `staff_outlets` mapping for this user.
  - Insert new mappings for every ID in `outlet_ids`.
- [x] **Task 2: Update `POST /api/users/route.ts`**
  - Extract `outlet_ids` from request body.
  - Use `outlet_ids[0]` for `outlet_staff.outlet_id`.
  - After user creation, insert mappings into `staff_outlets`.

### Phase 2: Update Frontend UI
- [x] **Task 3: Update `UsersView.tsx` Roles List**
  - Add `leader`, `admin`, `kitchen` to the radio button role list (matching `allowedRoles`).
- [x] **Task 4: Implement Multi-Select Dropdown in `UsersView.tsx`**
  - If `role` is `admin`, `owner`, `regional_manager`, or `leader`, show a multi-select dropdown for outlets.
  - Add a "Pilih Semua" checkbox to select all `initialOutlets`.
  - If `role` is `crew`, `kiosk`, `spv`, `kitchen`, restrict to single selection.
- [x] **Task 5: Adjust Form Submission in `UsersView.tsx`**
  - Send `outlet_ids` array to the API instead of `outlet_id` (or in addition to).

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| API backwards compatibility | Med | Ensure `outlet_id` is still present for single-outlet users, or API gracefully falls back. |
| Missing `staff_outlets` sync | High | Ensure both `POST` and `PUT` properly clear and insert into `staff_outlets`. |
