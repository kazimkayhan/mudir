#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { signAsync } from "@noble/ed25519";

const { values } = parseArgs({
  options: {
    days: { default: "365", type: "string" },
    email: { type: "string" },
    plan: { default: "standard", type: "string" },
    "private-key": { type: "string" },
  },
});

const email = values.email;
const days = Number.parseInt(values.days ?? "365", 10);
const plan = values.plan ?? "standard";
const privateKeyHex =
  values["private-key"] ??
  process.env.MUDIR_LICENSE_PRIVATE_KEY ??
  readOptionalHex(".license/private.hex");

if (!(email && privateKeyHex)) {
  console.error(
    "Usage: pnpm issue-license --email user@example.com [--days 365] [--plan standard] [--private-key hex]"
  );
  process.exit(1);
}

function readOptionalHex(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const issued = new Date();
const expires = new Date(issued);
expires.setDate(expires.getDate() + days);

const payload = {
  customer_email: email,
  customer_id: crypto.randomUUID(),
  expires_at: expires.toISOString().slice(0, 10),
  issued_at: issued.toISOString().slice(0, 10),
  plan,
  v: 1,
};

const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
const signature = await signAsync(payloadBytes, privateKey);
const key = `MUDIR1.${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;

console.log(key);
