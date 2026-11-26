import type { Role } from "@prisma/client";

// What each role may do. Keep this the single source of truth for permissions.
export const PERMISSIONS = {
  "patients.read": ["ADMIN", "DOCTOR", "NURSE", "RECEPTION", "PHARMACIST", "LAB", "CASHIER", "THERAPIST"],
  "patients.write": ["ADMIN", "RECEPTION", "NURSE"],
  "appointments.read": ["ADMIN", "DOCTOR", "NURSE", "RECEPTION", "THERAPIST", "CASHIER"],
  "appointments.write": ["ADMIN", "RECEPTION", "NURSE", "THERAPIST"],
  "queue.manage": ["ADMIN", "RECEPTION", "NURSE", "DOCTOR", "THERAPIST"],
  "billing.read": ["ADMIN", "CASHIER", "RECEPTION"],
  "billing.write": ["ADMIN", "CASHIER"],
  "billing.void": ["ADMIN"],
  "audit.read": ["ADMIN"],
  "admin.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTION: "Reception",
  PHARMACIST: "Pharmacist",
  LAB: "Lab",
  CASHIER: "Cashier",
  THERAPIST: "Therapist",
  STORE: "Store",
};
