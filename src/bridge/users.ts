import { z } from "zod";
import type { Role } from "@/domain/types";
import { loadAppDatabase } from "@/lib/app-db";
import { runInTransaction } from "@/lib/run-in-transaction";
import { isMudirDesktop } from "@/lib/runtime";

const userRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  is_active: z.coerce.number(),
  name: z.string(),
  pin_hash: z.string(),
  role: z.string(),
});

export interface UserRow {
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  role: Role;
}

function rowToUser(row: z.infer<typeof userRowSchema>): UserRow {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active === 1,
    name: row.name,
    role: row.role as Role,
  };
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function ensureDefaultOwner(): Promise<UserRow> {
  if (!isMudirDesktop()) {
    return {
      createdAt: new Date().toISOString(),
      id: "default-owner",
      isActive: true,
      name: "Owner",
      role: "owner",
    };
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, role, pin_hash, is_active, created_at FROM users WHERE is_active = 1 ORDER BY created_at LIMIT 1"
  );
  const rows = z.array(userRowSchema).parse(raw);
  if (rows[0]) {
    return rowToUser(rows[0]);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const pinHash = await hashPin("1234");
  await db.execute(
    "INSERT INTO users (id, name, role, pin_hash, is_active, created_at) VALUES ($1, $2, $3, $4, 1, $5)",
    [id, "مالک", "owner", pinHash, now]
  );
  return {
    createdAt: now,
    id,
    isActive: true,
    name: "مالک",
    role: "owner",
  };
}

export async function verifyPin(pin: string): Promise<UserRow | null> {
  if (!isMudirDesktop()) {
    return ensureDefaultOwner();
  }
  const pinHash = await hashPin(pin);
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, role, pin_hash, is_active, created_at FROM users WHERE pin_hash = $1 AND is_active = 1 LIMIT 1",
    [pinHash]
  );
  const rows = z.array(userRowSchema).parse(raw);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function listUsers(): Promise<UserRow[]> {
  if (!isMudirDesktop()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, role, pin_hash, is_active, created_at FROM users WHERE is_active = 1 ORDER BY name"
  );
  return z.array(userRowSchema).parse(raw).map(rowToUser);
}

export async function createUser(raw: {
  name: string;
  role: Role;
  pin: string;
}): Promise<{ id: string }> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const pinHash = await hashPin(raw.pin);
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO users (id, name, role, pin_hash, is_active, created_at) VALUES ($1, $2, $3, $4, 1, $5)",
      [id, raw.name.trim(), raw.role, pinHash, now]
    );
  });
  return { id };
}

export const OPERATOR_STORAGE_KEY = "mudir-operator";

export type StoredOperator = Pick<UserRow, "id" | "name" | "role">;

export function getStoredOperator(): StoredOperator | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(OPERATOR_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredOperator;
  } catch {
    return null;
  }
}

export function setStoredOperator(op: StoredOperator | null): void {
  if (op) {
    sessionStorage.setItem(OPERATOR_STORAGE_KEY, JSON.stringify(op));
  } else {
    sessionStorage.removeItem(OPERATOR_STORAGE_KEY);
  }
}

export async function requireOperatorId(): Promise<string> {
  const stored = getStoredOperator();
  if (stored?.id) {
    return stored.id;
  }
  if (!isMudirDesktop()) {
    const owner = await ensureDefaultOwner();
    return owner.id;
  }
  throw new Error("validation.loginRequired");
}
