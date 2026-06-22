const VALID_ROLES = ["admin", "owner", "spv", "leader", "kasir", "crew", "kiosk"];
const VALID_STATUSES = ["active", "inactive", "on_leave"];

export function assertAdmin(caller: { role: string } | null): void {
  if (!caller || caller.role !== "admin") {
    throw new Error("Unauthorized: Only admin can perform this action");
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
