const FN_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`

async function callFn(fn: string, token: string, body: unknown) {
  const res = await fetch(`${FN_BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await res.json()
  if (!res.ok || !result.ok) throw new Error(result.error || `Gagal memanggil ${fn}`)
  return result
}

export const adminApi = {
  createStaff: (token: string, body: unknown) => callFn('admin-create-staff', token, body),
  updateStaff: (token: string, body: unknown) => callFn('admin-update-staff', token, body),
  resetPassword: (token: string, staff_id: string, new_password: string) =>
    callFn('admin-reset-password', token, { staff_id, new_password }),
  setStatus: (token: string, staff_id: string, status: string) =>
    callFn('admin-set-status', token, { staff_id, status }),
  deleteStaff: (token: string, staff_id: string) =>
    callFn('delete-staff', token, { staff_id }),
}
