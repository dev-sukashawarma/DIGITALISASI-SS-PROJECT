const VALID_ROLES = ["admin", "admin_hr", "owner", "spv", "leader", "kasir", "crew", "kiosk", "kitchen", "mitra"];
const VALID_STATUSES = ["active", "inactive", "on_leave"];

export function assertAdmin(caller: { role: string } | null): void {
  if (!caller || !["admin", "admin_hr", "owner"].includes(caller.role)) {
    throw new Error("Unauthorized: Only privileged roles (admin, admin_hr, owner) can perform this action");
  }
}

export function validateCreateInput(body: {
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  outlet_id?: string;
  outlet_ids?: string[];
}): void {
  const { name, username, password, role, outlet_id, outlet_ids } = body;
  if (!name || !username || !password || !role || !outlet_id) {
    throw new Error("Missing required fields");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  if (role === "leader" && (!outlet_ids || outlet_ids.length === 0)) {
    throw new Error("leader requires outlet_ids (minimal 1 outlet binaan)");
  }
}

export function validateStatus(status: string): string {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  return status;
}
