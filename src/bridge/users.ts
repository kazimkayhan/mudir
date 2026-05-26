import { z } from "zod";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/domain/auth/password";
import type { CreateUserInput } from "@/domain/auth/schemas";
import {
  createSessionExpiry,
  getStoredSession,
  type StoredSession,
  setStoredSession,
} from "@/domain/auth/session";
import type { Role } from "@/domain/types";
import { loadAppDatabase } from "@/lib/app-db";
import { runInTransaction } from "@/lib/run-in-transaction";
import { isMudirDesktop } from "@/lib/runtime";

const userRowSchema = z.object({
  created_at: z.string(),
  email: z.string().nullable().optional(),
  id: z.string(),
  is_active: z.coerce.number(),
  must_change_password: z.coerce.number().optional(),
  name: z.string(),
  password_hash: z.string().nullable().optional(),
  pin_hash: z.string().optional(),
  role: z.string(),
});

export interface UserRow {
  createdAt: string;
  email?: string;
  id: string;
  isActive: boolean;
  mustChangePassword: boolean;
  name: string;
  role: Role;
}

function rowToUser(row: z.infer<typeof userRowSchema>): UserRow {
  return {
    createdAt: row.created_at,
    email: row.email ?? undefined,
    id: row.id,
    isActive: row.is_active === 1,
    mustChangePassword: row.must_change_password === 1,
    name: row.name,
    role: row.role as Role,
  };
}

const USER_SELECT =
  "SELECT id, name, role, pin_hash, email, password_hash, is_active, must_change_password, created_at FROM users";

export async function hasPasswordUsers(): Promise<boolean> {
  if (!isMudirDesktop()) {
    return false;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id FROM users WHERE is_active = 1 AND password_hash IS NOT NULL AND password_hash != '' LIMIT 1"
  );
  return Array.isArray(raw) && raw.length > 0;
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserRow | null> {
  if (!isMudirDesktop()) {
    return {
      createdAt: new Date().toISOString(),
      email: normalizeEmail(email),
      id: "default-owner",
      isActive: true,
      mustChangePassword: false,
      name: "Owner",
      role: "owner",
    };
  }
  const normalized = normalizeEmail(email);
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${USER_SELECT} WHERE email = $1 AND is_active = 1 LIMIT 1`,
    [normalized]
  );
  const rows = z.array(userRowSchema).parse(raw);
  const row = rows[0];
  if (!row?.password_hash) {
    return null;
  }
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return null;
  }
  const now = new Date().toISOString();
  await db.execute("UPDATE users SET last_login_at = $1 WHERE id = $2", [
    now,
    row.id,
  ]);
  return rowToUser(row);
}

export async function listUsers(): Promise<UserRow[]> {
  if (!isMudirDesktop()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${USER_SELECT} WHERE is_active = 1 ORDER BY name`
  );
  return z.array(userRowSchema).parse(raw).map(rowToUser);
}

export async function createUserWithPassword(
  input: CreateUserInput
): Promise<{ id: string }> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  const email = normalizeEmail(input.email);
  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO users (id, name, role, pin_hash, email, password_hash, is_active, must_change_password, created_at)
       VALUES ($1, $2, $3, '', $4, $5, 1, 0, $6)`,
      [id, input.name.trim(), input.role, email, passwordHash, now]
    );
  });
  return { id };
}

export async function upsertOwnerAccount(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string }> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${USER_SELECT} WHERE role = 'owner' AND is_active = 1 LIMIT 1`
  );
  const rows = z.array(userRowSchema).parse(raw);
  const existing = rows[0];
  const passwordHash = await hashPassword(input.password);
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();

  if (existing) {
    await db.execute(
      "UPDATE users SET name = $1, email = $2, password_hash = $3, must_change_password = 0 WHERE id = $4",
      [input.name.trim(), email, passwordHash, existing.id]
    );
    return { id: existing.id };
  }

  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO users (id, name, role, pin_hash, email, password_hash, is_active, must_change_password, created_at)
     VALUES ($1, $2, 'owner', '', $3, $4, 1, 0, $5)`,
    [id, input.name.trim(), email, passwordHash, now]
  );
  return { id };
}

export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const passwordHash = await hashPassword(newPassword);
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE users SET password_hash = $1, must_change_password = 0 WHERE id = $2",
      [passwordHash, userId]
    );
  });
}

export type StoredOperator = Pick<UserRow, "id" | "name" | "role" | "email">;

export const OPERATOR_STORAGE_KEY = "mudir-operator";

export function getStoredOperator(): StoredOperator | null {
  const session = getStoredSession();
  if (!session) {
    return null;
  }
  return {
    email: session.email,
    id: session.id,
    name: session.name,
    role: session.role,
  };
}

export function setStoredOperator(op: StoredOperator | null): void {
  if (!op) {
    setStoredSession(null);
    return;
  }
  setStoredSession(
    {
      email: op.email ?? "",
      expiresAt: createSessionExpiry(false),
      id: op.id,
      name: op.name,
      role: op.role,
    },
    false
  );
}

export function loginSession(user: UserRow, remember: boolean): StoredSession {
  const session: StoredSession = {
    email: user.email ?? "",
    expiresAt: createSessionExpiry(remember),
    id: user.id,
    name: user.name,
    role: user.role,
  };
  setStoredSession(session, remember);
  return session;
}

export function requireOperatorId(): string {
  const stored = getStoredSession();
  if (stored?.id) {
    return stored.id;
  }
  if (!isMudirDesktop()) {
    return "default-owner";
  }
  throw new Error("validation.loginRequired");
}
