export type UserRole = "owner" | "admin" | "driver" | null;

export function canManageFleet(role: UserRole) {
  return role === "owner" || role === "admin";
}

export function canManageAdmins(role: UserRole) {
  return role === "owner";
}

export function isDriver(role: UserRole) {
  return role === "driver";
}

export function canAccessPage(role: UserRole, path: string): boolean {
  if (!role) return false;
  if (role === "owner" || role === "admin") {
    // Admins can access everything except the admin mgmt section (handled in-page)
    return true;
  }
  // Drivers: only dashboard, trips, alerts
  const driverAllowed = ["/dashboard", "/trips", "/alerts"];
  return driverAllowed.some((p) => path.startsWith(p));
}
